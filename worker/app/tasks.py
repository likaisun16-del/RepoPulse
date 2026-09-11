import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import httpx
from app.clients.github import GitHubClient, GitHubClientError, GitHubRateLimitError
from app.config import get_settings
from app.database import get_sync_session
from app.models import (
    DiscoveryRun,
    JobRun,
    RankingItem,
    RankingRun,
    Repository,
    RepoSnapshot,
)
from app.ranking.calculator import RepositorySeries, SnapshotPoint, calculate_ranking
from celery import Task, chain
from redis import Redis
from redis.exceptions import LockError, RedisError
from sqlalchemy import delete, select
from sqlalchemy.engine import CursorResult

from worker.app.celery_app import celery_app
from worker.app.snapshots import (
    SnapshotCancelled,
    SnapshotCollector,
    SnapshotIncomplete,
)

logger = logging.getLogger(__name__)


class GitHubTask(Task):
    autoretry_for = (GitHubRateLimitError, httpx.RequestError)
    retry_backoff = True
    retry_backoff_max = 900
    retry_jitter = True
    max_retries = 5
    rate_limit = "60/m"


@celery_app.task(base=GitHubTask, bind=True, name="worker.app.tasks.discover_candidates")
def discover_candidates(self: GitHubTask, as_of: str | None = None) -> dict[str, int | str]:
    now = datetime.fromisoformat(as_of) if as_of else datetime.now(UTC)
    bucket = now.replace(hour=now.hour - (now.hour % 6), minute=0, second=0, microsecond=0)
    job_key = f"discovery:{bucket.isoformat()}"
    with _task_lock(job_key, timeout=21_600) as acquired:
        if not acquired or not _start_job(job_key, "discover_candidates"):
            return {"status": "duplicate", "count": 0}
        try:
            names = _discover_repository_names()
            hydrated = _hydrate_names(names, job_key=job_key, only_new=True)
            _record_discovery_run(now, len(names), "completed")
            _finish_job(job_key, "completed")
            return {"status": "ok", "count": hydrated}
        except GitHubRateLimitError as exc:
            if self.request.retries >= self.max_retries:
                _finish_job(job_key, "failed", "Rate limit retries exhausted")
                raise
            _wait_for_quota(job_key, exc)
            raise self.retry(exc=exc, args=(now.isoformat(),), kwargs={}, countdown=exc.retry_after)
        except Exception as exc:
            _record_discovery_run(now, 0, "failed", str(exc))
            _finish_job(job_key, "failed", str(exc))
            raise


@celery_app.task(bind=True, name="worker.app.tasks.collect_daily_update")
def collect_daily_update(self: Task, as_of: str | None = None) -> dict[str, int | str]:
    """Run the existing-repository snapshot independently of discovery."""
    return self.replace(capture_daily_snapshots.s(as_of))


@celery_app.task(base=GitHubTask, bind=True, name="worker.app.tasks.hydrate_repositories")
def hydrate_repositories(self: GitHubTask, repo_names: list[str]) -> dict[str, int]:
    return {"count": _hydrate_names(repo_names)}


@celery_app.task(
    bind=True, max_retries=5, soft_time_limit=7_200, time_limit=7_260,
    name="worker.app.tasks.capture_daily_snapshots",
)
def capture_daily_snapshots(self: Task, as_of: str | None = None) -> dict[str, int | str]:
    captured_at = _parse_as_of(as_of)
    job_key = f"snapshot:all:{captured_at.date().isoformat()}"
    with _task_lock(job_key, timeout=7_800, required=True) as acquired:
        if not acquired or not _start_job(job_key, "capture_daily_snapshots"):
            return {"status": "duplicate", "count": 0}
        try:
            count = _capture_snapshots(captured_at)
            if _job_cancelled(job_key):
                raise SnapshotCancelled("Cancelled at user request")
            workflow = chain(
                build_ranking.si(1, captured_at.isoformat()),
                build_ranking.si(7, captured_at.isoformat()),
                build_ranking.si(14, captured_at.isoformat()),
                build_ranking.si(30, captured_at.isoformat()),
            )
            workflow.delay()
            _finish_job(job_key, "completed")
            return {"status": "ok", "count": count}
        except SnapshotCancelled as exc:
            _finish_job(job_key, "cancelled", str(exc))
            return {"status": "cancelled", "count": 0}
        except GitHubRateLimitError as exc:
            if self.request.retries >= self.max_retries:
                _finish_job(job_key, "failed", "Rate limit retries exhausted")
                raise
            _wait_for_quota(job_key, exc)
            raise self.retry(
                exc=exc, args=(captured_at.isoformat(),), kwargs={}, countdown=exc.retry_after,
            )
        except SnapshotIncomplete as exc:
            _finish_job(job_key, "failed", str(exc))
            raise
        except Exception as exc:
            _finish_job(job_key, "failed", str(exc))
            raise


@celery_app.task(name="worker.app.tasks.build_ranking")
def build_ranking(period_days: int, as_of: str | None = None) -> dict[str, int | str]:
    captured_at = _parse_as_of(as_of)
    job_key = f"ranking:{period_days}:{captured_at.date().isoformat()}:v1"
    with _task_lock(job_key, timeout=3_600) as acquired:
        if not acquired:
            return {"status": "duplicate", "count": 0}
        with get_sync_session() as session:
            existing_job = session.scalar(select(JobRun).where(JobRun.job_key == job_key))
            if existing_job and existing_job.status == "completed":
                return {"status": "duplicate", "count": 0}
            job = existing_job or JobRun(
                job_key=job_key,
                task_name="build_ranking",
                status="running",
                attempts=0,
                started_at=datetime.now(UTC),
            )
            session.add(job)
            job.attempts += 1
            try:
                count = _persist_ranking(session, period_days, captured_at)
                job.status = "completed"
                job.finished_at = datetime.now(UTC)
                session.commit()
                return {"status": "ok", "count": count}
            except Exception as exc:
                session.rollback()
                logger.exception("Ranking build failed", extra={"period_days": period_days})
                _record_failed_job(job_key, "build_ranking", str(exc))
                raise


@celery_app.task(name="worker.app.tasks.cleanup_failed_jobs")
def cleanup_failed_jobs() -> dict[str, int]:
    cutoff = datetime.now(UTC) - timedelta(days=30)
    with get_sync_session() as session:
        result = session.execute(
            delete(JobRun).where(JobRun.status == "failed", JobRun.started_at < cutoff)
        )
        session.commit()
        row_count = cast(CursorResult[Any], result).rowcount
        return {"count": int(row_count or 0)}


def _discover_repository_names() -> list[str]:
    settings = get_settings()
    client = GitHubClient()
    try:
        names = set(settings.seed_repositories)
        names.update(
            name for since in ("daily", "weekly", "monthly") for name in client.trending(since)
        )
        if settings.github_tokens:
            pushed_after = (datetime.now(UTC) - timedelta(days=365)).date().isoformat()
            for language in settings.languages:
                names.update(
                    client.search(
                        f"language:{language} stars:>100 pushed:>{pushed_after}",
                        max_pages=settings.github_search_pages,
                    )
                )
            for topic in settings.topics:
                names.update(
                    client.search(
                        f"topic:{topic} stars:>100 pushed:>{pushed_after}",
                        max_pages=settings.github_search_pages,
                    )
                )
        exclusions = settings.repository_exclusions
        return sorted(name for name in names if name.lower() not in exclusions)[
            : settings.max_active_repositories
        ]
    finally:
        client.close()


def _hydrate_names(
    names: list[str], job_key: str | None = None, only_new: bool = False,
) -> int:
    client = GitHubClient()
    hydrated = 0
    try:
        with get_sync_session() as session:
            progress = _job_progress(session, job_key) if job_key else {}
            completed = set(progress.get("completed", []))
            identities = session.execute(select(Repository.full_name, Repository.github_id)).all()
            known = {name.lower() for name, _ in identities} if only_new else set()
            known_ids = {github_id for _, github_id in identities} if only_new else set()
            exclusions = get_settings().repository_exclusions
            for name in sorted(set(names)):
                if name.lower() in known or name.lower() in exclusions or name in completed:
                    continue
                try:
                    data = client.repository(name)
                    if data.github_id in known_ids:
                        continue
                    if data.is_fork or data.archived or data.disabled:
                        continue
                    _upsert_repository(session, data)
                    hydrated += 1
                    if only_new:
                        known.add(data.full_name.lower())
                        known_ids.add(data.github_id)
                    completed.add(name)
                    if job_key:
                        progress["completed"] = sorted(completed)
                        _save_progress(session, job_key, progress)
                    session.commit()
                except GitHubRateLimitError:
                    raise
                except GitHubClientError:
                    logger.warning("Repository hydration failed", extra={"repository": name})
            session.commit()
    finally:
        client.close()
    return hydrated


def _job_progress(session, job_key: str) -> dict[str, Any]:
    job = session.scalar(select(JobRun).where(JobRun.job_key == job_key))
    return dict(job.progress or {}) if job else {}


def _save_progress(session, job_key: str, progress: dict[str, Any]) -> None:
    job = session.scalar(select(JobRun).where(JobRun.job_key == job_key))
    if job:
        job.progress = progress


def _upsert_repository(session, data, repository: Repository | None = None) -> None:
    now = datetime.now(UTC)
    if repository is None:
        repository = session.scalar(select(Repository).where(Repository.github_id == data.github_id))
    if repository is None:
        repository = session.scalar(select(Repository).where(Repository.full_name == data.full_name))
    if repository is None:
        owner, name = data.full_name.split("/", maxsplit=1)
        repository = Repository(
            github_id=data.github_id,
            full_name=data.full_name,
            owner=owner,
            name=name,
            html_url=data.html_url,
            first_tracked_at=now,
            history_available_from=now,
            last_seen_at=now,
        )
        session.add(repository)
    else:
        repository.github_id = data.github_id
    repository.description = data.description
    repository.language = data.language
    repository.topics = data.topics
    repository.license_name = data.license_name
    repository.stars_count = data.stars_count
    repository.forks_count = data.forks_count
    repository.open_issues_count = data.open_issues_count
    repository.is_fork = data.is_fork
    repository.archived = data.archived
    repository.disabled = data.disabled
    repository.pushed_at = _parse_github_datetime(data.pushed_at)
    repository.github_created_at = _parse_github_datetime(data.created_at)
    repository.last_seen_at = now


def _capture_snapshots(captured_at: datetime) -> int:
    return SnapshotCollector(
        captured_at, get_sync_session, GitHubClient, _upsert_repository,
    ).run()


def _job_cancelled(job_key: str) -> bool:
    with get_sync_session() as session:
        return bool(session.scalar(select(JobRun.cancel_requested).where(JobRun.job_key == job_key)))


def _wait_for_quota(job_key: str, error: GitHubRateLimitError) -> None:
    with get_sync_session() as session:
        job = session.scalar(select(JobRun).where(JobRun.job_key == job_key))
        if job:
            job.status = "waiting"
            job.error_message = str(error)
            job.progress = dict(job.progress or {},
                wait_reason="secondary_rate_limit" if error.secondary else "quota_exhausted",
                resume_at=(datetime.now(UTC) + timedelta(seconds=error.retry_after)).isoformat(),
            )
            session.commit()


def _persist_ranking(session, period_days: int, as_of: datetime) -> int:
    repositories = session.scalars(
        select(Repository).where(
            Repository.is_fork.is_(False),
            Repository.archived.is_(False),
            Repository.disabled.is_(False),
        )
    ).all()
    series = []
    for repository in repositories:
        snapshots = session.scalars(
            select(RepoSnapshot)
            .where(
                RepoSnapshot.repository_id == repository.id,
                RepoSnapshot.captured_at <= as_of,
                RepoSnapshot.source == "github_api",
            )
            .order_by(RepoSnapshot.captured_at)
        ).all()
        series.append(
                RepositorySeries(
                    repository_id=repository.id,
                    full_name=repository.full_name,
                snapshots=tuple(
                    SnapshotPoint(snapshot.captured_at, snapshot.stars_count)
                        for snapshot in snapshots
                    ),
                    current_stars=repository.stars_count,
                )
        )
    results = calculate_ranking(series, period_days, as_of)
    previous_run = session.scalar(
        select(RankingRun)
        .where(RankingRun.period_days == period_days, RankingRun.as_of < as_of)
        .order_by(RankingRun.as_of.desc())
        .limit(1)
    )
    previous_ranks = (
        dict(
            session.execute(
                select(RankingItem.repository_id, RankingItem.rank).where(
                    RankingItem.ranking_run_id == previous_run.id
                )
            ).all()
        )
        if previous_run
        else {}
    )
    run = RankingRun(
        period_days=period_days,
        as_of=as_of,
        baseline_at=as_of - timedelta(days=period_days),
        config_version="v1",
        status="ready",
    )
    session.add(run)
    session.flush()
    session.add_all(
        [
            RankingItem(
                ranking_run_id=run.id,
                repository_id=result.repository_id,
                rank=rank,
                previous_rank=previous_ranks.get(result.repository_id),
                start_stars=result.start_stars,
                end_stars=result.end_stars,
                net_delta=result.net_delta,
                growth_rate=result.growth_rate,
                baseline_available=result.baseline_available,
            )
            for rank, result in enumerate(results, start=1)
        ]
    )
    return len(results)


@contextmanager
def _task_lock(key: str, timeout: int, required: bool = False) -> Iterator[bool]:
    client = Redis.from_url(
        get_settings().redis_url,
        socket_connect_timeout=0.5,
        socket_timeout=0.5,
    )
    lock = client.lock(f"lock:{key}", timeout=timeout, blocking_timeout=0)
    acquired = False
    owns_lock = False
    try:
        try:
            acquired = bool(lock.acquire(blocking=False))
            owns_lock = acquired
        except RedisError:
            if required:
                raise
            logger.warning("Redis lock unavailable; relying on database idempotency")
            acquired = True
        yield acquired
    finally:
        if owns_lock:
            try:
                lock.release()
            except (LockError, RedisError):
                pass
        client.close()


def _start_job(job_key: str, task_name: str) -> bool:
    with get_sync_session() as session:
        job = session.scalar(select(JobRun).where(JobRun.job_key == job_key))
        if job and (job.status in {"completed", "cancelled"} or job.cancel_requested):
            if job.cancel_requested and job.status != "completed":
                job.status = "cancelled"
                job.finished_at = datetime.now(UTC)
                session.commit()
            return False
        if job is None:
            job = JobRun(job_key=job_key, task_name=task_name, attempts=0)
            session.add(job)
        job.progress = {k: v for k, v in (job.progress or {}).items()
                        if k not in {"wait_reason", "resume_at"}}
        job.status = "running"
        job.attempts += 1
        job.error_message = None
        job.started_at = datetime.now(UTC)
        job.finished_at = None
        session.commit()
        return True


def _finish_job(job_key: str, status: str, message: str | None = None) -> None:
    with get_sync_session() as session:
        job = session.scalar(select(JobRun).where(JobRun.job_key == job_key))
        if job is None:
            return
        job.status = status
        job.error_message = message[:2000] if message else None
        job.finished_at = datetime.now(UTC)
        session.commit()


def _record_discovery_run(
    started_at: datetime,
    count: int,
    status: str,
    message: str | None = None,
) -> None:
    with get_sync_session() as session:
        session.add(
            DiscoveryRun(
                source="trending-search-seeds",
                config_version="v1",
                discovered_count=count,
                status=status,
                error_message=message[:2000] if message else None,
                started_at=started_at,
                finished_at=datetime.now(UTC),
            )
        )
        session.commit()


def _record_failed_job(job_key: str, task_name: str, message: str) -> None:
    with get_sync_session() as session:
        job = session.scalar(select(JobRun).where(JobRun.job_key == job_key))
        if job is None:
            job = JobRun(
                job_key=job_key,
                task_name=task_name,
                attempts=1,
                started_at=datetime.now(UTC),
            )
            session.add(job)
        job.status = "failed"
        job.error_message = message[:2000]
        job.finished_at = datetime.now(UTC)
        session.commit()


def _parse_as_of(value: str | None) -> datetime:
    if value:
        parsed = datetime.fromisoformat(value)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return datetime.now(UTC).replace(hour=2, minute=0, second=0, microsecond=0)


def _parse_github_datetime(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None
