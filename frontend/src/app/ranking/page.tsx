import type { Metadata } from "next";

import { RankingPage } from "@/components/ranking-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GitHub Star 增长排行",
  description: "按 1、7、14 或 30 天 Star 净增长筛选近期热门 GitHub 项目。",
  alternates: { canonical: "/ranking" },
};

export default async function Ranking({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RankingPage searchParams={searchParams} />;
}
