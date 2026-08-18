/* eslint-disable @next/next/no-img-element -- supplier print sheets use signed source files at their original resolution. */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  ChevronLeft,
  Clock3,
  CircleDollarSign,
  Download,
  FileText,
  Landmark,
  Package,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import {
  deleteBankAccountAction,
  markFulfilmentSentAction,
  reportFulfilmentExceptionAction,
  requestPayoutAction,
  saveBankAccountAction,
  supplierSubmitOfferAction,
} from "@/app/actions/dashboard";
import { formatRial } from "@/lib/catalog";
import type { getSupplierDashboardData } from "@/lib/dashboard-data";

type SupplierData = Awaited<ReturnType<typeof getSupplierDashboardData>>;
type Section = "orders" | "financial" | "raw-products";
const date = (value: string) =>
  new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const fulfilmentStatusFa = (status: string) =>
  ({
    ASSIGNED: "تخصیص‌یافته",
    IN_PRODUCTION: "در حال تولید",
    QUALITY_CHECK: "کنترل کیفیت",
    READY_TO_SEND: "آماده ارسال",
    SENT: "ارسال‌شده",
    DONE: "تکمیل‌شده",
    CANCELLED: "لغوشده",
    RETURNED: "مرجوع‌شده",
  })[status] || status;
const earningStatusFa = (status: string) =>
  ({
    PENDING: "در انتظار تکمیل سفارش",
    AVAILABLE: "قابل برداشت",
    RESERVED: "رزروشده برای تسویه",
    PAID: "پرداخت‌شده",
    REVERSED: "لغوشده؛ بدون درآمد",
    REQUESTED: "درخواست‌شده",
    PROCESSING: "در حال پرداخت",
  } as Record<string, string>)[status] || status;
const relationOne = <T,>(value: T | T[] | null | undefined) =>
  Array.isArray(value) ? value[0] : value;

export function SupplierConsole({
  section,
  data,
  fulfilmentId,
}: {
  section: Section;
  data: SupplierData;
  fulfilmentId?: string;
}) {
  const suppliedProducts = data.rawProducts.filter((product) => product.offer);
  const lowVariants = suppliedProducts.flatMap((product) =>
    (product.offer?.variants || [])
      .filter(
        (variant) =>
          variant.stock_quantity > 0 && variant.stock_quantity < 10,
      )
      .map((variant) => ({ product, variant })),
  );
  return (
    <div className="supplier-page">
      {!suppliedProducts.length ? (
        <div
          className="inventory-warning-banner inventory-empty-banner"
          role="alert"
        >
          <Package />
          <div>
            <b>هنوز هیچ محصول خامی برای تأمین اضافه نکرده‌اید</b>
            <span>
              برای دریافت سفارش باید محصولات و موجودی دقیق رنگ و سایزهایشان را
              ثبت کنید.
            </span>
          </div>
          <Link href="/supplier/dashboard/raw-products">
            افزودن محصول و موجودی
          </Link>
        </div>
      ) : lowVariants.length > 0 ? (
        <div className="inventory-warning-banner" role="alert">
          <AlertTriangle />
          <div>
            <b>
              {lowVariants.length.toLocaleString("fa-IR")} تنوع موجودی کمتر از
              ۱۰ دارد
            </b>
            <span>
              برای جلوگیری از ناموجود شدن محصول، همین حالا موجودی را افزایش
              دهید؛ تغییر برای تأیید مدیر ارسال می‌شود.
            </span>
            <small>
              {lowVariants
                .map(({ product, variant }) => {
                  const rawVariant = product.variants.find(
                    (item) => item.id === variant.raw_product_variant_id,
                  );
                  const color = product.colors.find(
                    (item) => item.id === rawVariant?.color_id,
                  );
                  const size = product.sizes.find(
                    (item) => item.id === rawVariant?.size_id,
                  );
                  return `${product.name}: ${color?.name || "—"} / ${size?.name || "—"} (${variant.stock_quantity.toLocaleString("fa-IR")})`;
                })
                .join("، ")}
            </small>
          </div>
          <Link href={`/supplier/dashboard/raw-products?raw=${lowVariants[0].product.id}`}>
            افزایش موجودی
          </Link>
        </div>
      ) : null}
      {section === "orders" && <Orders data={data} detailId={fulfilmentId} />}
      {section === "financial" && <Financial data={data} />}
      {section === "raw-products" && <RawProducts data={data} />}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article>
      <i>{icon}</i>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

async function downloadRenderedDesign(
  side: string,
  document: unknown,
  format: "png" | "jpg",
) {
  const objects = document && typeof document === "object" && "objects" in document
    ? (document as { objects?: Array<Record<string, unknown>> }).objects || []
    : [];
  const size = 4096;
  const canvas = window.document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (format === "jpg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
  }
  for (const object of objects) {
    const x = (Number(object.x || 0) / 100) * size;
    const y = (Number(object.y || 0) / 100) * size;
    const width = (Number(object.w || 10) / 100) * size;
    const height = (Number(object.h || 10) / 100) * size;
    context.save();
    context.globalAlpha = Number(object.opacity ?? 100) / 100;
    if (object.kind === "text") {
      context.fillStyle = String(object.color || "#111111");
      context.font = `${Math.max(12, Number(object.fontSize || 20) * (size / 640))}px ${String(object.fontFamily || "Vazirmatn")}`;
      context.textBaseline = "top";
      context.fillText(String(object.text || ""), x, y, width);
    } else if (object.kind === "shape") {
      context.fillStyle = String(object.color || "#111111");
      context.fillRect(x, y, width, height);
    } else if (object.kind === "image" && object.src) {
      try {
        const response = await fetch(String(object.src));
        if (!response.ok) throw new Error("IMAGE_DOWNLOAD_FAILED");
        const image = await createImageBitmap(await response.blob());
        context.filter = `saturate(${Number(object.saturation ?? 100)}%)`;
        context.drawImage(image, x, y, width, height);
        image.close();
      } catch {
        context.strokeStyle = "#c9384f";
        context.strokeRect(x, y, width, height);
      }
    }
    context.restore();
  }
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, 1),
  );
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `chapli-${side.toLowerCase()}-${Date.now()}.${format}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PrintableDesign({ snapshot }: { snapshot: unknown }) {
  const [format, setFormat] = useState<"png" | "jpg">("png");
  const views =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? Object.entries(snapshot as Record<string, unknown>)
      : [];
  return (
    <div className="supplier-print-design">
      <div className="supplier-print-design-head">
        <h3>طرح خام آماده چاپ</h3>
        <label>
          فرمت خروجی
          <select value={format} onChange={(event) => setFormat(event.target.value as "png" | "jpg")}>
            <option value="png">PNG با بالاترین کیفیت</option>
            <option value="jpg">JPG با بالاترین کیفیت</option>
          </select>
        </label>
      </div>
      {views.map(([side, document]) => {
        const objects =
          document && typeof document === "object" && "objects" in document
            ? (document as { objects?: Array<Record<string, unknown>> })
                .objects || []
            : [];
        return (
          <article key={side}>
            <b>
              {side === "FRONT"
                ? "طرح جلو"
                : side === "BACK"
                  ? "طرح پشت"
                  : side}
            </b>
            <button type="button" className="supplier-design-download" onClick={() => downloadRenderedDesign(side, document, format)}>
              <Download /> دانلود {format.toUpperCase()}
            </button>
            <div className="supplier-print-sheet">
              {objects.map((object, index) => (
                <div
                  key={String(object.id || index)}
                  style={{
                    left: `${Number(object.x || 0)}%`,
                    top: `${Number(object.y || 0)}%`,
                    width: `${Number(object.w || 10)}%`,
                    height: `${Number(object.h || 10)}%`,
                    color: String(object.color || "#111"),
                    fontSize: `${Number(object.fontSize || 20)}px`,
                    fontFamily: String(object.fontFamily || "Vazirmatn"),
                    opacity: Number(object.opacity ?? 100) / 100,
                  }}
                >
                  {object.kind === "text" ? (
                    String(object.text || "")
                  ) : object.kind === "image" && object.src ? (
                    <>
                      <img src={String(object.src)} alt="فایل طرح" />
                      <a href={String(object.src)} download target="_blank">
                        دانلود فایل تصویر
                      </a>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        );
      })}
      {!views.length && (
        <div className="empty-state">
          سند طراحی برای این سفارش ثبت نشده است.
        </div>
      )}
    </div>
  );
}

function Orders({ data, detailId }: { data: SupplierData; detailId?: string }) {
  const [selected, setSelected] = useState(detailId || "");
  const [orderFilter, setOrderFilter] = useState("ACTIVE");
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [shippingMethod, setShippingMethod] = useState("POST");
  const active = data.fulfilments.find((item) => item.id === selected);
  const matchesFilter = (status: string) =>
    orderFilter === "ALL" ||
    (orderFilter === "ACTIVE" && !["SENT", "DONE", "CANCELLED", "RETURNED"].includes(status)) ||
    (orderFilter === "DONE" && ["DONE", "RETURNED"].includes(status)) ||
    status === orderFilter;
  const listedFulfilments = data.fulfilments.filter((item) => matchesFilter(item.status));
  return (
    <>
      <div className="supplier-page-title">
        <span>قدیمی‌ترین سفارش‌ها اول</span>
        <h1>سفارش‌های فعال</h1>
        <p>
          فایل چاپ را بگیر، تولید کن و پس از تحویل به پست کد رهگیری را ثبت کن.
        </p>
        {detailId && <Link href="/supplier/dashboard">بازگشت به فهرست سفارش‌ها</Link>}
      </div>
      <section className="supplier-kpis">
        <Kpi
          icon={<CircleDollarSign />}
          label="پرداخت‌شده"
          value={formatRial(data.balance.paid)}
          note="مجموع تسویه‌ها"
        />
        <Kpi
          icon={<ShoppingBag />}
          label="سفارش فعال"
          value={String(data.fulfilments.filter((item) => !["SENT", "DONE", "CANCELLED", "RETURNED"].includes(item.status)).length)}
          note="حداکثر ۱۰۰ مورد"
        />
        <Kpi
          icon={<AlertTriangle />}
          label="نزدیک سررسید"
          value={String(
            data.fulfilments.filter(
              (item) =>
                !["SENT", "DONE", "CANCELLED", "RETURNED"].includes(item.status) &&
                item.due_at &&
                new Date(item.due_at) < new Date(Date.now() + 86400000),
            ).length,
          )}
          note="نیازمند اقدام"
        />
        <Kpi
          icon={<Banknote />}
          label="درآمد در انتظار"
          value={formatRial(data.balance.pending)}
          note="پس از Done آزاد می‌شود"
        />
      </section>
      {!detailId && (
        <nav className="supplier-order-filters" aria-label="فیلتر سفارش‌ها">
          {[
            ["ACTIVE", "در حال انجام"],
            ["SENT", "ارسال‌شده"],
            ["DONE", "تکمیل‌شده"],
            ["CANCELLED", "لغوشده"],
            ["ALL", "همه"],
          ].map(([key, label]) => (
            <button
              type="button"
              className={orderFilter === key ? "active" : ""}
              onClick={() => { setOrderFilter(key); setSelected(""); }}
              key={key}
            >
              {label}
              <small>{data.fulfilments.filter((item) =>
                key === "ALL" ? true : key === "ACTIVE"
                  ? !["SENT", "DONE", "CANCELLED", "RETURNED"].includes(item.status)
                  : key === "DONE" ? ["DONE", "RETURNED"].includes(item.status)
                  : item.status === key,
              ).length.toLocaleString("fa-IR")}</small>
            </button>
          ))}
        </nav>
      )}
      {detailId || listedFulfilments.length ? (
        <section className={`supplier-order-layout ${detailId ? "detail-only" : ""}`}>
          {!detailId && (
          <div className="supplier-order-list">
            {listedFulfilments.map((job) => {
              const snapshot = job.item?.product_snapshot as
                Record<string, unknown> | undefined;
              const promisedDays = Number((job.assignment_snapshot as Record<string, unknown>)?.leadTimeDays || 4);
              const promisedDaysLeft = Math.max(0, Math.ceil((new Date(job.due_at || new Date(job.created_at).getTime() + promisedDays * 86400000).getTime() - Date.now()) / 86400000));
              return (
                <article key={job.id}>
                <Link href={`/supplier/dashboard/orders/${job.id}`}>
                  <i>{date(job.created_at)}</i>
                  <div>
                    <span>{job.order?.number || job.id.slice(0, 8)}</span>
                    <h3>{String(snapshot?.title || "محصول")}</h3>
                    <p>
                      {String(snapshot?.color || "—")} ·{" "}
                      {String(snapshot?.size || "—")} · تعداد{" "}
                      {job.item?.quantity || 1}
                    </p>
                    <small>{promisedDaysLeft} روز از زمان آماده‌سازی اعلامی باقی مانده</small>
                  </div>
                  <div>
                    <em>{fulfilmentStatusFa(job.status)}</em>
                    <strong>{formatRial(job.earning)}</strong>
                    {job.status !== "CANCELLED" && <small>خالص پس از کسر ۷٪</small>}
                  </div>
                    <ChevronLeft />
                  </Link>
                  {!['SENT', 'CANCELLED'].includes(job.status) && (
                    <button className="supplier-quick-send" onClick={() => { setSelected(job.id); setSending(true); }}>
                      <Truck /> ثبت ارسال
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          )}
          {active && (
            <aside className="supplier-job">
              <header>
                <div>
                  <span>برگه تولید</span>
                  <h2>{active.order?.number}</h2>
                </div>
                <em>{fulfilmentStatusFa(active.status)}</em>
              </header>
              {active.status === "CANCELLED" ? (
                <div className="supplier-deadline-alert danger">این سفارش به علت عبور از مهلت هفت‌روزه لغو شده و درآمدی برای آن ثبت نمی‌شود.</div>
              ) : (
                <div className="supplier-deadline-alert">
                  از زمان آماده‌سازی اعلامی شما {Math.max(0, Math.ceil((new Date(active.due_at || new Date(active.created_at).getTime() + Number((active.assignment_snapshot as Record<string, unknown>)?.leadTimeDays || 4) * 86400000).getTime() - Date.now()) / 86400000))} روز باقی مانده است.
                </div>
              )}
              {active.items.map((orderItem) => {
                const snapshot = orderItem.product_snapshot as Record<
                  string,
                  unknown
                >;
                return (
                  <section
                    className="supplier-order-item-production"
                    key={orderItem.id}
                  >
                    <div className="supplier-job-product">
                      <i>
                        {orderItem.mainImageUrl ? (
                          <img src={orderItem.mainImageUrl} alt={String(snapshot?.title || "تصویر محصول")} />
                        ) : "◫"}
                      </i>
                      <div>
                        <b>
                          {orderItem.rawProductName ||
                            String(snapshot?.title || "محصول چاپی")}
                        </b>
                        <small>{String(snapshot?.title || "")}</small>
                        <span>
                          {String(snapshot?.color || "—")} ·{" "}
                          {String(snapshot?.size || "—")} · تعداد{" "}
                          {orderItem.fulfilmentQuantity}
                        </span>
                      </div>
                    </div>
                    <PrintableDesign snapshot={orderItem.design_snapshot} />
                  </section>
                );
              })}
              <h3>فایل‌های آماده چاپ</h3>
              {active.files.length ? (
                active.files.map((file) => (
                  <a download href={file.url} key={file.file_id}>
                    <FileText />
                    <div>
                      <b>{file.purpose}</b>
                      <span>
                        {file.storage_files?.original_name || "فایل تولید"}
                      </span>
                    </div>
                    <Download />
                  </a>
                ))
              ) : (
                <div className="empty-state">
                  برای این سفارش هنوز فایل خروجی ثبت نشده است.
                </div>
              )}
              <h3>اطلاعات ارسال</h3>
              <dl>
                {Object.entries(
                  (active.order?.shipping_address_snapshot || {}) as Record<
                    string,
                    unknown
                  >,
                )
                  .slice(0, 6)
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{String(value || "—")}</dd>
                    </div>
                  ))}
              </dl>
              <div className="supplier-timeline">
                <p className="done">
                  <i />
                  <span>پرداخت و تخصیص</span>
                  <BadgeCheck />
                </p>
                <p className="current">
                  <i />
                  <span>{fulfilmentStatusFa(active.status)}</span>
                  <Clock3 />
                </p>
                <p>
                  <i />
                  <span>Done خودکار +۱۰ روز</span>
                </p>
              </div>
              {!['SENT', 'CANCELLED'].includes(active.status) ? (
                <button
                  className="supplier-sent"
                  onClick={() => setSending(true)}
                >
                  <Truck /> ثبت ارسال و کد رهگیری
                </button>
              ) : null}
            </aside>
          )}
        </section>
      ) : (
        <div className="supplier-card empty-state">
          <Package />
          <h2>سفارش فعالی ندارید</h2>
          <p>وقتی محصولی به شرکت شما تخصیص داده شود اینجا ظاهر می‌شود.</p>
        </div>
      )}
      {active && (
        <button
          className="supplier-report-problem"
          onClick={() => setReporting(true)}
        >
          <AlertTriangle /> نمی‌توانم طبق برنامه تأمین کنم / مشکلی پیش آمده
        </button>
      )}
      {sending && active && (
        <div className="supplier-modal-back">
          <ActionForm
            action={markFulfilmentSentAction}
            className="supplier-modal"
          >
            <button type="button" onClick={() => setSending(false)}>
              <X />
            </button>
            <span>ثبت تحویل به پست</span>
            <h2>کد رهگیری را وارد کنید</h2>
            <p>{active.order?.number}</p>
            <input type="hidden" name="fulfilmentId" value={active.id} />
            <label>
              کد رهگیری / پستی
              <input name="trackingCode" required minLength={5} />
            </label>
            <label>
              روش ارسال
              <select name="shippingMethod" required value={shippingMethod} onChange={(event) => setShippingMethod(event.target.value)}>
                <option value="POST">پست</option>
                <option value="TIPAX">تیپاکس</option>
                <option value="OTHER">سایر</option>
              </select>
            </label>
            {shippingMethod === "OTHER" && (
              <label>
                نام روش ارسال
                <input name="customShippingMethod" required minLength={2} placeholder="روش ارسال را بنویسید" />
              </label>
            )}
            <button>
              تأیید ارسال <Send />
            </button>
          </ActionForm>
        </div>
      )}
      {reporting && active && (
        <div className="supplier-modal-back">
          <ActionForm
            action={reportFulfilmentExceptionAction}
            className="supplier-modal"
          >
            <button type="button" onClick={() => setReporting(false)}>
              <X />
            </button>
            <span>گزارش فوری عملیات</span>
            <h2>چه مشکلی پیش آمده؟</h2>
            <p>{active.order?.number}</p>
            <input type="hidden" name="fulfilmentId" value={active.id} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`${active.id}:exception:${active.status}`}
            />
            <label>
              نوع مشکل
              <select name="exceptionType" required>
                <option value="CANNOT_SUPPLY">امکان تأمین ندارم</option>
                <option value="DAMAGED_PRINT">چاپ یا محصول آسیب دیده</option>
                <option value="FILE_ISSUE">فایل چاپ مشکل دارد</option>
                <option value="CAPACITY">کمبود ظرفیت / تأخیر</option>
                <option value="CANCELLATION">موضوع لغو</option>
                <option value="RETURN">موضوع مرجوعی</option>
                <option value="OTHER">سایر</option>
              </select>
            </label>
            <label>
              شرح دقیق
              <textarea name="description" minLength={10} required rows={5} />
            </label>
            <div>
              <AlertTriangle />
              <p>
                <b>این گزارش سفارش را پنهان نمی‌کند</b>
                <span>
                  مدیر برای جایگزینی تأمین‌کننده، reprint یا تصمیم عملیاتی بررسی
                  می‌کند.
                </span>
              </p>
            </div>
            <button>
              ثبت گزارش فوری <Send />
            </button>
          </ActionForm>
        </div>
      )}
    </>
  );
}

function Financial({ data }: { data: SupplierData }) {
  return (
    <>
      <div className="supplier-page-title">
        <span>مالی شرکت</span>
        <h1>درآمد و تسویه</h1>
        <p>فقط سفارش‌های Done وارد موجودی قابل برداشت می‌شوند.</p>
      </div>
      <section className="supplier-fin-hero">
        <div>
          <span>قابل برداشت</span>
          <strong>{formatRial(data.balance.available)}</strong>
          <p>{formatRial(data.balance.pending)} در انتظار Done</p>
        </div>
        {data.banks[0] ? (
          <ActionForm action={requestPayoutAction}>
            <input type="hidden" name="role" value="supplier" />
            <input
              type="hidden"
              name="bankAccountId"
              value={data.banks[0].id}
            />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`supplier-payout-${new Date().toISOString().slice(0, 10)}-${data.balance.available}`}
            />
            <label>
              مبلغ تسویه
              <input name="amount" type="number" min="1" max={data.balance.available} defaultValue={data.balance.available} required />
            </label>
            <button disabled={data.balance.available <= 0}>
              درخواست تسویه کامل
            </button>
          </ActionForm>
        ) : (
          <Link className="button button-primary" href="#supplier-bank-accounts">
            افزودن حساب بانکی برای تسویه
          </Link>
        )}
      </section>
      <section className="supplier-kpis">
        <Kpi
          icon={<Banknote />}
          label="قابل برداشت"
          value={formatRial(data.balance.available)}
          note="آزاد"
        />
        <Kpi
          icon={<Clock3 />}
          label="در انتظار"
          value={formatRial(data.balance.pending)}
          note="هنوز Done نشده"
        />
        <Kpi
          icon={<BadgeCheck />}
          label="رزرو تسویه"
          value={formatRial(data.balance.reserved)}
          note="در صف پرداخت"
        />
      </section>
      <section className="supplier-card supplier-bank-panel" id="supplier-bank-accounts">
        <div className="supplier-card-head">
          <div>
            <h2>حساب‌های بانکی</h2>
            <p>اولویت اول، مقصد اصلی تسویه است.</p>
          </div>
        </div>
        <div className="supplier-bank-list">
          {data.banks.map((bank, index) => (
            <article key={bank.id}>
              <Landmark />
              <div>
                <b>
                  {bank.bank_name || "بانک"}
                  {index === 0 && <small> اصلی</small>}
                </b>
                <span dir="ltr">{bank.card_number}</span>
                <em dir="ltr">{bank.iban}</em>
              </div>
              <ActionForm action={deleteBankAccountAction} refreshAfterSuccess>
                <input type="hidden" name="role" value="supplier" />
                <input type="hidden" name="id" value={bank.id} />
                <button>
                  <Trash2 />
                </button>
              </ActionForm>
            </article>
          ))}
        </div>
        <ActionForm
          action={saveBankAccountAction}
          refreshAfterSuccess
          className="supplier-bank-form"
        >
          <input type="hidden" name="role" value="supplier" />
          <label>
            نام بانک
            <input name="bankName" required />
          </label>
          <label>
            نام صاحب حساب
            <input name="accountHolder" required />
          </label>
          <label>
            شماره کارت
            <input name="cardNumber" inputMode="numeric" required />
          </label>
          <label>
            شماره شبا
            <input name="iban" dir="ltr" placeholder="IR..." required />
          </label>
          <label>
            اولویت
            <input
              name="priority"
              type="number"
              min="1"
              defaultValue={data.banks.length + 1}
            />
          </label>
          <button>
            <Plus /> افزودن حساب
          </button>
        </ActionForm>
      </section>
      <section className="supplier-card">
        <div className="supplier-card-head">
          <div>
            <h2>تاریخچه تسویه</h2>
            <p>درخواست‌ها و پرداخت‌های واقعی</p>
          </div>
        </div>
        {data.payouts.length ? (
          data.payouts.map((item) => (
            <div className="supplier-pay-row" key={item.id}>
              <FileText />
              <b>{item.id.slice(0, 8)}</b>
              <span>{date(item.requested_at)}</span>
              <strong>{formatRial(item.amount)}</strong>
              <em>{earningStatusFa(item.status)}</em>
            </div>
          ))
        ) : (
          <div className="empty-state">هنوز درخواست تسویه‌ای ندارید.</div>
        )}
      </section>
      <section className="supplier-card">
        <div className="supplier-card-head"><div><h2>دفتر درآمد</h2><p>سهم ثابت، کارمزد ۷٪ و مبلغ خالص هر سفارش</p></div></div>
        {data.earnings.length ? data.earnings.map((item) => {
          const order = relationOne(item.orders);
          const orderItem = relationOne(item.order_items);
          const snapshot = orderItem?.product_snapshot as Record<string, unknown> | undefined;
          return <div className="supplier-pay-row supplier-income-row" key={item.id}>
            <Package />
            <span><b>{order?.number || item.order_id?.slice(0, 8) || "—"}</b><small>{String(snapshot?.title || "محصول")} · {Number(orderItem?.quantity || 1).toLocaleString("fa-IR")} عدد</small></span>
            <span>{date(item.created_at)}</span>
            <em>{earningStatusFa(item.status)}</em>
            <span>{formatRial(item.gross_amount)} ناخالص</span>
            <span>{formatRial(item.fee_amount)} سهم چاپلی (۷٪)</span>
            <strong>{formatRial(item.net_amount)} خالص</strong>
          </div>;
        }) : <div className="empty-state">هنوز درآمدی ثبت نشده است.</div>}
      </section>
    </>
  );
}

function RawProducts({ data }: { data: SupplierData }) {
  const requestedRaw = useSearchParams().get("raw");
  const [selected, setSelected] = useState<string | null>(
    data.rawProducts.some((item) => item.id === requestedRaw)
      ? requestedRaw
      : null,
  );
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [bulkQuantity, setBulkQuantity] = useState("");
  const [bulkCost, setBulkCost] = useState("");
  const raw = data.rawProducts.find((item) => item.id === selected);
  const openInventory = (product: SupplierData["rawProducts"][number]) => {
    const current = product.offer?.variants || [];
    setSelectedVariants(
      current
        .filter((variant) => variant.stock_quantity > 0)
        .map((variant) => variant.raw_product_variant_id),
    );
    setQuantities(
      Object.fromEntries(
        product.variants.map((variant) => [
          variant.id,
          current.find((item) => item.raw_product_variant_id === variant.id)
            ?.stock_quantity || 0,
        ]),
      ),
    );
    const defaultCost = Math.max(1, product.offer?.base_cost || product.base_cost || 1);
    setCosts(
      Object.fromEntries(
        product.variants.map((variant) => [
          variant.id,
          current.find((item) => item.raw_product_variant_id === variant.id)
            ?.unit_cost || defaultCost,
        ]),
      ),
    );
    setBulkQuantity("");
    setBulkCost("");
    setSelected(product.id);
  };
  return (
    <>
      <div className="supplier-page-title">
        <span>کاتالوگ قابل تولید</span>
        <h1>محصولات خام و موجودی</h1>
        <p>
          برای هر ترکیب رنگ و سایز موجودی دقیق وارد کنید. هر تغییر برای بررسی
          مدیر ارسال می‌شود.
        </p>
      </div>
      <section className="supplier-raw-grid">
        {data.rawProducts.length ? (
          data.rawProducts.map((product) => (
            <article key={product.id}>
              <div>
                {product.mainImageUrl ? (
                  <img src={product.mainImageUrl} alt={product.name} />
                ) : (
                  <Package aria-label="تصویر محصول موجود نیست" />
                )}
                {product.offer && (
                  <em>
                    <BadgeCheck />{" "}
                    {product.offer.approval_status === "APPROVED"
                      ? "تأییدشده"
                      : product.offer.approval_status === "REJECTED"
                        ? "ردشده"
                        : "در انتظار تأیید"}
                  </em>
                )}
              </div>
              <section>
                <small>{product.has_back ? "جلو + پشت" : "فقط جلو"}</small>
                <h3>{product.name}</h3>
                <p>
                  هزینه مرجع: <b>{formatRial(product.base_cost)}</b>
                </p>
                <div>
                  <span>{product.colorCount} رنگ</span>
                  <span>{product.sizeCount} سایز</span>
                </div>
                <button
                  className={
                    product.offer?.approval_status === "APPROVED"
                      ? "approved"
                      : ""
                  }
                  onClick={() => openInventory(product)}
                >
                  {product.offer ? "ویرایش موجودی" : "ثبت موجودی"}{" "}
                  <ChevronLeft />
                </button>
              </section>
            </article>
          ))
        ) : (
          <div className="empty-state">محصول خام فعالی وجود ندارد.</div>
        )}
      </section>
      {raw && (
        <div className="supplier-modal-back">
          <ActionForm
            action={supplierSubmitOfferAction}
            className="supplier-modal supply-modal"
          >
            <button type="button" onClick={() => setSelected(null)}>
              <X />
            </button>
            <span>اعلام موجودی دقیق</span>
            <h2>{raw.name}</h2>
            <input type="hidden" name="rawProductId" value={raw.id} />
            <div className="supply-variant-toolbar">
              <div>
                <h3>تنوع‌های قابل تولید</h3>
                <small>
                  {selectedVariants.length.toLocaleString("fa-IR")} مورد از{" "}
                  {raw.variants.length.toLocaleString("fa-IR")} انتخاب شده
                </small>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedVariants(
                      raw.variants.map((variant) => variant.id),
                    )
                  }
                >
                  انتخاب همه
                </button>
                <button type="button" onClick={() => setSelectedVariants([])}>
                  لغو همه
                </button>
              </div>
            </div>
            <div className="supply-bulk-inventory">
              <label>
                موجودی یکسان برای موارد انتخاب‌شده
                <input
                  type="number"
                  min="0"
                  value={bulkQuantity}
                  onChange={(event) => setBulkQuantity(event.target.value)}
                  placeholder="مثلاً ۵۰"
                />
              </label>
              <button
                type="button"
                disabled={!selectedVariants.length || bulkQuantity === ""}
                onClick={() => {
                  const quantity = Math.max(
                    0,
                    Math.floor(Number(bulkQuantity)),
                  );
                  setQuantities((current) => ({
                    ...current,
                    ...Object.fromEntries(
                      selectedVariants.map((id) => [id, quantity]),
                    ),
                  }));
                }}
              >
                اعمال موجودی
              </button>
            </div>
            <div className="supply-bulk-inventory supply-bulk-cost">
              <label>
                قیمت تأمین یکسان برای تنوع‌های انتخاب‌شده (ریال)
                <input
                  type="number"
                  min="1"
                  value={bulkCost}
                  onChange={(event) => setBulkCost(event.target.value)}
                  placeholder="مثلاً ۵۰۰۰۰۰"
                />
              </label>
              <button
                type="button"
                disabled={!selectedVariants.length || Number(bulkCost) < 1}
                onClick={() => {
                  const cost = Math.max(1, Math.floor(Number(bulkCost)));
                  setCosts((current) => ({
                    ...current,
                    ...Object.fromEntries(selectedVariants.map((id) => [id, cost])),
                  }));
                }}
              >
                کپی قیمت برای انتخاب‌ها
              </button>
            </div>
            <div className="supply-inventory-grid">
              {raw.variants.map((variant) => {
                const color = raw.colors.find(
                  (item) => item.id === variant.color_id,
                );
                const size = raw.sizes.find(
                  (item) => item.id === variant.size_id,
                );
                return (
                  <label key={variant.id}>
                    <input
                      name="variantIds"
                      value={variant.id}
                      type="checkbox"
                      checked={selectedVariants.includes(variant.id)}
                      onChange={(event) =>
                        setSelectedVariants((items) =>
                          event.target.checked
                            ? [...items, variant.id]
                            : items.filter((id) => id !== variant.id),
                        )
                      }
                    />
                    <span>
                      {color?.name} · {size?.name}
                    </span>
                    <div className="supply-variant-number">
                      <small>موجودی</small>
                      <input
                        aria-label={`موجودی ${color?.name} ${size?.name}`}
                        name={`quantity_${variant.id}`}
                        type="number"
                        min="0"
                        value={quantities[variant.id] || 0}
                        onChange={(event) =>
                          setQuantities((items) => ({
                            ...items,
                            [variant.id]: Math.max(0, Math.floor(Number(event.target.value))),
                          }))
                        }
                        disabled={!selectedVariants.includes(variant.id)}
                      />
                    </div>
                    <div className="supply-variant-number">
                      <small>قیمت تأمین (ریال)</small>
                      <input
                        aria-label={`قیمت تأمین ${color?.name} ${size?.name}`}
                        name={`cost_${variant.id}`}
                        type="number"
                        min="1"
                        step="1"
                        required={selectedVariants.includes(variant.id)}
                        value={costs[variant.id] || 1}
                        onChange={(event) =>
                          setCosts((items) => ({
                            ...items,
                            [variant.id]: Math.max(1, Math.floor(Number(event.target.value))),
                          }))
                        }
                        disabled={!selectedVariants.includes(variant.id)}
                      />
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="supply-fields">
              <label>
                زمان آماده‌سازی (روز)
                <input
                  name="leadTimeDays"
                  type="number"
                  min="1"
                  defaultValue={raw.offer?.lead_time_days || 4}
                />
              </label>
              <label>
                ظرفیت روزانه
                <input
                  name="capacityPerDay"
                  type="number"
                  min="1"
                  defaultValue={raw.offer?.capacity_per_day || 20}
                  required
                />
              </label>
            </div>
            <div className="auto-approve">
              <Clock3 />
              <p>
                <b>نیازمند تأیید مدیر</b>
                <span>
                  تا قبل از تأیید، این موجودی برای فروشندگان قابل انتخاب نیست.
                </span>
              </p>
            </div>
            <button>ثبت موجودی و ارسال برای تأیید</button>
          </ActionForm>
        </div>
      )}
    </>
  );
}
