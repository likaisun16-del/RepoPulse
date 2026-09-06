from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import PeriodDays, RankingResponse
from app.services.catalog import CatalogService

router = APIRouter(tags=["rankings"])


@router.get("/rankings", response_model=RankingResponse)
async def list_rankings(
    session: Annotated[AsyncSession, Depends(get_session)],
    period: PeriodDays = PeriodDays.SEVEN,
    language: str | None = None,
    topic: str | None = None,
    min_stars: Annotated[int, Query(alias="minStars", ge=0)] = 0,
    q: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 15,
) -> RankingResponse:
    return await CatalogService(session).rankings(
        period=period,
        language=language,
        topic=topic,
        min_stars=min_stars,
        query=q,
        page=page,
        limit=limit,
    )
