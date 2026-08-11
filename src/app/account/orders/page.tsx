import Link from "next/link";
import { ArrowLeft, CheckCircle2, Package } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { formatPrice } from "@/lib/catalog";
import { requireBuyer } from "@/lib/auth";
import { getBuyerAccountData } from "@/lib/dashboard-data";

const orderStatusFa: Record<string, string> = {
  PENDING: "در انتظار تأیید",
  CONFIRMED: "تأییدشده",
  IN_PRODUCTION: "در حال آماده‌سازی",
  READY_TO_SHIP: "آماده ارسال",
  PARTIALLY_SENT: "بخشی ارسال‌شده",
  SENT: "ارسال‌شده",
  DONE: "تحویل‌شده",
  CANCELLED: "لغوشده",
  RETURNED: "مرجوع‌شده",
  DISPUTED: "در حال بررسی",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireBuyer();
  const [{ created }, data] = await Promise.all([
    searchParams,
    getBuyerAccountData(user.id),
  ]);
  const name = [data.profile.first_name, data.profile.last_name]
    .filter(Boolean)
    .join(" ");
  return (
    <AccountShell active="/account/orders" name={name}>
      <div className="account-heading">
        <span>از خرید تا رسیدن</span>
        <h1>سفارش‌های من</h1>
      </div>
      {created && (
        <div className="account-order-success" role="status">
          <CheckCircle2 />
          <div>
            <b>پرداخت موفق و سفارش ثبت شد</b>
            <span>شماره سفارش: {created}</span>
          </div>
        </div>
      )}
      {data.orders.length ? (
        <div className="orders-list">
          {data.orders.map((order) => (
            <Link
              href={order.paid_at ? `/orders/${order.number}` : `/api/payments/zarinpal/recover?order=${encodeURIComponent(order.number)}`}
              key={order.id}
            >
              <Package />
              <div>
                <small>ثبت‌شده در {order.createdLabel}</small>
                <h2>{order.number}</h2>
                <p>وضعیت: {orderStatusFa[order.status] || order.status}</p>
                {!order.paid_at && <p>پرداخت نیمه‌تمام — ادامه یا بررسی پرداخت</p>}
              </div>
              <strong>{formatPrice(order.total)}</strong>
              <ArrowLeft />
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Package />
          <h2>هنوز سفارشی ثبت نکرده‌ای</h2>
          <Link className="button button-primary" href="/search">
            دیدن محصولات
          </Link>
        </div>
      )}
    </AccountShell>
  );
}
