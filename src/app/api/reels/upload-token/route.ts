import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const allowed = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const membership = user?.memberships.find((item) => item.status === "ACTIVE" && item.organization.type === "SELLER");
  const store = membership?.organization.stores[0];
  if (!user || !membership || !store) return NextResponse.json({ message: "ابتدا وارد حساب فروشنده شوید." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { name?: string; type?: string; size?: number } | null;
  const type = String(body?.type || "");
  const size = Number(body?.size || 0);
  if (!allowed.has(type) || size < 1 || size > 100 * 1024 * 1024)
    return NextResponse.json({ message: "فایل باید ویدیویی و حداکثر ۱۰۰ مگابایت باشد." }, { status: 400 });
  const extension = type === "video/webm" ? "webm" : type === "video/quicktime" ? "mov" : "mp4";
  const path = `${user.id}/${store.id}/${randomUUID()}.${extension}`;
  const { data, error } = await createSupabaseAdmin().storage.from("reel-media").createSignedUploadUrl(path, { upsert: false });
  if (error || !data) return NextResponse.json({ message: error?.message || "ساخت مسیر آپلود انجام نشد." }, { status: 500 });
  return NextResponse.json({ signedUrl: data.signedUrl, path });
}
