import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { finalizeZarinpalPayment } from "@/lib/zarinpal-payment";

export const dynamic = "force-dynamic";

function resultUrl(request: NextRequest, values: Record<string, string | undefined>) {
  const url = new URL("/payment/result", request.url);
  for (const [key, value] of Object.entries(values)) if (value) url.searchParams.set(key, value);
  return url;
}

export async function GET(request: NextRequest) {
  const authority = request.nextUrl.searchParams.get("Authority")?.trim() || "";
  const status = request.nextUrl.searchParams.get("Status")?.toUpperCase() || "";
  if (!authority)
    return NextResponse.redirect(resultUrl(request, { status: "invalid" }));

  if (status !== "OK") {
    const db = createSupabaseAdmin();
    const { data: rawAttempt } = await db
      .from("payment_attempts")
      .select("id,orders(number,idempotency_key,buyer_user_id)")
      .eq("provider", "ZARINPAL")
      .eq("provider_attempt_id", authority)
      .maybeSingle();
    const attempt = rawAttempt;
    const order = Array.isArray(attempt?.orders) ? attempt.orders[0] : attempt?.orders;
    if (attempt)
      await db
        .from("payment_attempts")
        .update({ status: "CANCELLED", failure_message: "Cancelled before verification" })
        .eq("id", attempt.id);
    return NextResponse.redirect(
      resultUrl(request, {
        status: "cancelled",
        order: order?.number,
        receipt: order?.buyer_user_id ? undefined : order?.idempotency_key,
      }),
    );
  }

  const result = await finalizeZarinpalPayment(authority);
  return NextResponse.redirect(
    resultUrl(request, {
      status: result.ok ? "success" : "failed",
      order: result.orderNumber,
      receipt: result.guest ? result.receipt : undefined,
      ref: result.refId,
      reason: result.ok ? undefined : result.message,
    }),
  );
}
