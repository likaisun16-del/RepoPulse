import type { Metadata } from "next";

import { RankingPage } from "@/components/ranking-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "开源项目增长榜",
  alternates: { canonical: "/" },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RankingPage searchParams={searchParams} />;
}

