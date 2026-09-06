"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Minus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

import { RepositoryAvatar } from "@/components/repository-avatar";
import { rankingApiUrl } from "@/lib/api";
import { formatCompact, formatDate, formatNumber, formatPercent, rankMovement } from "@/lib/format";
import { getRepositoryDescription } from "@/lib/repository-copy";
import type { FilterResponse, Period, RankingFilters, RankingItem, RankingResponse } from "@/lib/types";

interface RankingExplorerProps {
  initialData: RankingResponse | null;
  filterOptions: FilterResponse;
  initialFilters: RankingFilters;
  initialError?: string;
}

const PERIODS: Period[] = [1, 7, 14, 30];
const PAGE_SIZE_OPTIONS = [15, 25, 50];
const MIN_STAR_OPTIONS = [
  { value: 0, label: "不限 Star" },
  { value: 100, label: "100+ Star" },
  { value: 1000, label: "1,000+ Star" },
  { value: 10000, label: "10,000+ Star" },
];

export function RankingExplorer({
  initialData,
  filterOptions,
  initialFilters,
  initialError,
}: RankingExplorerProps) {
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState(initialFilters);
  const [searchValue, setSearchValue] = useState(initialFilters.q ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const requestId = useRef(0);

  async function applyFilters(changes: Partial<RankingFilters>) {
    const nextFilters = { ...filters, ...changes };
    const currentRequest = ++requestId.current;
    setFilters(nextFilters);
    setLoading(true);
    setError("");
    syncUrl(nextFilters);
    try {
      const response = await fetch(rankingApiUrl(nextFilters, true));
      const payload = (await response.json()) as RankingResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "榜单加载失败");
      }
      if (currentRequest === requestId.current) setData(payload as RankingResponse);
    } catch (requestError) {
      if (currentRequest === requestId.current) {
        setError(requestError instanceof Error ? requestError.message : "榜单加载失败");
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void applyFilters({ q: searchValue.trim() || undefined, page: 1 });
  }

  const leader = data?.data[0];
  const averageGrowth = data?.data.length
    ? Math.round(data.data.reduce((sum, item) => sum + item.star_delta, 0) / data.data.length)
    : 0;

  return (
    <main>
      <section className="page-intro">
        <div className="shell intro-grid">
          <div>
            <div className="eyebrow">
              <span className="live-dot" />
              每日更新 · 可解释排名
            </div>
            <h1>开源项目增长榜</h1>
            <p>追踪候选项目真实 Star 净增长，发现近期值得关注的开源作品。</p>
          </div>
          <div className="freshness" aria-label="数据状态">
            <Clock3 size={17} />
            <div>
              <span>数据截止</span>
              <strong>{data ? formatDate(data.meta.as_of, true) : "等待数据"}</strong>
            </div>
            {data?.meta.data_mode === "demo" && <span className="demo-badge">演示数据</span>}
          </div>
        </div>
      </section>

      <section className="ranking-workspace">
        <div className="shell">
          <div className="period-row">
            <div className="segmented-control" role="group" aria-label="榜单周期">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  className={filters.period === period ? "selected" : ""}
                  aria-pressed={filters.period === period}
                  onClick={() => void applyFilters({ period, page: 1 })}
                >
                  {period} 天
                </button>
              ))}
            </div>
            <p className="coverage-copy">
              <Database size={15} />
              当前覆盖 <strong>{formatNumber(data?.meta.coverage ?? 0)}</strong> 个候选仓库
            </p>
          </div>

          <div className="stat-strip">
            <div className="stat-item">
              <span className="stat-icon blue"><TrendingUp size={18} /></span>
              <div><span>本期领跑</span><strong>{leader?.name ?? "--"}</strong></div>
            </div>
            <div className="stat-item">
              <span className="stat-icon green"><Star size={18} /></span>
              <div><span>最高增长</span><strong>+{formatNumber(leader?.star_delta ?? 0)}</strong></div>
            </div>
            <div className="stat-item">
              <span className="stat-icon amber"><Sparkles size={18} /></span>
              <div><span>榜单平均增长</span><strong>+{formatNumber(averageGrowth)}</strong></div>
            </div>
          </div>

          <div className="filter-bar">
            <div className="filter-title"><SlidersHorizontal size={16} /> 筛选</div>
            <select
              aria-label="编程语言"
              value={filters.language ?? ""}
              onChange={(event) => void applyFilters({ language: event.target.value || undefined, page: 1 })}
            >
              <option value="">全部语言</option>
              {filterOptions.languages.map((option) => (
                <option key={option.value} value={option.value}>{option.label} ({option.count})</option>
              ))}
            </select>
            <select
              aria-label="项目主题"
              value={filters.topic ?? ""}
              onChange={(event) => void applyFilters({ topic: event.target.value || undefined, page: 1 })}
            >
              <option value="">全部主题</option>
              {filterOptions.topics.map((option) => (
                <option key={option.value} value={option.value}>{option.label} ({option.count})</option>
              ))}
            </select>
            <select
              aria-label="最低 Star"
              value={filters.minStars ?? 0}
              onChange={(event) => void applyFilters({ minStars: Number(event.target.value), page: 1 })}
            >
              {MIN_STAR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              aria-label="每页数量"
              value={filters.limit ?? 15}
              onChange={(event) => void applyFilters({ limit: Number(event.target.value), page: 1 })}
            >
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>每页 {size} 条</option>)}
            </select>
            <form className="search-form" onSubmit={handleSearch}>
              <Search size={16} aria-hidden="true" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="搜索仓库或简介"
                aria-label="搜索仓库或简介"
              />
              <button type="submit">搜索</button>
            </form>
          </div>

          <div className={`ranking-panel ${loading ? "loading" : ""}`} aria-busy={loading}>
            <div className="panel-heading">
              <div>
                <h2>{filters.period} 天增长排行</h2>
                <p>按周期内 Star 净增长降序排列</p>
              </div>
              <span>共 {formatNumber(data?.meta.total ?? 0)} 个结果</span>
            </div>

            {error ? <ErrorState message={error} onRetry={() => void applyFilters({})} /> : null}
            {!error && data?.data.length ? <RankingTable items={data.data} period={filters.period} /> : null}
            {!error && !data?.data.length ? <EmptyState /> : null}

            {data && data.meta.total > data.meta.limit ? (
              <Pagination
                page={data.meta.page}
                limit={data.meta.limit}
                total={data.meta.total}
                onChange={(page) => void applyFilters({ page })}
              />
            ) : null}
            {loading && <div className="loading-line" />}
          </div>
        </div>
      </section>
    </main>
  );
}

function RankingTable({ items, period }: { items: RankingItem[]; period: Period }) {
  return (
    <>
      <div className="desktop-table-wrap">
        <table className="ranking-table">
          <thead><tr><th>排名</th><th>项目</th><th>语言</th><th>当前 Star</th><th>{period} 天增长</th><th>增长率</th><th>更新</th><th><span className="sr-only">操作</span></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.full_name}>
                <td><RankCell item={item} /></td>
                <td><RepositoryCell item={item} /></td>
                <td><LanguageBadge language={item.language} /></td>
                <td className="numeric">{formatCompact(item.total_stars)}</td>
                <td className={`numeric growth ${item.baseline_available ? "" : "no-growth"}`}>
                  {item.baseline_available ? `+${formatNumber(item.star_delta)}` : "无增长"}
                </td>
                <td className="numeric rate">{formatPercent(item.growth_rate)}</td>
                <td className="updated">{formatDate(item.last_updated_at)}</td>
                <td><Link className="row-link" href={`/repo/${item.owner}/${item.name}`} aria-label={`查看 ${item.name}`}><ArrowUpRight size={17} /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-ranking-list">
        {items.map((item) => (
          <Link className="mobile-repo" href={`/repo/${item.owner}/${item.name}`} key={item.full_name}>
            <div className="mobile-rank"><RankCell item={item} /></div>
            <RepositoryAvatar owner={item.owner} size={42} />
            <div className="mobile-main"><strong>{item.name}</strong><span><LanguageBadge language={item.language} /> · {formatCompact(item.total_stars)} Star</span></div>
            <div className={`mobile-growth ${item.baseline_available ? "" : "no-growth"}`}>
              <strong>{item.baseline_available ? `+${formatCompact(item.star_delta)}` : "无增长"}</strong>
              <span>{item.baseline_available ? `${period} 天` : "无基线"}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function RankCell({ item }: { item: RankingItem }) {
  const movement = rankMovement(item.rank, item.previous_rank ?? null);
  return (
    <div className={`rank-cell rank-${item.rank}`}>
      <strong>{String(item.rank).padStart(2, "0")}</strong>
      <span className={movement && movement > 0 ? "up" : movement && movement < 0 ? "down" : "flat"}>
        {movement === null || movement === 0 ? <Minus size={11} /> : movement > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
        {movement ? Math.abs(movement) : ""}
      </span>
    </div>
  );
}

function RepositoryCell({ item }: { item: RankingItem }) {
  return (
    <div className="repo-cell">
      <RepositoryAvatar owner={item.owner} size={46} />
      <div>
        <Link href={`/repo/${item.owner}/${item.name}`}>{item.name}</Link>
        <p>{getRepositoryDescription(item)}</p>
      </div>
    </div>
  );
}

function LanguageBadge({ language }: { language: string | null }) {
  if (!language) return <span className="language muted">未知</span>;
  const slug = language.toLowerCase().replaceAll("+", "p").replaceAll("#", "sharp");
  return <span className={`language language-${slug}`}><i />{language}</span>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="state-block error-state"><strong>榜单暂时没有响应</strong><p>{message}</p><button type="button" onClick={onRetry}>重新加载</button></div>;
}

function EmptyState() {
  return <div className="state-block"><Search size={24} /><strong>没有符合条件的项目</strong><p>调整语言、主题或最低 Star 条件后再试。</p></div>;
}

function Pagination({ page, limit, total, onChange }: { page: number; limit: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.ceil(total / limit);
  return <div className="pagination"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="上一页"><ChevronLeft size={17} /></button><span>第 {page} / {pages} 页</span><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="下一页"><ChevronRight size={17} /></button></div>;
}

function syncUrl(filters: RankingFilters) {
  const params = new URLSearchParams();
  params.set("period", String(filters.period));
  if (filters.language) params.set("language", filters.language);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.minStars) params.set("minStars", String(filters.minStars));
  if (filters.q) params.set("q", filters.q);
  if (filters.limit && filters.limit !== 15) params.set("limit", String(filters.limit));
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
}
