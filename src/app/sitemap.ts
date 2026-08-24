import type { MetadataRoute } from "next";
import { getPublishedArticles } from "@/lib/article-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://chaplly.ir").replace(/\/$/, "");
  const articles = await getPublishedArticles();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...articles.map((article) => ({ url: `${base}/blog/${encodeURIComponent(article.slug)}`, lastModified: new Date(article.updated_at), changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
