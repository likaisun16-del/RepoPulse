from dataclasses import dataclass
from itertools import cycle
from threading import Lock
from typing import Any

import httpx
from bs4 import BeautifulSoup

from app.config import get_settings


class GitHubClientError(RuntimeError):
    pass


class GitHubRateLimitError(GitHubClientError):
    pass


@dataclass(frozen=True)
class GitHubRepositoryData:
    github_id: int
    full_name: str
    description: str | None
    html_url: str
    language: str | None
    topics: list[str]
    license_name: str | None
    stars_count: int
    forks_count: int
    open_issues_count: int
    is_fork: bool
    archived: bool
    disabled: bool
    pushed_at: str | None
    created_at: str | None


class GitHubClient:
    def __init__(self, transport: httpx.BaseTransport | None = None) -> None:
        settings = get_settings()
        self._tokens = cycle(settings.github_tokens or [""])
        self._token_lock = Lock()
        self._etag_cache: dict[str, tuple[str, dict[str, Any]]] = {}
        self._client = httpx.Client(
            base_url="https://api.github.com",
            timeout=20,
            follow_redirects=True,
            transport=transport,
            headers={"Accept": "application/vnd.github+json", "User-Agent": "RepoPulse/0.1"},
        )

    def close(self) -> None:
        self._client.close()

    def trending(self, since: str) -> list[str]:
        response = self._client.get(
            "https://github.com/trending",
            params={"since": since},
            headers={"User-Agent": "RepoPulse/0.1"},
        )
        self._raise_for_status(response)
        soup = BeautifulSoup(response.text, "html.parser")
        repositories: list[str] = []
        for article in soup.select("article.Box-row"):
            link = article.select_one("h2 a")
            if link and link.get("href"):
                repositories.append(str(link["href"]).strip().strip("/").replace(" ", ""))
        return repositories

    def search(self, query: str, per_page: int = 100, max_pages: int = 1) -> list[str]:
        repositories: list[str] = []
        seen: set[str] = set()
        for page in range(1, max_pages + 1):
            payload = self._get_json(
                "/search/repositories",
                params={
                    "q": query,
                    "sort": "stars",
                    "order": "desc",
                    "per_page": per_page,
                    "page": page,
                },
            )
            items = payload.get("items", [])
            for item in items:
                full_name = str(item["full_name"])
                if full_name not in seen:
                    repositories.append(full_name)
                    seen.add(full_name)
            if len(items) < per_page or len(repositories) >= int(payload.get("total_count", 0)):
                break
        return repositories

    def repository(self, full_name: str) -> GitHubRepositoryData:
        payload = self._get_json(f"/repos/{full_name}")
        license_data = payload.get("license") or {}
        return GitHubRepositoryData(
            github_id=int(payload["id"]),
            full_name=str(payload["full_name"]),
            description=payload.get("description"),
            html_url=str(payload["html_url"]),
            language=payload.get("language"),
            topics=list(payload.get("topics", [])),
            license_name=license_data.get("spdx_id"),
            stars_count=int(payload.get("stargazers_count", 0)),
            forks_count=int(payload.get("forks_count", 0)),
            open_issues_count=int(payload.get("open_issues_count", 0)),
            is_fork=bool(payload.get("fork", False)),
            archived=bool(payload.get("archived", False)),
            disabled=bool(payload.get("disabled", False)),
            pushed_at=payload.get("pushed_at"),
            created_at=payload.get("created_at"),
        )

    def _get_json(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        headers = self._auth_headers()
        cache_key = f"{path}:{params or {}}"
        cached = self._etag_cache.get(cache_key)
        if cached:
            headers["If-None-Match"] = cached[0]
        response = self._client.get(path, params=params, headers=headers)
        if response.status_code == 304 and cached:
            return cached[1]
        self._raise_for_status(response)
        payload = response.json()
        if not isinstance(payload, dict):
            raise GitHubClientError("GitHub API returned an unexpected response")
        if etag := response.headers.get("etag"):
            self._etag_cache[cache_key] = (etag, payload)
        return payload

    def _auth_headers(self) -> dict[str, str]:
        with self._token_lock:
            token = next(self._tokens)
        return {"Authorization": f"Bearer {token}"} if token else {}

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        if response.status_code in {403, 429}:
            raise GitHubRateLimitError("GitHub API rate limit reached")
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise GitHubClientError(f"GitHub request failed: {response.status_code}") from exc
