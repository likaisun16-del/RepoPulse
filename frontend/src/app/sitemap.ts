import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/ranking`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/methodology`, changeFrequency: "monthly", priority: 0.6 },
  ];
}

