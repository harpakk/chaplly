import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const membership = user?.memberships.find((item) => item.status === "ACTIVE" && item.organization.type === "SELLER");
  const store = membership?.organization.stores[0];
  if (!user || !membership || !store) return NextResponse.json({ message: "نشست فروشنده معتبر نیست." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    path?: string; productIds?: string[]; caption?: string; tags?: string[]; socialUrl?: string;
    duration?: number; width?: number; height?: number; size?: number; mimeType?: string; originalName?: string;
  } | null;
  const path = String(body?.path || "");
  const productIds = [...new Set(Array.isArray(body?.productIds) ? body.productIds.map(String) : [])].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 10);
  const caption = String(body?.caption || "").trim().slice(0, 1500);
  const tags = [...new Set((body?.tags || []).map((tag) => String(tag).trim().replace(/^#/, "")).filter(Boolean))].slice(0, 15).map((tag) => tag.slice(0, 40));
  const socialUrl = String(body?.socialUrl || "").trim();
  const duration = Number(body?.duration || 0), width = Number(body?.width || 0), height = Number(body?.height || 0), size = Number(body?.size || 0);
  if (!path.startsWith(`${user.id}/${store.id}/`) || !productIds.length) return NextResponse.json({ message: "مسیر فایل یا محصولات انتخاب‌شده معتبر نیست." }, { status: 400 });
  if (!(duration > 0 && duration <= 60.5 && height > width && width <= 720 && height <= 1280)) return NextResponse.json({ message: "ویدیو باید عمودی، کوتاه‌تر از یک دقیقه و با ابعاد معتبر باشد." }, { status: 400 });
  if (!(size > 0 && size <= 100 * 1024 * 1024)) return NextResponse.json({ message: "حجم ویدیو معتبر نیست." }, { status: 400 });
  if (socialUrl && !/^https?:\/\/[^\s]+$/i.test(socialUrl)) return NextResponse.json({ message: "لینک شبکه اجتماعی معتبر نیست." }, { status: 400 });
  const db = createSupabaseAdmin();
  const { data: products, error: productError } = await db.from("seller_products").select("id").in("id", productIds).eq("store_id", store.id).eq("status", "PUBLISHED").eq("moderation_status", "APPROVED");
  if (productError || products?.length !== productIds.length) return NextResponse.json({ message: "یکی از محصولات انتخاب‌شده معتبر یا منتشرشده نیست." }, { status: 400 });
  const slash = path.lastIndexOf("/"), folder = path.slice(0, slash), name = path.slice(slash + 1);
  const { data: objects } = await db.storage.from("reel-media").list(folder, { search: name, limit: 2 });
  const object = objects?.find((item) => item.name === name);
  if (!object) return NextResponse.json({ message: "فایل آپلودشده در فضای ذخیره‌سازی پیدا نشد." }, { status: 400 });
  const actualSize = Number(object.metadata?.size || size);
  if (actualSize > 100 * 1024 * 1024) return NextResponse.json({ message: "حجم فایل بیشتر از حد مجاز است." }, { status: 400 });
  const { data: file, error: fileError } = await db.from("storage_files").insert({
    owner_user_id: user.id, owner_organization_id: membership.organization.id, bucket: "reel-media", path,
    kind: "REEL_VIDEO", original_name: String(body?.originalName || name).slice(0, 255),
    mime_type: String(body?.mimeType || "video/webm"), size_bytes: actualSize, state: "READY",
  }).select("id").single();
  if (fileError || !file) return NextResponse.json({ message: fileError?.message || "ثبت فایل انجام نشد." }, { status: 500 });
  const { data: reel, error: reelError } = await db.from("reel_posts").insert({
    store_id: store.id, seller_product_id: productIds[0], video_file_id: file.id, caption, tags,
    social_url: socialUrl || null, duration_seconds: duration, width, height, status: "PENDING", published_at: null,
  }).select("id").single();
  if (reelError || !reel) {
    await db.from("storage_files").delete().eq("id", file.id);
    await db.storage.from("reel-media").remove([path]);
    return NextResponse.json({ message: reelError?.message || "ثبت ریل انجام نشد." }, { status: 500 });
  }
  const { error: linksError } = await db.from("reel_products").insert(productIds.map((seller_product_id, sort_order) => ({ reel_id: reel.id, seller_product_id, sort_order })));
  if (linksError) {
    await db.from("reel_posts").delete().eq("id", reel.id);
    await db.from("storage_files").delete().eq("id", file.id);
    await db.storage.from("reel-media").remove([path]);
    return NextResponse.json({ message: "اتصال محصولات کامل نشد؛ دوباره تلاش کنید." }, { status: 500 });
  }
  return NextResponse.json({ id: reel.id, message: "ویدیو برای بررسی مدیر ارسال شد." });
}
