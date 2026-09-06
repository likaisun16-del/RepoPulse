from datetime import UTC, datetime, timedelta

import pytest

from app.ranking.calculator import RepositorySeries, SnapshotPoint, calculate_ranking

NOW = datetime(2026, 9, 6, tzinfo=UTC)


def series(
    repository_id: int,
    name: str,
    points: list[tuple[int, int]],
    current_stars: int | None = None,
) -> RepositorySeries:
    return RepositorySeries(
        repository_id=repository_id,
        full_name=name,
        snapshots=tuple(
            SnapshotPoint(captured_at=NOW - timedelta(days=days_ago), stars_count=stars)
            for days_ago, stars in points
        ),
        current_stars=current_stars,
    )


@pytest.mark.parametrize("period", [1, 7, 14, 30])
def test_calculates_supported_periods(period: int) -> None:
    repositories = [series(1, "owner/repo", [(period, 100), (0, 175)])]

    result = calculate_ranking(repositories, period, NOW)

    assert len(result) == 1
    assert result[0].net_delta == 75
    assert result[0].growth_rate == pytest.approx(0.75)


def test_sorts_by_delta_then_growth_rate_then_name() -> None:
    repositories = [
        series(1, "z/repo", [(7, 100), (0, 150)]),
        series(2, "a/repo", [(7, 200), (0, 250)]),
        series(3, "leader/repo", [(7, 100), (0, 180)]),
    ]

    result = calculate_ranking(repositories, 7, NOW)

    assert [item.full_name for item in result] == ["leader/repo", "z/repo", "a/repo"]


def test_marks_series_without_recent_baseline_as_no_growth() -> None:
    stale = series(1, "owner/stale", [(9, 100), (0, 150)])

    result = calculate_ranking([stale], 7, NOW)

    assert len(result) == 1
    assert result[0].net_delta == 0
    assert result[0].baseline_available is False


def test_includes_series_without_snapshots_using_current_stars() -> None:
    result = calculate_ranking(
        [series(1, "owner/new", [], current_stars=240)],
        1,
        NOW,
    )

    assert len(result) == 1
    assert result[0].end_stars == 240
    assert result[0].net_delta == 0
    assert result[0].baseline_available is False


def test_sorts_no_baseline_after_baselined_series() -> None:
    repositories = [
        series(1, "owner/new", [], current_stars=1_000_000),
        series(2, "owner/growing", [(7, 100), (0, 110)]),
    ]

    result = calculate_ranking(repositories, 7, NOW)

    assert [item.full_name for item in result] == ["owner/growing", "owner/new"]


def test_allows_negative_growth_and_zero_baseline() -> None:
    repositories = [
        series(1, "owner/decrease", [(7, 100), (0, 90)]),
        series(2, "owner/new", [(7, 0), (0, 40)]),
    ]

    result = calculate_ranking(repositories, 7, NOW)

    new_repo = next(item for item in result if item.full_name == "owner/new")
    decreased = next(item for item in result if item.full_name == "owner/decrease")
    assert new_repo.growth_rate is None
    assert decreased.net_delta == -10


def test_rejects_unsupported_period() -> None:
    with pytest.raises(ValueError, match="unsupported ranking period"):
        calculate_ranking([], 10, NOW)
