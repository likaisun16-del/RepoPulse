"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PUBLIC_API_BASE } from "@/lib/api";
import { formatCompact, formatDate, formatNumber } from "@/lib/format";
import type { ChartRange, SnapshotPoint } from "@/lib/types";

interface StarChartProps {
  owner: string;
  name: string;
  initialData: SnapshotPoint[];
}

const RANGES: { value: ChartRange; label: string }[] = [
  { value: "30d", label: "30 天" },
  { value: "90d", label: "90 天" },
  { value: "365d", label: "1 年" },
];

export function StarChart({ owner, name, initialData }: StarChartProps) {
  const [range, setRange] = useState<ChartRange>("90d");
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  async function selectRange(nextRange: ChartRange) {
    setRange(nextRange);
    setLoading(true);
    try {
      const response = await fetch(
        `${PUBLIC_API_BASE}/api/v1/repos/${owner}/${name}/snapshots?range=${nextRange}`,
      );
      if (!response.ok) return;
      const payload = (await response.json()) as { data: SnapshotPoint[] };
      setData(payload.data);
    } finally {
      setLoading(false);
    }
  }

  const chartData = data.map((point) => ({
    date: point.captured_at,
    label: formatDate(point.captured_at),
    stars: point.stars_count,
  }));
  const gained = chartData.length > 1
    ? chartData[chartData.length - 1].stars - chartData[0].stars
    : 0;

  return (
    <div className={`chart-tool ${loading ? "loading" : ""}`}>
      <div className="chart-heading">
        <div>
          <span>Star 趋势</span>
          <strong>+{formatNumber(gained)}</strong>
          <small>所选时间内净增长</small>
        </div>
        <div className="chart-range" role="group" aria-label="图表时间范围">
          {RANGES.map((item) => (
            <button
              type="button"
              key={item.value}
              className={range === item.value ? "selected" : ""}
              aria-pressed={range === item.value}
              onClick={() => void selectRange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 14, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              minTickGap={50}
              tick={{ fill: "var(--faint)", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={54}
              tickFormatter={formatCompact}
              tick={{ fill: "var(--faint)", fontSize: 11 }}
              domain={["dataMin", "dataMax"]}
            />
            <Tooltip
              contentStyle={{
                color: "var(--ink)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--surface)",
                boxShadow: "var(--shadow-sm)",
              }}
              formatter={(value) => [formatNumber(Number(value)), "Star"]}
              labelStyle={{ color: "var(--muted)", marginBottom: 6 }}
            />
            <Area
              type="monotone"
              dataKey="stars"
              stroke="var(--blue)"
              strokeWidth={2.5}
              fill="var(--blue-soft)"
              fillOpacity={0.68}
              activeDot={{ r: 4, fill: "var(--blue)", stroke: "var(--surface)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-source">数据来源：RepoPulse 每日 GitHub 仓库快照</p>
    </div>
  );
}
