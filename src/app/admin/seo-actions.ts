"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { uploadStorageImage } from "@/lib/supabase/storage-upload";
import { insertStorageFileDirect } from "@/lib/postgres";
import type { ArticleBlock } from "@/lib/article-data";
import type { Json } from "@/types/database";

export type ArticleActionState = { ok: boolean; message: string };

const slugify = (value: string) => value.trim().toLocaleLowerCase("fa").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 100);
const plainWords = (blocks: ArticleBlock[]) => blocks.flatMap((block) => Object.values(block.data)).flat(2).join(" ").trim().split(/\s+/).filter(Boolean).length;

export async function saveArticleAction(_: ArticleActionState, formData: FormData): Promise<ArticleActionState> {
  const adminUser = await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const seoTitle = String(formData.get("seoTitle") || title).trim();
  const seoDescription = String(formData.get("seoDescription") || excerpt).trim();
  const intent = String(formData.get("intent") || "draft");
  const slug = slugify(String(formData.get("slug") || title));
  let blocks: ArticleBlock[];
  try { blocks = JSON.parse(String(formData.get("content") || "[]")) as ArticleBlock[]; } catch { return { ok: false, message: "ساختار محتوای مقاله معتبر نیست." }; }
  if (title.length < 3 || !slug) return { ok: false, message: "عنوان و آدرس مقاله را کامل کنید." };
  if (excerpt.length < 20 || seoDescription.length < 50) return { ok: false, message: "خلاصه و توضیحات SEO را کامل‌تر بنویسید." };
  if (!blocks.length) return { ok: false, message: "حداقل یک بخش محتوایی به مقاله اضافه کنید." };
  if (intent === "publish") {
    if (!blocks.some((block) => block.type === "heading")) return { ok: false, message: "برای ساختار SEO حداقل یک عنوان میانی H2 اضافه کنید." };
    if (blocks.some((block) => ["image", "imageText"].includes(block.type) && String(block.data.alt || "").trim().length < 3)) return { ok: false, message: "برای همه بخش‌های تصویری متن جایگزین دقیق (alt) وارد کنید." };
    if (blocks.some((block) => ["image", "imageText"].includes(block.type) && !block.data.fileId && (!(formData.get(`blockImage:${block.id}`) instanceof File) || !(formData.get(`blockImage:${block.id}`) as File).size))) return { ok: false, message: "برای همه بخش‌های تصویری یک فایل انتخاب کنید." };
    if (plainWords(blocks) < 120) return { ok: false, message: "مقاله برای انتشار خیلی کوتاه است؛ حداقل ۱۲۰ کلمه محتوای مفید بنویسید." };
    const submittedHero = formData.get("heroImage");
    if ((!(submittedHero instanceof File) || !submittedHero.size) && !String(formData.get("heroBlockId") || "")) return { ok: false, message: "برای انتشار، تصویر اصلی را آپلود یا از تصاویر مقاله انتخاب کنید." };
  }
  try {
    const db = createSupabaseAdmin();
    const upload = async (file: File) => {
      if (file.size > 15 * 1024 * 1024) throw new Error("حجم هر تصویر باید کمتر از ۱۵ مگابایت باشد.");
      const uploaded = await uploadStorageImage(file, "catalog-assets", `articles/${adminUser.id}/${randomUUID()}-${file.name}`, { maxDimension: 2200, quality: 86 });
      return insertStorageFileDirect({ ownerUserId: adminUser.id, bucket: "catalog-assets", path: uploaded.path, kind: "ARTICLE_IMAGE", originalName: file.name, mimeType: uploaded.mimeType, sizeBytes: uploaded.sizeBytes });
    };
    for (const block of blocks) {
      const file = formData.get(`blockImage:${block.id}`);
      if (file instanceof File && file.size) block.data.fileId = await upload(file);
    }
    const heroFile = formData.get("heroImage");
    let heroFileId = heroFile instanceof File && heroFile.size ? await upload(heroFile) : null;
    const heroBlockId = String(formData.get("heroBlockId") || "");
    if (!heroFileId && heroBlockId) heroFileId = String(blocks.find((block) => block.id === heroBlockId)?.data.fileId || "") || null;
    if (intent === "publish" && !heroFileId) return { ok: false, message: "برای انتشار، تصویر اصلی را آپلود یا از تصاویر مقاله انتخاب کنید." };
    const keywords = String(formData.get("keywords") || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
    const status = intent === "publish" ? "PUBLISHED" : "DRAFT";
    const { error } = await db.from("articles").insert({
      slug, title, excerpt, seo_title: seoTitle.slice(0, 70), seo_description: seoDescription.slice(0, 170), keywords,
      content: blocks as unknown as Json, hero_file_id: heroFileId, author_id: adminUser.id, status,
      reading_minutes: Math.max(1, Math.ceil(plainWords(blocks) / 220)), published_at: status === "PUBLISHED" ? new Date().toISOString() : null,
    });
    if (error) return { ok: false, message: error.code === "23505" ? "این آدرس مقاله قبلاً استفاده شده است." : error.message };
  } catch (error) {
    console.error("Article save failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "ذخیره مقاله انجام نشد." };
  }
  revalidatePath("/admin/seo"); revalidatePath("/blog"); revalidatePath(`/blog/${slug}`);
  redirect(intent === "publish" ? `/blog/${slug}` : "/admin/seo");
}
