from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import ChartRange, ReadmeResponse, RepositoryResponse, SnapshotSeriesResponse
from app.services.catalog import CatalogService

router = APIRouter(tags=["repositories"])


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
