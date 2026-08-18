import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AutosaveBody = {
  designId?: string;
  rawProductId?: string;
  name?: string;
  views?: { rawProductViewId?: string; canvas?: Record<string, unknown> }[];
  variantIds?: string[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const context = await requireSeller();
    const storeId = context.membership.organization.stores[0]?.id;
    if (!storeId)
      return NextResponse.json({ ok: false, message: "فروشگاه پیدا نشد." }, { status: 404 });

    const body = (await request.json()) as AutosaveBody;
    if (
      !body.rawProductId ||
      !uuid.test(body.rawProductId) ||
      (body.designId && !uuid.test(body.designId)) ||
      !Array.isArray(body.views) ||
      body.views.some((view) => !view.rawProductViewId || !uuid.test(view.rawProductViewId)) ||
      !Array.isArray(body.variantIds) ||
      body.variantIds.some((id) => !uuid.test(id))
    )
      return NextResponse.json({ ok: false, message: "داده طراحی معتبر نیست." }, { status: 400 });

    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc("save_design_draft", {
      p_design_id: body.designId || null,
      p_store_id: storeId,
      p_raw_product_id: body.rawProductId,
      p_name: String(body.name || "طرح بدون نام").slice(0, 160),
      p_views: body.views.map((view) => ({
        rawProductViewId: view.rawProductViewId,
        canvas: view.canvas || { version: 2, objects: [], colorObjects: {} },
      })),
      p_variant_ids: body.variantIds,
    });
    if (error)
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: String(data) });
  } catch {
    return NextResponse.json({ ok: false, message: "ورود دوباره لازم است." }, { status: 401 });
  }
}
