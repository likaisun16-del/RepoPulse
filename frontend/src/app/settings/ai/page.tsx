import type { Metadata } from "next";
import { AiSettings } from "@/components/ai-settings";
import { safeAiReturnTo } from "@/lib/ai/storage";

export const metadata: Metadata = { title: "大模型设置", robots: { index: false, follow: false } };
export default async function AiSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <AiSettings returnTo={safeAiReturnTo(typeof query.returnTo === "string" ? query.returnTo : null)} />;
}
