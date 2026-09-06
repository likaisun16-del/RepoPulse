from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import response_cache
from app.database import get_session
from app.schemas import FilterResponse, HealthResponse
from app.services.catalog import CatalogService

router = APIRouter(tags=["system"])


@router.get("/filters", response_model=FilterResponse)
async def get_filters(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FilterResponse:
    return await CatalogService(session).filters()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="api")


@router.get("/ready", response_model=HealthResponse)
async def readiness(
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> HealthResponse:
    await session.execute(text("SELECT 1"))
    redis_ready = await response_cache.ping()
    if not redis_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="degraded", service="api")
    return HealthResponse(status="ok", service="api")
