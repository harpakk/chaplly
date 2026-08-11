import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyZarinpalPayment } from "@/lib/zarinpal";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authority = request.nextUrl.searchParams.get("Authority")?.trim() || "";
  const status = request.nextUrl.searchParams.get("Status")?.toUpperCase() || "";
  const destination = new URL("/seller/dashboard?section=woocommerce", request.url);
  const db = createSupabaseAdmin();
  const { data: payment } = await db.from("woocommerce_funding_payments").select("id,amount,status").eq("authority", authority).maybeSingle();
  if (!payment) { destination.searchParams.set("funding", "invalid"); return NextResponse.redirect(destination); }
  if (payment.status === "SUCCEEDED") { destination.searchParams.set("funding", "success"); return NextResponse.redirect(destination); }
  if (status !== "OK") {
    await db.from("woocommerce_funding_payments").update({ status: "CANCELLED", completed_at: new Date().toISOString() }).eq("id", payment.id);
    destination.searchParams.set("funding", "cancelled"); return NextResponse.redirect(destination);
  }
  try {
    const verified = await verifyZarinpalPayment(authority, Number(payment.amount));
    const { error } = await db.rpc("service_credit_woocommerce_funding", { p_authority: authority, p_ref_id: verified.refId, p_response: verified.response });
    if (error) throw error;
    destination.searchParams.set("funding", "success");
  } catch {
    await db.from("woocommerce_funding_payments").update({ response_payload: { verification_pending: true } }).eq("id", payment.id);
    destination.searchParams.set("funding", "failed");
  }
  return NextResponse.redirect(destination);
}
