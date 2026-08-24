import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyZarinpalPayment } from "@/lib/zarinpal";
import type { Json } from "@/types/database";
import { queueOrderPaidSms } from "@/lib/sms-events";

export type ZarinpalFinalization = {
  ok: boolean;
  orderNumber?: string;
  receipt?: string;
  guest?: boolean;
  refId?: string;
  message: string;
};

function previousRefId(value: unknown) {
  if (!value || typeof value !== "object" || !("verification" in value)) return "";
  const verification = value.verification;
  if (!verification || typeof verification !== "object" || !("data" in verification)) return "";
  const data = verification.data;
  return data && typeof data === "object" && "ref_id" in data ? String(data.ref_id || "") : "";
}

export async function finalizeZarinpalPayment(authority: string): Promise<ZarinpalFinalization> {
  const db = createSupabaseAdmin();
  const { data: rawAttempt, error } = await db
    .from("payment_attempts")
    .select("id,order_id,payment_id,amount,status,idempotency_key,response_payload,orders(number,idempotency_key,buyer_user_id,paid_at)")
    .eq("provider", "ZARINPAL")
    .eq("provider_attempt_id", authority)
    .maybeSingle();
  const attempt = rawAttempt;
  const order = Array.isArray(attempt?.orders) ? attempt.orders[0] : attempt?.orders;
  if (error || !attempt || !order)
    return { ok: false, message: "تراکنش مربوط به این کد پرداخت پیدا نشد." };

  const previous = attempt.response_payload && typeof attempt.response_payload === "object" && !Array.isArray(attempt.response_payload)
    ? attempt.response_payload
    : {};
  if (attempt.status === "SUCCEEDED" && attempt.payment_id) {
    await db.from("orders").update({ status: "CONFIRMED" }).eq("id", attempt.order_id).eq("status", "PENDING");
    await queueOrderPaidSms(attempt.order_id).catch((smsError) =>
      console.error("Order SMS queue failed", smsError),
    );
    return {
      ok: true,
      orderNumber: order.number,
      receipt: order.idempotency_key,
      guest: !order.buyer_user_id,
      refId: previousRefId(previous),
      message: "این پرداخت قبلاً با موفقیت تأیید شده است.",
    };
  }

  try {
    const verified = await verifyZarinpalPayment(authority, Number(attempt.amount));
    const { data: payment, error: paymentError } = await db.from("payments").upsert({
      order_id: attempt.order_id,
      provider: "ZARINPAL",
      provider_payment_id: authority,
      idempotency_key: `${attempt.idempotency_key}:capture`,
      amount: Number(attempt.amount),
      status: "CAPTURED",
      provider_response: verified.response as Json,
      captured_at: new Date().toISOString(),
    }, { onConflict: "idempotency_key" }).select("id").single();
    if (paymentError) throw paymentError;
    const { error: orderError } = await db.from("orders").update({ status: "CONFIRMED", paid_at: new Date().toISOString() }).eq("id", attempt.order_id).is("paid_at", null);
    if (orderError) throw orderError;
    await db
      .from("payment_attempts")
      .update({
        payment_id: String(payment.id),
        status: "SUCCEEDED",
        response_payload: { ...previous, verification: verified.response },
        completed_at: new Date().toISOString(),
        failure_code: null,
        failure_message: null,
      })
      .eq("id", attempt.id);
    await queueOrderPaidSms(attempt.order_id).catch((smsError) =>
      console.error("Order SMS queue failed", smsError),
    );
    return {
      ok: true,
      orderNumber: order.number,
      receipt: order.idempotency_key,
      guest: !order.buyer_user_id,
      refId: verified.refId,
      message: "پرداخت با موفقیت تأیید شد.",
    };
  } catch (verificationError) {
    const value = verificationError as { message?: string; code?: string | number; response?: unknown };
    console.error("Zarinpal payment verification failed", { authority, attemptId: attempt.id, orderId: attempt.order_id, amount: attempt.amount, error: verificationError });
    await db
      .from("payment_attempts")
      .update({
        status: "FAILED",
        response_payload: {
          ...previous,
          verification: (value.response ?? null) as Json,
        },
        failure_code: value.code == null ? null : String(value.code),
        failure_message: value.message || "Payment verification failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);
    return {
      ok: false,
      orderNumber: order.number,
      receipt: order.idempotency_key,
      guest: !order.buyer_user_id,
      message: "پرداخت هنوز توسط زرین‌پال تأیید نشده است. می‌توانید دوباره بررسی کنید.",
    };
  }
}
