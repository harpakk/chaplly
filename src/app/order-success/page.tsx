import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Download,
  MapPin,
  PackageCheck,
  ReceiptText,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/catalog";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; receipt?: string }>;
}) {
  const { order: number = "", receipt = "" } = await searchParams;
  const user = await getCurrentUser();
  if (user && number)
    redirect(`/account/orders?created=${encodeURIComponent(number)}`);
  if (!number || !receipt) notFound();

  const db = createSupabaseAdmin();
  const { data: order, error } = await db
    .from("orders")
    .select(
      "id,number,status,subtotal,shipping_amount,total,currency,customer_snapshot,shipping_address_snapshot,created_at,paid_at,order_items(id,quantity,unit_price,line_total,product_snapshot)",
    )
    .eq("number", number)
    .eq("idempotency_key", receipt)
    .is("buyer_user_id", null)
    .maybeSingle();
  if (error || !order) notFound();
  const address = order.shipping_address_snapshot as Record<string, unknown>;
  const invoiceUrl = `/orders/${encodeURIComponent(order.number)}/invoice?receipt=${encodeURIComponent(receipt)}`;

  return (
    <main className="success-page guest-success-page">
      <section>
        <span className="success-icon"><Check /></span>
        <small>پرداخت موفق و سفارش تأیید شد</small>
        <h1>سفارشت ثبت شد!</h1>
        <p className="guest-order-number">
          شماره سفارش: <b>{order.number}</b>
        </p>
        <div className="guest-receipt-summary">
          {order.order_items.map((item) => {
            const snapshot = item.product_snapshot as Record<string, unknown>;
            return (
              <div key={item.id}>
                <span>
                  <b>{String(snapshot.title || "محصول")}</b>
                  <small>
                    {String(snapshot.color || "")} · {String(snapshot.size || "")} ·
                    تعداد {item.quantity.toLocaleString("fa-IR")}
                  </small>
                </span>
                <strong>{formatPrice(Number(item.line_total))}</strong>
              </div>
            );
          })}
          <div>
            <span>هزینه ارسال</span>
            <strong>{formatPrice(Number(order.shipping_amount))}</strong>
          </div>
          <div className="guest-receipt-total">
            <span>مبلغ پرداخت‌شده</span>
            <strong>{formatPrice(Number(order.total))}</strong>
          </div>
        </div>
        <div className="success-note guest-address-note">
          <MapPin />
          <div>
            <b>نشانی تحویل</b>
            <span>
              {String(address.recipientName || "")} — {String(address.addressLine || "")}
              <br />{String(address.phone || "")}
            </span>
          </div>
        </div>
        <div className="success-note">
          <PackageCheck />
          <div>
            <b>بعدش چی می‌شود؟</b>
            <span>
              سفارش تأیید شده و برای تولید تخصیص یافته است. شماره سفارش را برای
              پیگیری نزد خودت نگه دار.
            </span>
          </div>
        </div>
        <div className="guest-success-actions">
          <a className="market-button primary" href={invoiceUrl} download>
            <Download /> دانلود فاکتور
          </a>
          <Link className="market-button secondary" href="/">
            ادامه خرید <ArrowLeft />
          </Link>
        </div>
        <p className="guest-order-help">
          <ReceiptText /> برای پیگیری این سفارش، شماره سفارش را به پشتیبانی اعلام کن.
        </p>
      </section>
    </main>
  );
}
