from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RankingItem, RankingRun, Repository, RepoSnapshot
from app.ranking.calculator import RepositorySeries, SnapshotPoint, calculate_ranking


@dataclass(frozen=True)
class DemoRepository:
    full_name: str
    description: str
    language: str
    topics: tuple[str, ...]
    total_stars: int
    forks: int
    daily_growth: int
    boost_7: int
    boost_14: int
    boost_30: int
    license_name: str


DEMO_REPOSITORIES = (
    DemoRepository(
        "ollama/ollama",
        "在本地快速运行和管理开源大语言模型。",
        "Go",
        ("ai", "llm", "local-first"),
        128_460,
        10_940,
        82,
        146,
        76,
        31,
        "MIT",
    ),
    DemoRepository(
        "astral-sh/uv",
        "使用 Rust 构建的极速 Python 包与项目管理工具。",
        "Rust",
        ("python", "developer-tools", "package-manager"),
        71_820,
        2_140,
        65,
        138,
        55,
        44,
        "Apache-2.0",
    ),
    DemoRepository(
        "langchain-ai/langgraph",
        "为可靠的智能体工作流构建有状态、多角色应用。",
        "Python",
        ("ai", "agents", "workflow"),
        24_730,
        4_120,
        42,
        106,
        88,
        27,
        "MIT",
    ),
    DemoRepository(
        "supabase/supabase",
        "开源的 Firebase 替代方案，提供数据库、认证与存储能力。",
        "TypeScript",
        ("database", "backend", "developer-tools"),
        84_650,
        8_220,
        54,
        59,
        50,
        38,
        "Apache-2.0",
    ),
    DemoRepository(
        "fastapi/fastapi",
        "现代、高性能且易于学习的 Python Web API 框架。",
        "Python",
        ("python", "api", "web-framework"),
        81_240,
        7_090,
        31,
        25,
        23,
        18,
        "MIT",
    ),
    DemoRepository(
        "vercel/next.js",
        "用于构建全栈 Web 应用的 React 框架。",
        "JavaScript",
        ("react", "web-framework", "frontend"),
        132_910,
        28_460,
        28,
        31,
        18,
        16,
        "MIT",
    ),
    DemoRepository(
        "openai/openai-python",
        "用于从 Python 应用访问 OpenAI API 的官方 SDK。",
        "Python",
        ("ai", "sdk", "api"),
        27_580,
        3_880,
        22,
        47,
        20,
        12,
        "Apache-2.0",
    ),
    DemoRepository(
        "rustdesk/rustdesk",
        "开源远程桌面应用，可替代商业远程控制工具。",
        "Rust",
        ("remote-desktop", "self-hosted", "privacy"),
        92_310,
        13_450,
        34,
        14,
        22,
        19,
        "AGPL-3.0",
    ),
    DemoRepository(
        "tauri-apps/tauri",
        "使用 Web 前端构建小巧、快速、安全的桌面应用。",
        "Rust",
        ("desktop", "rust", "frontend"),
        97_480,
        3_160,
        29,
        22,
        17,
        14,
        "Apache-2.0",
    ),
    DemoRepository(
        "denoland/deno",
        "JavaScript、TypeScript 和 WebAssembly 运行时。",
        "Rust",
        ("runtime", "typescript", "developer-tools"),
        102_760,
        5_570,
        19,
        9,
        12,
        11,
        "MIT",
    ),
    DemoRepository(
        "pytorch/pytorch",
        "面向研究与生产的开源机器学习框架。",
        "Python",
        ("machine-learning", "deep-learning", "ai"),
        94_210,
        25_880,
        17,
        12,
        8,
        7,
        "BSD-3-Clause",
    ),
    DemoRepository(
        "gohugoio/hugo",
        "使用 Go 构建的快速、灵活静态网站生成器。",
        "Go",
        ("static-site", "cms", "developer-tools"),
        82_950,
        7_640,
        13,
        5,
        7,
        6,
        "Apache-2.0",
    ),
)


async def seed_demo_data(session: AsyncSession) -> None:
    repository_count = int(await session.scalar(select(func.count(Repository.id))) or 0)
    if repository_count > 0:
        ranking_periods = set((await session.scalars(select(RankingRun.period_days))).all())
        if repository_count == len(DEMO_REPOSITORIES) and 1 not in ranking_periods:
            repositories = list(
                (await session.scalars(select(Repository).order_by(Repository.id))).all()
            )
            snapshots = list((await session.scalars(select(RepoSnapshot))).all())
            as_of = await session.scalar(select(func.max(RankingRun.as_of)))
            if as_of is not None:
                await _create_rankings(session, repositories, snapshots, as_of, periods=(1,))
                await session.commit()
        return

    as_of = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    repositories = [
        _create_repository(index, spec, as_of) for index, spec in enumerate(DEMO_REPOSITORIES)
    ]
    session.add_all(repositories)
    await session.flush()

    all_snapshots: list[RepoSnapshot] = []
    for repository, spec in zip(repositories, DEMO_REPOSITORIES, strict=True):
        all_snapshots.extend(_create_snapshots(repository.id, spec, as_of))
    session.add_all(all_snapshots)
    await session.flush()

    await _create_rankings(session, repositories, all_snapshots, as_of)
    await session.commit()


def _create_repository(index: int, spec: DemoRepository, as_of: datetime) -> Repository:
    owner, name = spec.full_name.split("/", maxsplit=1)
    return Repository(
        github_id=10_000_000 + index,
        full_name=spec.full_name,
        owner=owner,
        name=name,
        description=spec.description,
        html_url=f"https://github.com/{spec.full_name}",
        language=spec.language,
        topics=list(spec.topics),
        license_name=spec.license_name,
        stars_count=spec.total_stars,
        forks_count=spec.forks,
        open_issues_count=140 + index * 37,
        pushed_at=as_of - timedelta(hours=index * 3 + 2),
        github_created_at=as_of - timedelta(days=1_300 + index * 120),
        first_tracked_at=as_of - timedelta(days=365),
        last_seen_at=as_of,
        history_available_from=as_of - timedelta(days=365),
    )


def _create_snapshots(
    repository_id: int, spec: DemoRepository, as_of: datetime
) -> list[RepoSnapshot]:
    daily_increments = [_daily_increment(spec, days_ago) for days_ago in range(1, 366)]
    oldest_stars = max(0, spec.total_stars - sum(daily_increments))
    snapshots: list[RepoSnapshot] = []
    current_stars = oldest_stars
    increments_by_day = list(reversed(daily_increments))
    for day_index in range(366):
        if day_index > 0:
            current_stars += increments_by_day[day_index - 1]
        captured_at = as_of - timedelta(days=365 - day_index)
        snapshots.append(
            RepoSnapshot(
                repository_id=repository_id,
                snapshot_date=captured_at.date(),
                captured_at=captured_at,
                stars_count=current_stars,
                forks_count=max(
                    0, spec.forks - (365 - day_index) * max(1, spec.daily_growth // 18)
                ),
                source="demo",
            )
        )
    return snapshots


def _daily_increment(spec: DemoRepository, days_ago: int) -> int:
    increment = spec.daily_growth
    if days_ago <= 30:
        increment += spec.boost_30
    if days_ago <= 14:
        increment += spec.boost_14
    if days_ago <= 7:
        increment += spec.boost_7
    return increment


async def _create_rankings(
    session: AsyncSession,
    repositories: list[Repository],
    snapshots: list[RepoSnapshot],
    as_of: datetime,
    periods: tuple[int, ...] = (1, 7, 14, 30),
) -> None:
    snapshots_by_repository: dict[int, list[SnapshotPoint]] = {}
    for snapshot in snapshots:
        snapshots_by_repository.setdefault(snapshot.repository_id, []).append(
            SnapshotPoint(snapshot.captured_at, snapshot.stars_count)
        )
    series = [
        RepositorySeries(
            repository_id=repository.id,
            full_name=repository.full_name,
            snapshots=tuple(snapshots_by_repository[repository.id]),
        )
        for repository in repositories
    ]

    for period in periods:
        run = RankingRun(
            period_days=period,
            as_of=as_of,
            baseline_at=as_of - timedelta(days=period),
            config_version="demo-v1",
            status="ready",
        )
        session.add(run)
        await session.flush()
        results = calculate_ranking(series, period, as_of)
        session.add_all(
            [
                RankingItem(
                    ranking_run_id=run.id,
                    repository_id=result.repository_id,
                    rank=rank,
                    previous_rank=max(1, rank + ((rank % 3) - 1)),
                    start_stars=result.start_stars,
                    end_stars=result.end_stars,
                    net_delta=result.net_delta,
                    growth_rate=result.growth_rate,
                    baseline_available=result.baseline_available,
                )
                for rank, result in enumerate(results, start=1)
            ]
        )
