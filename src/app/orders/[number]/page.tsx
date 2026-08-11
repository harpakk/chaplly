import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Circle,
  Headphones,
  Package,
  PackageCheck,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import { formatPrice } from "@/lib/catalog";
import { requireBuyer } from "@/lib/auth";
import { getOrderDetail } from "@/lib/dashboard-data";
import { ActionForm } from "@/components/action-form";
import { CopyValue } from "@/components/copy-value";
import {
  confirmOrderReceivedAction,
} from "@/app/actions/dashboard";

const stages = ["PENDING", "CONFIRMED", "IN_PRODUCTION", "SENT", "DONE"] as const;
const labels: Record<string, string> = {
  PENDING: "در انتظار تأیید",
  CONFIRMED: "تأیید شده",
  IN_PRODUCTION: "در حال آماده‌سازی",
  READY_TO_SHIP: "آماده ارسال",
  SENT: "ارسال شده",
  DONE: "تحویل شده",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
  DISPUTED: "نیازمند بررسی",
  REQUESTED: "در صف بررسی",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
  COMPLETED: "تکمیل شده",
  UNDER_REVIEW: "در حال بررسی",
  RESOLVED: "حل شده",
  OPEN: "باز",
};

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const user = await requireBuyer();
  const { number } = await params;
  const order = await getOrderDetail(number, user.id);
  if (!order) notFound();
  const fulfilment = order.fulfilments[0];
  const shipment = fulfilment?.shipments?.[0];
  const current = fulfilment?.status || order.status;
  const index = Math.max(0, stages.indexOf(current as (typeof stages)[number]));
  const address = order.shipping_address_snapshot as Record<string, unknown>;
  const canCancel =
    ["PENDING", "CONFIRMED"].includes(order.status) &&
    order.fulfilments.length > 0 &&
    order.fulfilments.every((item) => item.status === "ASSIGNED");
  const activeCancellation = order.cancellations.some((item) =>
    ["REQUESTED", "APPROVED"].includes(item.status),
  );

  return (
    <main className="order-status-page">
      <div className="shop-container">
        <div className="order-status-heading">
          <span>پیگیری سفارش</span>
          <h1>{number}</h1>
          <p>
            آخرین بروزرسانی:{" "}
            {new Intl.DateTimeFormat("fa-IR", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(order.updated_at))}
          </p>
        </div>
        <div className="order-status-layout">
          <section>
            <div className="status-card">
              <div className="current-status">
                <PackageCheck />
                <div>
                  <small>وضعیت فعلی</small>
                  <h2>{labels[current] || current}</h2>
                  <p>محصول‌ها حداکثر تا ۷۲ ساعت برای ارسال آماده می‌شوند.</p>
                </div>
              </div>
              <div className="order-status-facts">
                <span>وضعیت سفارش</span>
                <strong>{labels[order.status] || order.status}</strong>
                <span>وضعیت پرداخت</span>
                <strong>{order.paid_at ? "پرداخت‌شده" : "در انتظار پرداخت"}</strong>
              </div>
              {!order.paid_at && (
                <a className="market-button primary" href={`/api/payments/zarinpal/recover?order=${encodeURIComponent(order.number)}`}>
                  ادامه یا بررسی پرداخت
                </a>
              )}
              <ol>
                {stages.map((stage, stageIndex) => {
                  const done = stageIndex < index;
                  const active = stageIndex === index;
                  const Icon =
                    stage === "SENT" ? Truck : stage === "DONE" ? Circle : Package;
                  return (
                    <li className={done ? "done" : active ? "active" : ""} key={stage}>
                      <i>{done ? <Check /> : <Icon />}</i>
                      <div>
                        <b>{labels[stage]}</b>
                        {active && <span>الان اینجاییم</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {fulfilment?.tracking_code && (
                <div className="order-help">
                  <Truck />
                  <div>
                    <b>کد رهگیری مرسوله</b>
                    <CopyValue value={fulfilment.tracking_code} />
                    {shipment?.carrier && <span>روش ارسال: {shipment.carrier}</span>}
                  </div>
                </div>
              )}
              {order.status !== "DONE" && order.fulfilments.length > 0 && order.fulfilments.every((item) => item.status === "SENT" || item.status === "DONE") && (
                <ActionForm action={confirmOrderReceivedAction} className="dashboard-action-form">
                  <input type="hidden" name="orderId" value={order.id} />
                  <button><PackageCheck /> سفارش را دریافت کردم</button>
                </ActionForm>
              )}
            </div>

            <section className="order-exceptions">
              <header>
                <span>بعد از ثبت سفارش</span>
                <h2>لغو، مرجوعی یا گزارش مشکل</h2>
                <p>
                  درخواست‌ها در دیتابیس ثبت می‌شوند و وضعیت بررسی را همین صفحه
                  می‌بینی؛ ثبت دوباره باعث پرونده تکراری نمی‌شود.
                </p>
              </header>
              <div className="order-exception-grid">
                {canCancel ? <Link className="order-support-link" href={`/account/support?new=1&order=${encodeURIComponent(number)}&topic=cancellation`}>
                    <XCircle />
                    <span>
                      <b>درخواست لغو</b>
                      <small>فقط تا زمانی که سفارش در انتظار تأیید است</small>
                    </span>
                  </Link> : <div className="order-support-link disabled">
                    <XCircle /><span><b>درخواست لغو</b><small>{activeCancellation ? "درخواست لغو فعال است" : "پس از تأیید یا ارسال قابل لغو نیست"}</small></span>
                  </div>}
                <Link className="order-support-link" href={`/account/support?new=1&order=${encodeURIComponent(number)}&topic=return`}>
                    <RotateCcw />
                    <span>
                      <b>درخواست مرجوعی</b>
                      <small>ثبت و پیگیری از بخش پشتیبانی</small>
                    </span>
                </Link>
                <Link className="order-support-link" href={`/account/support?new=1&order=${encodeURIComponent(number)}&topic=problem`}>
                    <AlertTriangle />
                    <span>
                      <b>گزارش مشکل</b>
                      <small>گفت‌وگو با پشتیبانی درباره این سفارش</small>
                    </span>
                </Link>
              </div>
              {[...order.cancellations, ...order.returns, ...order.disputes].length > 0 && (
                <div className="exception-history">
                  <h3>تاریخچه درخواست‌ها</h3>
                  {order.cancellations.map((item) => (
                    <p key={item.id}>
                      <XCircle />
                      <b>لغو: {item.reason}</b>
                      <span>{labels[item.status] || item.status}</span>
                    </p>
                  ))}
                  {order.returns.map((item) => (
                    <p key={item.id}>
                      <RotateCcw />
                      <b>مرجوعی: {item.reason}</b>
                      <span>{labels[item.status] || item.status}</span>
                    </p>
                  ))}
                  {order.disputes.map((item) => (
                    <p key={item.id}>
                      <AlertTriangle />
                      <b>اختلاف: {item.reason}</b>
                      <span>{labels[item.status] || item.status}</span>
                    </p>
                  ))}
                </div>
              )}
            </section>

            <div className="order-help">
              <Headphones />
              <div>
                <b>سؤالی درباره سفارشت داری؟</b>
                <p>تیم پشتیبانی با شماره سفارش سریع‌تر کمکت می‌کند.</p>
              </div>
              <Link href="/support">گفت‌وگو با پشتیبانی</Link>
            </div>
          </section>
          <aside className="order-summary">
            <h2>جزئیات سفارش</h2>
            <div className="order-items-detail">
            {order.items.map((item) => {
              const snapshot = item.product_snapshot as Record<string, unknown>;
              const itemFulfilment = order.fulfilments.find((entry) =>
                entry.fulfilment_items?.some((row) => row.order_item_id === item.id),
              );
              return (
                <article key={item.id}>
                  <header>
                    <b>{String(snapshot.title || "محصول")}</b>
                    <em>{labels[itemFulfilment?.status || order.status] || itemFulfilment?.status || order.status}</em>
                  </header>
                  {Boolean(snapshot.description) && <p>{String(snapshot.description)}</p>}
                  <dl>
                    <div><dt>رنگ</dt><dd>{String(snapshot.color || "—")}</dd></div>
                    <div><dt>اندازه</dt><dd>{String(snapshot.size || "—")}</dd></div>
                    <div><dt>تعداد</dt><dd>{item.quantity.toLocaleString("fa-IR")}</dd></div>
                    <div><dt>قیمت واحد</dt><dd>{formatPrice(item.unit_price)}</dd></div>
                    <div><dt>جمع این کالا</dt><dd>{formatPrice(item.line_total)}</dd></div>
                    <div><dt>شناسه کالا</dt><dd dir="ltr">{item.id.slice(0, 8)}</dd></div>
                  </dl>
                  {itemFulfilment?.tracking_code && (
                    <small>
                      روش ارسال: {itemFulfilment.shipments?.[0]?.carrier || "—"} · کد رهگیری: <b dir="ltr">{itemFulfilment.tracking_code}</b>
                    </small>
                  )}
                </article>
              );
            })}
            </div>
            <div>
              <span>ارسال</span>
              <strong>پس‌کرایه</strong>
            </div>
            <p className="order-shipping-explanation">به علت نوسان قیمت پست و تیپاکس، هزینه‌ی ارسال هنگام تحویل دریافت می‌شود.</p>
            {order.discount_amount > 0 && (
              <div><span>پرداخت از کیف پول / اعتبار</span><strong>− {formatPrice(order.discount_amount)}</strong></div>
            )}
            <div className="summary-total">
              <span>مبلغ نهایی</span>
              <strong>{formatPrice(order.total)}</strong>
            </div>
            <hr />
            <small>تحویل‌گیرنده</small>
            <p>
              {String(address.recipient_name || "—")}
              <br />
              {String(address.city || "")}،{" "}
              {String(address.address_line || address.line1 || "")}
            </p>
            <Link href="/account/orders">همه سفارش‌ها</Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
