"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { uploadStorageImage } from "@/lib/supabase/storage-upload";
import { insertStorageFileDirect } from "@/lib/postgres";
import { clearMarketplaceMemoryCache } from "@/lib/catalog-data";
import type { ActionResult } from "@/app/actions/dashboard";

const fail = (message: string): ActionResult => ({ ok: false, message });
const ok = (message: string, id?: string): ActionResult => ({ ok: true, message, id });
const slug = (value: FormDataEntryValue | null) => String(value || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

async function imageId(formData: FormData, ownerUserId: string, kind: "CATEGORY_IMAGE" | "GRAPHIC_STYLE_IMAGE") {
  const image = formData.get("image");
  if (!(image instanceof File) || !image.size) return null;
  if (!image.type.startsWith("image/")) throw new Error("فایل اصلی باید تصویر باشد.");
  if (image.size > 10 * 1024 * 1024) throw new Error("حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد.");
  const path = `${ownerUserId}/taxonomy/${randomUUID()}-${image.name.replace(/[^\w.-]+/g, "-")}`;
  const uploaded = await uploadStorageImage(image, "catalog-assets", path, { maxDimension: 1800, quality: 88 });
  return insertStorageFileDirect({ ownerUserId, bucket: "catalog-assets", path: uploaded.path, kind, originalName: image.name, mimeType: uploaded.mimeType, sizeBytes: uploaded.sizeBytes });
}

function refreshCatalog() {
  clearMarketplaceMemoryCache();
  revalidateTag("marketplace-home");
  revalidateTag("catalog");
  revalidatePath("/admin/catalog");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/seller/dashboard/products/new");
  revalidatePath("/supplier/dashboard/raw-products");
}

export async function saveCategoryAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const categorySlug = slug(formData.get("slug"));
  const description = String(formData.get("description") || "").trim();
  if (name.length < 2 || !categorySlug || description.length < 3) return fail("نام، اسلاگ انگلیسی و توضیح کوتاه الزامی است.");
  try {
    const fileId = await imageId(formData, admin.id, "CATEGORY_IMAGE");
    if (!id && !fileId) return fail("تصویر اصلی دسته‌بندی الزامی است.");
    const payload = { name, slug: categorySlug, description, parent_id: String(formData.get("parentId") || "") || null, status: String(formData.get("status") || "ACTIVE"), sort_order: Number(formData.get("sortOrder") || 0), ...(fileId ? { image_file_id: fileId } : {}) };
    const db = createSupabaseAdmin();
    const result = id ? await db.from("categories").update(payload).eq("id", id).select("id").single() : await db.from("categories").insert(payload).select("id").single();
    if (result.error) return fail(result.error.message);
    refreshCatalog();
    return ok(id ? "دسته‌بندی ویرایش شد." : "دسته‌بندی ساخته شد.", result.data.id);
  } catch (error) { return fail(error instanceof Error ? error.message : "ذخیره دسته‌بندی ناموفق بود."); }
}

export async function deleteCategoryAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await createSupabaseAdmin().from("categories").delete().eq("id", String(formData.get("id") || ""));
  if (error) return fail("این دسته‌بندی استفاده شده و قابل حذف نیست؛ ابتدا وابستگی‌های آن را جابه‌جا کن.");
  refreshCatalog();
  return ok("دسته‌بندی حذف شد.");
}

export async function saveGraphicStyleAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const styleSlug = slug(formData.get("slug"));
  const caption = String(formData.get("caption") || "").trim();
  if (name.length < 2 || !styleSlug || caption.length < 3) return fail("نام، اسلاگ انگلیسی و توضیح کوتاه الزامی است.");
  try {
    const fileId = await imageId(formData, admin.id, "GRAPHIC_STYLE_IMAGE");
    if (!id && !fileId) return fail("تصویر اصلی سبک گرافیکی الزامی است.");
    const payload = { name, slug: styleSlug, caption, status: String(formData.get("status") || "ACTIVE"), sort_order: Number(formData.get("sortOrder") || 0), ...(fileId ? { image_file_id: fileId } : {}) };
    const db = createSupabaseAdmin();
    const result = id ? await db.from("graphic_styles").update(payload).eq("id", id).select("id").single() : await db.from("graphic_styles").insert(payload).select("id").single();
    if (result.error) return fail(result.error.message);
    refreshCatalog();
    return ok(id ? "سبک گرافیکی ویرایش شد." : "سبک گرافیکی ساخته شد.", result.data.id);
  } catch (error) { return fail(error instanceof Error ? error.message : "ذخیره سبک گرافیکی ناموفق بود."); }
}

export async function deleteGraphicStyleAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await createSupabaseAdmin().from("graphic_styles").delete().eq("id", String(formData.get("id") || ""));
  if (error) return fail("این سبک در طراحی‌ها استفاده شده و قابل حذف نیست.");
  refreshCatalog();
  return ok("سبک گرافیکی حذف شد.");
}
