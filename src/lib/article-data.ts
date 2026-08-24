import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type ArticleBlock = {
  id: string;
  type: "heading" | "paragraph" | "image" | "imageText" | "quote" | "list" | "callout" | "faq" | "table" | "divider" | "cta";
  data: Record<string, string | string[] | string[][] | boolean | number | null> & { fileId?: string | null };
};

export type ArticleRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  keywords: string[];
  content: ArticleBlock[];
  hero_file_id: string | null;
  author_id: string;
  status: string;
  reading_minutes: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  heroUrl: string | null;
  imageUrls: Record<string, string>;
};

export function articleImageUrl(file?: { bucket?: string; path?: string } | null) {
  if (!file?.bucket || !file.path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${encodeURIComponent(file.bucket)}/${file.path.split("/").map(encodeURIComponent).join("/")}`;
}

async function hydrateArticles(rows: Omit<ArticleRecord, "heroUrl" | "imageUrls">[]) {
  const fileIds = [...new Set(rows.flatMap((row) => [row.hero_file_id, ...row.content.map((block) => typeof block.data.fileId === "string" ? block.data.fileId : null)]).filter((id): id is string => Boolean(id)))];
  const { data: files, error } = fileIds.length
    ? await createSupabaseAdmin().from("storage_files").select("id,bucket,path").in("id", fileIds)
    : { data: [], error: null };
  if (error) throw new Error(error.message);
  const urls = new Map((files || []).map((file) => [file.id, articleImageUrl(file)]));
  return rows.map((row) => ({
    ...row,
    heroUrl: row.hero_file_id ? urls.get(row.hero_file_id) || null : null,
    imageUrls: Object.fromEntries(row.content.flatMap((block) => typeof block.data.fileId === "string" ? [[block.id, urls.get(block.data.fileId) || ""]] : [])),
  }));
}

export async function getAdminArticles() {
  const { data, error } = await createSupabaseAdmin().from("articles").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return hydrateArticles((data || []) as Omit<ArticleRecord, "heroUrl" | "imageUrls">[]);
}

export async function getPublishedArticles() {
  const { data, error } = await createSupabaseAdmin().from("articles").select("*").eq("status", "PUBLISHED").lte("published_at", new Date().toISOString()).order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return hydrateArticles((data || []) as Omit<ArticleRecord, "heroUrl" | "imageUrls">[]);
}

export async function getPublishedArticle(slug: string) {
  const { data, error } = await createSupabaseAdmin().from("articles").select("*").eq("slug", slug).eq("status", "PUBLISHED").lte("published_at", new Date().toISOString()).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return (await hydrateArticles([data as Omit<ArticleRecord, "heroUrl" | "imageUrls">]))[0];
}
