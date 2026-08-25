import type { MetadataRoute } from "next";
import { getPublishedArticles } from "@/lib/article-data";

// Liara injects Supabase secrets at container runtime, not during image build.
// Keep the metadata route dynamic so article URLs are read from the live DB.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://chaplly.ir").replace(/\/$/, "");
  let articles: Awaited<ReturnType<typeof getPublishedArticles>> = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    try {
      articles = await getPublishedArticles();
    } catch (error) {
      console.error("Sitemap article lookup failed", error);
    }
  }
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...articles.map((article) => ({ url: `${base}/blog/${encodeURIComponent(article.slug)}`, lastModified: new Date(article.updated_at), changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
