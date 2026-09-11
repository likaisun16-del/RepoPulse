"""Snapshot persistence and cancellation, coordinated on one database thread."""

from collections.abc import Callable
from concurrent.futures import FIRST_COMPLETED, Future, wait
from datetime import UTC, datetime
from time import monotonic
from typing import Any

import httpx
from app.clients.github import (
    GitHubClient,
    GitHubClientError,
    GitHubRateLimitError,
    GitHubRepositoryData,
)
from app.config import get_settings
from app.models import JobRun, Repository, RepoSnapshot
from sqlalchemy import select
from sqlalchemy.orm import Session

from worker.app.collection import RepositoryRequests


class SnapshotCancelled(RuntimeError):
    pass


class SnapshotIncomplete(RuntimeError):
    pass


class SnapshotCollector:
    def __init__(
        self, captured_at: datetime, session_factory: Callable[[], Session],
        client_factory: Callable[[], GitHubClient], upsert: Callable[..., Any],
    ) -> None:
        self.captured_at = captured_at
        self.job_key = f"snapshot:all:{captured_at.date().isoformat()}"
        self.session_factory = session_factory
        self.client_factory = client_factory
        self.upsert = upsert
        self.settings = get_settings()
        self.count = 0
        self.existing = 0
        self.total = 0
        self.failures: dict[str, str] = {}
        self.started = monotonic()
        self.last_flush = self.started
        self.buffered = 0
        self.cancelled = False

    def run(self) -> int:
        # Cancellation reads must not implicitly flush each individual snapshot.
        with self.session_factory() as session, session.no_autoflush:
            job = session.scalar(select(JobRun).where(JobRun.job_key == self.job_key))
            progress = dict(job.progress or {}) if job else {}
            concurrency = 1 if progress.get("serial_fallback") else self.settings.snapshot_concurrency
            requests = RepositoryRequests(
                concurrency, self.settings.snapshot_requests_per_second, self.client_factory,
            )
            try:
                self._collect(session, requests, concurrency)
                self._flush(session, requests)
                if self.cancelled:
                    raise SnapshotCancelled("Cancelled at user request")
                if requests.rate_limit and self.existing + self.count < self.total:
                    raise requests.rate_limit
                if self.failures:
                    raise SnapshotIncomplete(f"{len(self.failures)} repositories failed")
                return self.count
            finally:
                requests.close()

    def _repositories(self, session: Session) -> list[Repository]:
        repositories = session.scalars(select(Repository).where(
            Repository.is_fork.is_(False), Repository.archived.is_(False),
            Repository.disabled.is_(False),
        ).order_by(Repository.id)).all()
        exclusions = self.settings.repository_exclusions
        eligible = [repo for repo in repositories if repo.full_name.lower() not in exclusions]
        saved = set(session.scalars(select(RepoSnapshot.repository_id).where(
            RepoSnapshot.snapshot_date == self.captured_at.date(),
        )))
        self.total = len(eligible)
        self.existing = sum(repo.id in saved for repo in eligible)
        return [repo for repo in eligible if repo.id not in saved]

    def _is_cancelled(self, session: Session) -> bool:
        # Select scalar columns so an identity-map cached JobRun cannot hide user cancellation.
        return bool(session.scalar(select(JobRun.cancel_requested).where(
            JobRun.job_key == self.job_key,
        )))

    def _collect(self, session: Session, requests: RepositoryRequests, concurrency: int) -> None:
        remaining = iter(self._repositories(session))
        pending: dict[Future[GitHubRepositoryData | None], Repository] = {}
        exhausted = False
        while True:
            self.cancelled = self.cancelled or self._is_cancelled(session)
            if self.cancelled:
                requests.stop()
            while not exhausted and not requests.stopped.is_set() and len(pending) < concurrency:
                repository = next(remaining, None)
                if repository is None:
                    exhausted = True
                    break
                pending[requests.submit(repository.full_name)] = repository
            if not pending:
                break
            done, _ = wait(pending, timeout=0.5, return_when=FIRST_COMPLETED)
            for future in done:
                self._save_result(session, pending.pop(future), future)
                if self.buffered >= self.settings.snapshot_batch_size:
                    self._flush(session, requests)
            if (self.buffered >= self.settings.snapshot_batch_size
                    or monotonic() - self.last_flush >= self.settings.snapshot_flush_seconds):
                self._flush(session, requests)

    def _save_result(
        self, session: Session, repository: Repository,
        future: Future[GitHubRepositoryData | None],
    ) -> None:
        try:
            data = future.result()
        except GitHubRateLimitError:
            return  # The shared request gate carries the longest required cooldown.
        except (GitHubClientError, httpx.RequestError) as exc:
            self.failures[repository.full_name] = str(exc)
            return
        if data is None:
            return
        self.upsert(session, data, repository=repository)
        session.add(RepoSnapshot(
            repository_id=repository.id, snapshot_date=self.captured_at.date(),
            captured_at=self.captured_at, stars_count=data.stars_count,
            forks_count=data.forks_count, source="github_api",
        ))
        self.count += 1
        self.buffered += 1

    def _flush(self, session: Session, requests: RepositoryRequests) -> None:
        job = session.scalar(select(JobRun).where(JobRun.job_key == self.job_key))
        if job:
            progress = dict(job.progress or {})
            rate = self.count / max(monotonic() - self.started, 0.001)
            progress.update(
                total=self.total, saved=self.existing + self.count,
                failed=len(self.failures), failures=self.failures,
                rate_per_second=round(rate, 3),
                eta_seconds=round((self.total - self.existing - self.count) / rate) if rate else None,
                updated_at=datetime.now(UTC).isoformat(),
            )
            if requests.rate_limit and requests.rate_limit.secondary:
                progress["serial_fallback"] = True
            job.progress = progress
        session.commit()
        self.buffered = 0
        self.last_flush = monotonic()
