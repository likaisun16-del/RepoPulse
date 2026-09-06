import type { components } from "@/lib/openapi";

export type Period = components["schemas"]["PeriodDays"];
export type ChartRange = components["schemas"]["SnapshotSeriesResponse"]["range"];
export type RankingItem = components["schemas"]["RankingItemResponse"];
export type RankingResponse = components["schemas"]["RankingResponse"];
export type FilterResponse = components["schemas"]["FilterResponse"];
export type FilterOption = components["schemas"]["FilterOption"];
export type Repository = components["schemas"]["RepositoryResponse"];
export type SnapshotPoint = components["schemas"]["SnapshotResponse"];
export type SnapshotSeriesResponse = components["schemas"]["SnapshotSeriesResponse"];

export interface RankingFilters {
  period: Period;
  language?: string;
  topic?: string;
  minStars?: number;
  q?: string;
  page?: number;
  limit?: number;
}
