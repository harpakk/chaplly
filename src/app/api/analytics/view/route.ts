import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { kind?: unknown } | null;
  if (body?.kind !== "index" && body?.kind !== "product")
    return NextResponse.json({ ok: false }, { status: 400 });
  const db = createSupabaseAdmin();
  const { error } = await (db.rpc as unknown as (name: string, args: object) => Promise<{ error: { message: string } | null }>)
    ("record_site_page_view", { p_kind: body.kind });
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return new NextResponse(null, { status: 204 });
}

