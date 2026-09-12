from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.avatar_cache import avatar_path, is_fresh
from app.database import async_session_factory, get_session
from app.models import Repository
from app.schemas import ChartRange, ReadmeResponse, RepositoryResponse, SnapshotSeriesResponse
from app.services.catalog import CatalogService
from app.task_queue import enqueue_avatar_refresh

router = APIRouter(tags=["repositories"])


@router.get("/avatars/{owner_id}")
async def get_avatar(owner_id: int, background_tasks: BackgroundTasks) -> Response:
    path = avatar_path(owner_id)
    if path.exists():
        if not is_fresh(path):
            background_tasks.add_task(enqueue_avatar_refresh, owner_id)
        return FileResponse(
            path,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=3600", "ETag": str(path.stat().st_mtime_ns)},
        )
    async with async_session_factory() as session:
        known = await session.scalar(
            select(Repository.owner_avatar_url).where(Repository.owner_github_id == owner_id)
        )
    if known:
        background_tasks.add_task(enqueue_avatar_refresh, owner_id)
    return Response(status_code=404, headers={"Cache-Control": "no-store"})


@router.get("/repos/{owner}/{name}", response_model=RepositoryResponse)
async def get_repository(
    owner: str,
    name: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RepositoryResponse:
    return await CatalogService(session).repository(owner, name)


@router.get("/repos/{owner}/{name}/readme", response_model=ReadmeResponse)
async def get_repository_readme(
    owner: str,
    name: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ReadmeResponse:
    return await CatalogService(session).readme(owner, name)


@router.get("/repos/{owner}/{name}/snapshots", response_model=SnapshotSeriesResponse)
async def get_repository_snapshots(
    owner: str,
    name: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    range_name: Annotated[ChartRange, Query(alias="range")] = "90d",
) -> SnapshotSeriesResponse:
    return await CatalogService(session).snapshot_series(owner, name, range_name)
