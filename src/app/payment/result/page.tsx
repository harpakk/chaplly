import Link from "next/link";
import { CheckCircle2, CreditCard, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { PaymentSuccessCleanup } from "@/components/payment-success-cleanup";

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; order?: string; receipt?: string; ref?: string }>;
}) {
  const query = await searchParams;
  const user = await getCurrentUser();
  const db = createSupabaseAdmin();
  let orderQuery = db
    .from("orders")
    .select("id,number,idempotency_key,buyer_user_id,paid_at")
    .eq("number", query.order || "");
  if (query.receipt) orderQuery = orderQuery.is("buyer_user_id", null).eq("idempotency_key", query.receipt);
  else if (user) orderQuery = orderQuery.eq("buyer_user_id", user.id);
  else orderQuery = orderQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  const { data: order } = await orderQuery.maybeSingle();
  const success = Boolean(order?.paid_at) && query.status === "success";
  const receiptParam = order && !order.buyer_user_id && order.idempotency_key
    ? `&receipt=${encodeURIComponent(order.idempotency_key)}`
    : "";
  const recover = order
    ? `/api/payments/zarinpal/recover?order=${encodeURIComponent(order.number)}${receiptParam}`
    : "/checkout";
  const orderDetailsHref = order?.buyer_user_id
    ? "/account/orders"
    : order?.idempotency_key
      ? `/order-success?order=${encodeURIComponent(order.number)}&receipt=${encodeURIComponent(order.idempotency_key)}`
      : "/checkout";

  return (
    <main className="success-page guest-success-page">
      {success && <PaymentSuccessCleanup />}
      <section>
        <span className="success-icon">{success ? <CheckCircle2 /> : <XCircle />}</span>
        <small>{success ? "تأیید نهایی زرین‌پال" : "پرداخت تکمیل نشد"}</small>
        <h1>{success ? "پرداخت موفق بود" : query.status === "cancelled" ? "پرداخت لغو شد" : "پرداخت تأیید نشد"}</h1>
        {order && <p className="guest-order-number">شماره سفارش: <b>{order.number}</b></p>}
        {success ? (
          <>
            <p>سفارش شما فقط پس از تأیید زرین‌پال پرداخت‌شده ثبت شد.</p>
            {query.ref && <p className="guest-order-number">شماره پیگیری زرین‌پال: <b>{query.ref}</b></p>}
            <Link className="market-button primary" href={orderDetailsHref}>
              مشاهده سفارش
            </Link>
          </>
        ) : (
          <>
            <p>سفارش شما محفوظ است و مبلغی در چاپلی تأیید نشده. برای بررسی دوباره یا ادامه پرداخت از دکمه زیر استفاده کنید.</p>
            <a className="market-button primary" href={recover}><CreditCard /> ادامه یا بررسی پرداخت</a>
            <Link className="market-button secondary" href="/">بازگشت به فروشگاه</Link>
          </>
        )}
      </section>
    </main>
  );
}
