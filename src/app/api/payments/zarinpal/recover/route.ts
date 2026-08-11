import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { finalizeZarinpalPayment } from "@/lib/zarinpal-payment";
import { zarinpalGatewayUrl } from "@/lib/zarinpal";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const number = request.nextUrl.searchParams.get("order")?.trim() || "";
  const receipt = request.nextUrl.searchParams.get("receipt")?.trim() || "";
  const user = await getCurrentUser();
  const db = createSupabaseAdmin();
  let orderQuery = db
    .from("orders")
    .select("id,number,idempotency_key,buyer_user_id,paid_at")
    .eq("number", number);
  if (receipt) orderQuery = orderQuery.is("buyer_user_id", null).eq("idempotency_key", receipt);
  else if (user) orderQuery = orderQuery.eq("buyer_user_id", user.id);
  else orderQuery = orderQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  const { data: order } = await orderQuery.maybeSingle();
  const resultUrl = new URL("/payment/result", request.url);
  if (!order) {
    resultUrl.searchParams.set("status", "invalid");
    return NextResponse.redirect(resultUrl);
  }
  resultUrl.searchParams.set("order", order.number);
  if (!order.buyer_user_id && order.idempotency_key) {
    resultUrl.searchParams.set("receipt", order.idempotency_key);
  }
  if (order.paid_at) {
    resultUrl.searchParams.set("status", "success");
    return NextResponse.redirect(resultUrl);
  }
  const { data: attempt } = await db
    .from("payment_attempts")
    .select("provider_attempt_id")
    .eq("order_id", order.id)
    .eq("provider", "ZARINPAL")
    .not("provider_attempt_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!attempt?.provider_attempt_id) {
    resultUrl.searchParams.set("status", "invalid");
    return NextResponse.redirect(resultUrl);
  }
  const finalized = await finalizeZarinpalPayment(attempt.provider_attempt_id);
  if (finalized.ok) {
    resultUrl.searchParams.set("status", "success");
    if (finalized.refId) resultUrl.searchParams.set("ref", finalized.refId);
    return NextResponse.redirect(resultUrl);
  }
  return NextResponse.redirect(zarinpalGatewayUrl(attempt.provider_attempt_id));
}
