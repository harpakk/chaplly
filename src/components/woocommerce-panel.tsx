"use client";

import { CheckCircle2, ExternalLink, Link2, PackageCheck, PlugZap, ShoppingCart, WalletCards } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { formatRial } from "@/lib/catalog";
import type { getSellerDashboardData } from "@/lib/dashboard-data";
import type { Json } from "@/types/database";
import {
  connectWooCommerceAction,
  createWooCommercePlatformOrderAction,
  disconnectWooCommerceAction,
  fundWooCommerceImportAction,
} from "@/app/actions/woocommerce";

type Data = Awaited<ReturnType<typeof getSellerDashboardData>>["woocommerce"];
type JsonObject = { [key: string]: Json | undefined };
const jsonObject = (value: Json): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const statusLabel: Record<string, string> = {
  NEW: "در انتظار تأیید",
  FUNDING: "نیازمند تکمیل شارژ",
  READY: "آماده ساخت سفارش",
  CONVERTED: "سفارش تولید ساخته شد",
  IGNORED: "بدون محصول چاپلی",
  CANCELLED: "لغوشده",
  ERROR: "خطا",
};

export function WooCommercePanel({ data }: { data: Data }) {
  const connection = data.connection;
  const connected = connection?.status === "CONNECTED";
  return (
    <div className="woo-panel">
      <section className="sd-panel woo-connection-card">
        <div className="sd-section-title">
          <div><span>کانال فروش خارجی</span><h2>اتصال WooCommerce</h2></div>
          {connected && <span className="woo-connected"><CheckCircle2 /> متصل</span>}
        </div>
        {!connection || !connected ? (
          <ActionForm action={connectWooCommerceAction} savingText="در حال بررسی دسترسی و ساخت وب‌هوک…" className="woo-connect-form">
            <label>آدرس سایت<input name="siteUrl" type="url" dir="ltr" placeholder="https://shop.example.com" required /></label>
            <label>Consumer Key<input name="consumerKey" dir="ltr" placeholder="ck_..." required /></label>
            <label>Consumer Secret<input name="consumerSecret" type="password" dir="ltr" placeholder="cs_..." required /></label>
            <label>واحد قیمت سایت<select name="priceUnit" defaultValue="TOMAN"><option value="TOMAN">تومان</option><option value="IRR">ریال</option></select></label>
            <p>کلید باید دسترسی Read/Write داشته باشد. اطلاعات به‌صورت رمزگذاری‌شده ذخیره می‌شوند و چاپلی وب‌هوک سفارش جدید را خودکار می‌سازد.</p>
            <button className="sd-primary"><PlugZap /> اتصال و فعال‌سازی</button>
          </ActionForm>
        ) : (
          <div className="woo-connection-summary">
            <div><Link2 /><span><b>{connection.site_url}</b><small>وب‌هوک سفارش‌ها فعال است</small></span></div>
            <a href={connection.site_url} target="_blank" rel="noreferrer"><ExternalLink /> باز کردن سایت</a>
            <ActionForm action={disconnectWooCommerceAction} confirmMessage="اتصال و وب‌هوک ووکامرس غیرفعال شود؟"><button className="sd-outline">قطع اتصال</button></ActionForm>
          </div>
        )}
        {connection?.last_error && <p className="action-note error">{connection.last_error}</p>}
      </section>

      <section className="woo-balance-card">
        <WalletCards />
        <div><small>اعتبار اختصاصی سفارش‌های ووکامرس</small><strong>{formatRial(data.channelBalance)}</strong></div>
        <p>این اعتبار از کیف خرید و مانده عادی شما جداست و فقط برای تولید سفارش‌های واردشده مصرف می‌شود.</p>
      </section>

      <section className="sd-panel">
        <div className="sd-section-title"><div><span>سفارش‌های دریافت‌شده از وب‌هوک</span><h2>صف سفارش‌های WooCommerce</h2></div></div>
        {data.imports.length ? <div className="woo-order-list">{data.imports.map((order) => {
          const customer = jsonObject(order.customer_snapshot);
          const address = jsonObject(order.shipping_address_snapshot);
          const remaining = Math.max(0, order.required_amount - order.funded_amount);
          return <article className={`woo-order-card status-${String(order.status).toLowerCase()}`} key={order.id}>
            <header><ShoppingCart /><div><small>سفارش ووکامرس</small><h3>#{order.external_order_number}</h3></div><span>{statusLabel[order.status] || order.status}</span></header>
            <div className="woo-order-facts">
              <span>خریدار<b>{String(customer.name || "بدون نام")}</b></span>
              <span>تعداد اقلام<b>{order.itemCount.toLocaleString("fa-IR")}</b></span>
              <span>هزینه تولید<b>{formatRial(order.required_amount)}</b></span>
              <span>مانده تأمین<b>{formatRial(remaining)}</b></span>
            </div>
            <div className="woo-imported-items">
              {(order.woocommerce_order_import_items || []).map((item) => {
                const snapshot = jsonObject(item.item_snapshot);
                return (
                <span key={item.id}>{String(snapshot.name || "محصول چاپلی")} × {Number(item.quantity).toLocaleString("fa-IR")}</span>
                );
              })}
            </div>
            <p>{String(address.city || "")}، {String(address.addressLine || "نشانی ثبت نشده")} · {String(address.phone || customer.phone || "بدون تلفن")}</p>
            {!["CONVERTED","IGNORED","CANCELLED"].includes(order.status) && remaining > 0 && (
              <ActionForm action={fundWooCommerceImportAction} refreshAfterSuccess={false} onSuccess={(result) => result.detail?.startsWith("http") ? window.location.assign(result.detail) : window.location.reload()} savingText="در حال محاسبه درآمد و شارژ…" className="woo-order-actions">
                <input type="hidden" name="importId" value={order.id} />
                <label><input type="checkbox" name="useEarnings" defaultChecked /> ابتدا از درآمد قابل برداشت من کسر شود</label>
                <button className="sd-primary"><WalletCards /> تأمین هزینه و ادامه پرداخت</button>
              </ActionForm>
            )}
            {order.status === "READY" && (
              <ActionForm action={createWooCommercePlatformOrderAction} savingText="در حال ساخت سفارش‌ها و تخصیص تأمین‌کننده…" className="woo-order-actions">
                <input type="hidden" name="importId" value={order.id} />
                <button className="sd-primary"><PackageCheck /> ساخت سفارش تولید</button>
              </ActionForm>
            )}
          </article>;
        })}</div> : <div className="empty-state"><ShoppingCart /><h3>هنوز سفارش مرتبطی دریافت نشده است</h3><p>فقط اقلامی وارد می‌شوند که قبلاً از چاپلی در ووکامرس منتشر و نگاشت شده باشند.</p></div>}
      </section>
    </div>
  );
}
