import httpx
import pytest

from app.clients.github import GitHubClient, GitHubRateLimitError


def test_parses_github_trending_html() -> None:
    html = """
    <article class="Box-row"><h2><a href=" /owner/repo ">repo</a></h2></article>
    <article class="Box-row"><h2><a href="/second/project">project</a></h2></article>
    """
    client = GitHubClient(httpx.MockTransport(lambda _: httpx.Response(200, text=html)))

    try:
        assert client.trending("weekly") == ["owner/repo", "second/project"]
    finally:
        client.close()


def test_search_follows_pages_and_deduplicates() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        page = int(request.url.params["page"])
        items = (
            [{"full_name": "owner/one"}, {"full_name": "owner/two"}]
            if page == 1
            else [{"full_name": "owner/two"}, {"full_name": "owner/three"}]
        )
        return httpx.Response(200, json={"total_count": 4, "items": items})

    client = GitHubClient(httpx.MockTransport(handler))
    try:
        result = client.search("language:Python", per_page=2, max_pages=2)
    finally:
        client.close()

    assert result == ["owner/one", "owner/two", "owner/three"]


def test_reuses_etag_payload_after_not_modified() -> None:
    requests = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        if requests == 2:
            assert request.headers["if-none-match"] == '"repo-v1"'
            return httpx.Response(304)
        return httpx.Response(
            200,
            headers={"etag": '"repo-v1"'},
            json={
                "id": 1,
                "full_name": "owner/repo",
                "html_url": "https://github.com/owner/repo",
                "stargazers_count": 100,
                "forks_count": 10,
                "open_issues_count": 2,
            },
        )

    client = GitHubClient(httpx.MockTransport(handler))
    try:
        first = client.repository("owner/repo")
        second = client.repository("owner/repo")
    finally:
        client.close()

    assert requests == 2
    assert first == second


@pytest.mark.parametrize("status_code", [403, 429])
def test_converts_rate_limit_responses(status_code: int) -> None:
    client = GitHubClient(
        httpx.MockTransport(lambda _: httpx.Response(status_code, json={"message": "limited"}))
    )
    try:
        with pytest.raises(GitHubRateLimitError, match="rate limit"):
            client.search("stars:>100")
    finally:
        client.close()
