import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    storeId?: unknown;
    visitorId?: unknown;
  } | null;
  const storeId = typeof body?.storeId === "string" ? body.storeId : "";
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
  if (!/^[0-9a-f-]{36}$/i.test(storeId) || !/^[0-9a-f-]{36}$/i.test(visitorId))
    return NextResponse.json({ ok: false }, { status: 400 });

  const db = createSupabaseAdmin();
  const { data: store } = await db.from("stores").select("id")
    .eq("id", storeId).eq("status", "ACTIVE").maybeSingle();
  if (!store) return NextResponse.json({ ok: false }, { status: 404 });

  const salt = process.env.SUPABASE_SECRET_KEY || "chapli-storefront-analytics";
  const visitorHash = createHash("sha256").update(`${salt}:${visitorId}`).digest("hex");
  const { error } = await db.from("storefront_unique_visits").upsert(
    { store_id: storeId, visitor_hash: visitorHash },
    { onConflict: "store_id,visitor_hash,day", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return new NextResponse(null, { status: 204 });
}
