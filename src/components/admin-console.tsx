"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Archive,
  BadgeCheck,
  Banknote,
  Bot,
  BookOpen,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileUp,
  ImagePlus,
  Package,
  Palette,
  Pencil,
  Plus,
  Receipt,
  Settings2,
  ShoppingBag,
  Truck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { RawPrintAreaField } from "@/components/raw-print-area-field";
import { FreeDesignBatchForm } from "@/components/free-design-batch-form";
import {
  archiveRawProductAction,
  deleteRawProductAction,
  adminDeleteOrderAction,
  adminUpdateOrderAction,
  archiveGraphicStyleAction,
  completePayoutAction,
  completeBuyerRefundAction,
  deleteApprovedProductAction,
  moderateProductAction,
  unapproveProductAction,
  resolveDisputeAction,
  reviewCancellationAction,
  reviewReturnAction,
  deleteSupportKnowledgeAction,
  deleteFreeDesignAction,
  deleteGraphicStyleAction,
  saveRejectionReasonAction,
  saveFreeDesignAction,
  saveGraphicStyleAction,
  saveSupportKnowledgeAction,
  saveSupportAiSettingsAction,
  uploadSupportKnowledgeFileAction,
  reviewSupplierOfferAction,
  upsertRawProductAction,
} from "@/app/actions/dashboard";
import type { getAdminDashboardData } from "@/lib/dashboard-data";

type AdminData = Awaited<ReturnType<typeof getAdminDashboardData>>;
type Section =
  | "dashboard"
  | "financial"
  | "raw-products"
  | "pending-products"
  | "orders"
  | "settings";
const money = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const date = (value: string) =>
  new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function AdminConsole({
  section,
  data,
}: {
  section: Section;
  data: AdminData;
}) {
  const titles = {
    dashboard: "داشبورد",
    financial: "مدیریت مالی",
    "raw-products": "محصولات خام",
    "pending-products": "بررسی محصولات",
    orders: "سفارش‌های ناتمام",
    settings: "تنظیمات",
  } as const;
  return (
    <div className="admin-page">
      <div className="admin-page-title">
        <div>
          <span>پنل مدیریت / {titles[section]}</span>
          <h1>{titles[section]}</h1>
        </div>
        <div>
          <button>
            <Clock3 /> داده زنده Supabase
          </button>
        </div>
      </div>
      {section === "dashboard" && <Dashboard data={data} />}
      {section === "financial" && <Financial data={data} />}
      {section === "raw-products" && <RawProducts data={data} />}
      {section === "pending-products" && <PendingProducts data={data} />}
      {section === "orders" && <Orders data={data} />}
      {section === "settings" && <Settings data={data} />}
    </div>
  );
}

function Metric({
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
      <div>
        {icon}
        <span>{note}</span>
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function Dashboard({ data }: { data: AdminData }) {
  return (
    <div className="admin-stack">
      <section className="admin-kpis">
        <Metric
          icon={<ShoppingBag />}
          label="سفارش‌های باز"
          value={String(data.stats.openOrders)}
          note="قدیمی‌ترین اول"
        />
        <Metric
          icon={<Clock3 />}
          label="محصول در صف بررسی"
          value={String(data.stats.pendingProducts)}
          note="نیازمند تصمیم"
        />
        <Metric
          icon={<Users />}
          label="فروشنده / تأمین‌کننده"
          value={`${data.stats.sellers} / ${data.stats.suppliers}`}
          note="سازمان فعال"
        />
        <Metric
          icon={<CircleDollarSign />}
          label="تسویه در صف"
          value={money(data.stats.payoutAmount)}
          note={`${data.stats.payoutCount} درخواست`}
        />
      </section>
      <section className="admin-grid-main">
        <article className="admin-card admin-overview">
          <div className="admin-card-head">
            <div>
              <h2>نبض عملیات</h2>
              <p>تصویر فشرده از صف‌های واقعی دیتابیس</p>
            </div>
            <span>● زنده</span>
          </div>
          <div className="ops-grid">
            <a href="/admin/orders">
              <Truck />
              <b>{data.stats.openOrders}</b>
              <span>سفارش ناتمام</span>
            </a>
            <a href="/admin/pending-products">
              <Package />
              <b>{data.stats.pendingProducts}</b>
              <span>محصول منتظر</span>
            </a>
            <a href="/admin/financial">
              <Receipt />
              <b>{data.stats.payoutCount}</b>
              <span>پرداخت در صف</span>
            </a>
            <a href="/admin/raw-products">
              <Boxes />
              <b>{data.stats.rawProducts}</b>
              <span>محصول خام</span>
            </a>
          </div>
        </article>
        <article className="admin-card admin-attention">
          <div className="admin-card-head">
            <div>
              <h2>نیازمند توجه</h2>
              <p>کارهای قابل اقدام همین حالا</p>
            </div>
          </div>
          <a href="/admin/financial">
            <i className="purple">
              <Banknote />
            </i>
            <div>
              <b>{data.stats.payoutCount} درخواست تسویه</b>
              <span>{money(data.stats.payoutAmount)} ریال</span>
            </div>
          </a>
          <a href="/admin/pending-products">
            <i className="lime">
              <BadgeCheck />
            </i>
            <div>
              <b>{data.stats.pendingProducts} محصول برای بررسی</b>
              <span>تأیید یا رد با دلیل</span>
            </div>
          </a>
        </article>
      </section>
      <OrderList orders={data.orders.slice(0, 5)} />
    </div>
  );
}

function Financial({ data }: { data: AdminData }) {
  return (
    <div className="admin-stack">
      <section className="admin-money-hero">
        <div>
          <span>در صف تسویه</span>
          <strong>
            {money(data.stats.payoutAmount)} <small>ریال</small>
          </strong>
          <p>فقط درآمدهای آزادشده از سفارش‌های Done در این صف هستند.</p>
        </div>
        <div>
          <i>
            <Receipt />
          </i>
          <span>درخواست فعال</span>
          <b>{data.payouts.length}</b>
        </div>
        <div>
          <i><CircleDollarSign /></i>
          <span>درآمد شرکت (کارمزدها)</span>
          <b>{money(data.companyRevenue)} ریال</b>
        </div>
      </section>
      <section className="admin-card admin-payout-split">
        <div><h3>تسویه فروشندگان</h3><b>{data.payouts.filter((item) => item.organization?.type === "SELLER").length}</b></div>
        <div><h3>تسویه تأمین‌کنندگان</h3><b>{data.payouts.filter((item) => item.organization?.type === "SUPPLIER").length}</b></div>
      </section>
      <section className="admin-payout-list">
        <div className="admin-section-head">
          <div>
            <h2>درخواست‌های پرداخت</h2>
            <p>قدیمی‌ترین درخواست در ابتدا نمایش داده می‌شود.</p>
          </div>
        </div>
        {data.payouts.length ? (
          data.payouts.map((payout) => (
            <details className="admin-payout" key={payout.id}>
              <summary className="admin-payout-main">
                <div className="admin-store-avatar">
                  {payout.organization?.display_name?.slice(0, 1) || "چ"}
                </div>
                <div>
                  <b>{payout.organization?.display_name || "سازمان"}</b>
                  <span>{payout.organization?.type}</span>
                </div>
                <div>
                  <span>مبلغ</span>
                  <b>{money(payout.amount)} ریال</b>
                </div>
                <div>
                  <span>کارت / شبا</span>
                  <b dir="ltr">
                    {payout.bank?.card_number || payout.bank?.iban || "—"}
                  </b>
                </div>
                <div>
                  <span>درخواست</span>
                  <b>{date(payout.requested_at)}</b>
                </div>
                <ChevronDown />
              </summary>
              <div className="admin-payout-detail">
                <div className="admin-order-mini">
                  <div>
                    <span>سفارش</span>
                    <span>سهم</span>
                    <span>وضعیت</span>
                  </div>
                  {payout.orders.map((order, index) => (
                    <div key={`${order.id}-${index}`}>
                      <b>{order.id || "—"}</b>
                      <strong>{money(order.amount)} ریال</strong>
                      <em>Done</em>
                    </div>
                  ))}
                </div>
                <ActionForm
                  action={completePayoutAction}
                  className="dashboard-action-form"
                >
                  <input type="hidden" name="payoutId" value={payout.id} />
                  <label>
                    رسید (اختیاری)
                    <input name="receipt" type="file" accept="image/*" />
                  </label>
                  <label>
                    شماره پیگیری / توضیح
                    <input name="reference" />
                  </label>
                  <button className="admin-primary">تأیید و ثبت پرداخت</button>
                </ActionForm>
              </div>
            </details>
          ))
        ) : (
          <Empty
            icon={<BadgeCheck />}
            title="صف تسویه خالی است"
            text="درخواست جدید فروشنده یا تأمین‌کننده اینجا ظاهر می‌شود."
          />
        )}
      </section>
      <section className="admin-payout-list buyer-refund-queue">
        <div className="admin-section-head">
          <div>
            <h2>بازپرداخت خریداران به کارت بانکی</h2>
            <p>مبالغ سفارش‌های لغوشده که خریدار بازگشت به کارت را انتخاب کرده است.</p>
          </div>
        </div>
        {data.buyerRefunds.filter((refund) => refund.status !== "SUCCEEDED").length ? (
          data.buyerRefunds.filter((refund) => refund.status !== "SUCCEEDED").map((refund) => (
            <article className="admin-card buyer-refund-row" key={refund.id}>
              <div><b>{[refund.buyer?.first_name, refund.buyer?.last_name].filter(Boolean).join(" ") || "خریدار"}</b><span>{refund.orders?.number || refund.order_id}</span></div>
              <div><span>مبلغ</span><strong>{money(refund.amount)} ریال</strong></div>
              <div><span>شماره کارت</span><b dir="ltr">{refund.destination_card_number || "—"}</b></div>
              <ActionForm action={completeBuyerRefundAction}>
                <input type="hidden" name="refundId" value={refund.id} />
                <input name="reference" placeholder="شماره پیگیری بانکی" required />
                <input name="receipt" type="file" accept="image/*,application/pdf" required />
                <button className="admin-primary">پرداخت شد و ثبت رسید</button>
              </ActionForm>
            </article>
          ))
        ) : <Empty icon={<BadgeCheck />} title="بازپرداخت بانکی در صف نیست" text="همه درخواست‌ها پرداخت شده‌اند." />}
      </section>
    </div>
  );
}

function RawProducts({ data }: { data: AdminData }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = data.rawProducts.find((raw) => raw.id === editingId);
  return (
    <div className="admin-stack">
      <div className="admin-section-head">
        <div>
          <h2>کاتالوگ تولید</h2>
          <p>اطلاعات، تنوع‌ها و محدوده چاپ در PostgreSQL ذخیره می‌شوند.</p>
        </div>
        <button className="admin-primary" onClick={() => setEditingId("new")}>
          <Plus /> محصول خام جدید
        </button>
      </div>
      {editingId && (
        <div className="raw-edit-backdrop">
          <div className="raw-edit-dialog">
            <button
              className="raw-edit-close"
              onClick={() => setEditingId(null)}
              aria-label="بستن"
            >
              <X />
            </button>
            <RawProductForm data={data} raw={editing} />
          </div>
        </div>
      )}
      <section className="admin-card supplier-offer-review">
        <div className="admin-section-head">
          <div>
            <h2>درخواست‌های موجودی تأمین‌کنندگان</h2>
            <p>
              موجودی هر تنوع پس از تأیید شما برای فروشنده قابل انتخاب می‌شود.
            </p>
          </div>
          <b>
            {data.supplierOffers
              .filter((offer) => offer.approval_status === "PENDING")
              .length.toLocaleString("fa-IR")}
          </b>
        </div>
        <div className="supplier-offer-review-list">
          {data.supplierOffers
            .filter((offer) => offer.approval_status === "PENDING")
            .map((offer) => (
              <article key={offer.id}>
                <div>
                  <span>
                    {offer.organization?.display_name || "تأمین‌کننده"}
                  </span>
                  <h3>{offer.rawProduct?.name || "محصول خام"}</h3>
                  <p>
                    {
                      offer.variants.filter(
                        (variant) => variant.stock_quantity > 0,
                      ).length
                    }{" "}
                    تنوع · مجموع موجودی{" "}
                    {offer.variants
                      .reduce((sum, variant) => sum + variant.stock_quantity, 0)
                      .toLocaleString("fa-IR")}{" "}
                    · آماده‌سازی {offer.lead_time_days} روز
                  </p>
                </div>
                <ActionForm
                  action={reviewSupplierOfferAction}
                  refreshAfterSuccess
                >
                  <input type="hidden" name="offerId" value={offer.id} />
                  <input name="note" placeholder="یادداشت بررسی (اختیاری)" />
                  <div>
                    <button
                      name="decision"
                      value="APPROVED"
                      className="admin-primary"
                    >
                      <BadgeCheck /> تأیید موجودی
                    </button>
                    <button
                      name="decision"
                      value="REJECTED"
                      className="danger-button"
                    >
                      رد درخواست
                    </button>
                  </div>
                </ActionForm>
              </article>
            ))}
          {!data.supplierOffers.some(
            (offer) => offer.approval_status === "PENDING",
          ) && (
            <div className="empty-state">
              درخواست موجودی در انتظار بررسی نیست.
            </div>
          )}
        </div>
      </section>
      <section className="raw-admin-grid">
        {data.rawProducts.length ? (
          data.rawProducts.map((raw) => (
            <article key={raw.id}>
              <div className="raw-admin-art">
                {raw.mainImageUrl ? (
                  <Image
                    src={raw.mainImageUrl}
                    alt={raw.name}
                    width={640}
                    height={512}
                    sizes="(max-width: 800px) 100vw, 33vw"
                  />
                ) : (
                  <span>◫</span>
                )}
                <em>{raw.status}</em>
              </div>
              <div>
                <small>{raw.has_back ? "جلو + پشت" : "فقط جلو"}</small>
                <h3>{raw.name}</h3>
                <p>{money(raw.base_cost)} ریال هزینه پایه</p>
                <div>
                  <span>{raw.colors.length} رنگ</span>
                  <span>{raw.sizes.length} سایز</span>
                </div>
                <footer className="raw-admin-actions">
                  <button onClick={() => setEditingId(raw.id)}>
                    <Pencil /> ویرایش
                  </button>
                  <ActionForm
                    action={archiveRawProductAction}
                    confirmMessage={`«${raw.name}» بایگانی شود؟ این محصول دیگر برای ساخت محصول جدید نمایش داده نمی‌شود.`}
                  >
                    <input type="hidden" name="id" value={raw.id} />
                    <button className="danger-link">
                      <Archive /> بایگانی
                    </button>
                  </ActionForm>
                  <ActionForm
                    action={deleteRawProductAction}
                    confirmMessage={`«${raw.name}» برای همیشه حذف شود؟ این عملیات قابل بازگشت نیست.`}
                  >
                    <input type="hidden" name="id" value={raw.id} />
                    <button className="raw-delete-button">
                      <Trash2 /> حذف
                    </button>
                  </ActionForm>
                </footer>
              </div>
            </article>
          ))
        ) : (
          <Empty
            icon={<Boxes />}
            title="محصول خامی وجود ندارد"
            text="اولین محصول خام را ایجاد کنید."
          />
        )}
      </section>
    </div>
  );
}

function RawProductForm({
  data,
  raw,
}: {
  data: AdminData;
  raw?: AdminData["rawProducts"][number];
}) {
  const [hasBack, setHasBack] = useState(Boolean(raw?.has_back));
  const [colors, setColors] = useState(
    raw?.colors.length
      ? raw.colors.map((color) => ({
          name: color.name,
          hex: color.hex || "#808080",
        }))
      : [{ name: "", hex: "#202124" }],
  );
  const [sizesText, setSizesText] = useState(
    raw?.sizes.map((item) => item.name).join(", ") || "",
  );
  const existingGuide = raw?.size_guide as { columns?: unknown; rows?: unknown } | null;
  const initialColumns = Array.isArray(existingGuide?.columns)
    ? existingGuide.columns.map(String)
    : [];
  const [guideColumns, setGuideColumns] = useState<string[]>(initialColumns);
  const [guideRows, setGuideRows] = useState<string[][]>(
    Array.isArray(existingGuide?.rows)
      ? existingGuide.rows.map((row) =>
          Array.from({ length: initialColumns.length }, (_, index) =>
            String(Array.isArray(row) ? row[index] ?? "" : ""),
          ),
        )
      : [],
  );
  const sizeNames = sizesText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const front = raw?.views.find((view) => view.side === "FRONT"),
    back = raw?.views.find((view) => view.side === "BACK");
  return (
    <ActionForm
      action={upsertRawProductAction}
      className="admin-card raw-product-form"
      refreshAfterSuccess={false}
      confirmMessage={
        raw
          ? "اگر محدوده چاپ را تغییر داده‌اید، بعد از ذخیره باید محدوده موکاپ‌های این محصول را هم فوراً بازبینی کنید. ادامه می‌دهید؟"
          : undefined
      }
      onSuccess={() => {
        if (
          raw &&
          window.confirm(
            "محصول خام ذخیره شد. آیا می‌خواهید همین حالا محدوده موکاپ‌های آن را هماهنگ کنید؟",
          )
        )
          window.location.href = "/admin/mockups";
      }}
    >
      {raw && <input type="hidden" name="id" value={raw.id} />}
      <div className="raw-form-heading">
        <div>
          <span>{raw ? "ویرایش محصول خام" : "محصول خام جدید"}</span>
          <h3>{raw?.name || "اطلاعات تولید را کامل کنید"}</h3>
        </div>
        <small>فایل جدید اختیاری است؛ فایل‌های قبلی بدون تغییر می‌مانند.</small>
      </div>
      <div className="form-grid">
        <label className="wide raw-main-image-field">
          تصویر اصلی محصول
          {raw?.mainImageUrl && (
            <Image
              src={raw.mainImageUrl}
              alt={raw.name}
              width={320}
              height={220}
            />
          )}
          <input
            name="mainImage"
            type="file"
            accept="image/*"
            required={!raw?.mainImageUrl}
          />
          <small>
            این تصویر در کارت محصول خامِ پنل مدیر و مرحله انتخاب فروشنده نمایش
            داده می‌شود.
          </small>
        </label>
        <label>
          نام
          <input name="name" required defaultValue={raw?.name} />
        </label>
        <label>
          شناسه انگلیسی
          <input
            name="slug"
            required
            placeholder="oversize-tshirt"
            defaultValue={raw?.slug}
          />
        </label>
        <label>
          دسته
          <select
            name="categoryId"
            required
            defaultValue={raw?.category_id || ""}
          >
            <option value="">انتخاب کنید</option>
            {data.categories.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          پیشوند SKU
          <input name="skuPrefix" defaultValue={raw?.sku_prefix || "RAW"} />
        </label>
        <label>
          هزینه پایه (ریال)
          <input
            name="baseCost"
            type="number"
            min="0"
            required
            defaultValue={raw?.base_cost}
          />
        </label>
        <label>
          قیمت پیشنهادی
          <input
            name="suggestedPrice"
            type="number"
            min="0"
            defaultValue={raw?.suggested_price || 0}
          />
        </label>
        <label>
          جنس
          <input name="material" defaultValue={raw?.material || ""} />
        </label>
        <label>
          وزن (گرم)
          <input
            name="weightGrams"
            type="number"
            min="1"
            defaultValue={raw?.weight_grams || ""}
          />
        </label>
        <label className="wide">
          توضیحات
          <textarea name="description" defaultValue={raw?.description || ""} />
        </label>
        <label className="wide">
          یادداشت تولید
          <textarea
            name="productionNotes"
            defaultValue={raw?.production_notes || ""}
          />
        </label>
        <div className="wide raw-color-editor">
          <div>
            <b>رنگ‌های محصول خام</b>
            <button
              type="button"
              onClick={() =>
                setColors((current) => [
                  ...current,
                  { name: "", hex: "#808080" },
                ])
              }
            >
              <Plus /> افزودن رنگ
            </button>
          </div>
          {colors.map((color, index) => (
            <div className="raw-color-row" key={index}>
              <input
                name="colorHex"
                type="color"
                value={color.hex}
                onChange={(event) =>
                  setColors((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, hex: event.target.value }
                        : item,
                    ),
                  )
                }
                aria-label={`رنگ ${index + 1}`}
              />
              <input
                name="colorName"
                required
                placeholder="نام رنگ؛ مثلاً مشکی"
                value={color.name}
                onChange={(event) =>
                  setColors((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <code>{color.hex.toUpperCase()}</code>
              <button
                type="button"
                disabled={colors.length === 1}
                onClick={() =>
                  setColors((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                aria-label="حذف رنگ"
              >
                <X />
              </button>
            </div>
          ))}
        </div>
        <label>
          سایزها با ویرگول
          <input
            name="sizes"
            required
            placeholder="S, M, L, XL"
            value={sizesText}
            onChange={(event) => setSizesText(event.target.value)}
          />
        </label>
        <div className="wide raw-size-guide-editor">
          <div className="raw-size-guide-heading">
            <div><b>راهنمای سایز</b><small>ستون‌ها، ردیف‌ها و مقدار هر خانه را بسازید.</small></div>
            <div>
              <button type="button" onClick={() => {
                setGuideColumns((current) => [...current, `ستون ${current.length + 1}`]);
                setGuideRows((current) => current.map((row) => [...row, ""]));
              }}><Plus /> افزودن ستون</button>
              <button type="button" disabled={!guideColumns.length} onClick={() => setGuideRows((current) => [...current, Array(guideColumns.length).fill("")])}><Plus /> افزودن ردیف</button>
              <button type="button" disabled={!guideColumns.length && !guideRows.length} onClick={() => { setGuideColumns([]); setGuideRows([]); }}><Trash2 /> حذف راهنما</button>
            </div>
          </div>
          <input type="hidden" name="sizeGuide" value={JSON.stringify(guideColumns.length && guideRows.length ? { columns: guideColumns, rows: guideRows } : null)} />
          {guideColumns.length ? (
            <div className="raw-size-guide-scroll">
              <table>
                <thead><tr>{guideColumns.map((column, columnIndex) => <th key={columnIndex}><input value={column} onChange={(event) => setGuideColumns((current) => current.map((item, index) => index === columnIndex ? event.target.value : item))} /><button type="button" aria-label="حذف ستون" onClick={() => { setGuideColumns((current) => current.filter((_, index) => index !== columnIndex)); setGuideRows((current) => current.map((row) => row.filter((_, index) => index !== columnIndex))); }}><X /></button></th>)}</tr></thead>
                <tbody>{guideRows.map((row, rowIndex) => <tr key={rowIndex}>{guideColumns.map((_, columnIndex) => <td key={columnIndex}><input value={row[columnIndex] || ""} onChange={(event) => setGuideRows((current) => current.map((item, index) => index === rowIndex ? item.map((cell, cellIndex) => cellIndex === columnIndex ? event.target.value : cell) : item))} />{columnIndex === guideColumns.length - 1 && <button type="button" aria-label="حذف ردیف" onClick={() => setGuideRows((current) => current.filter((_, index) => index !== rowIndex))}><Trash2 /></button>}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : <p>برای این محصول راهنمای سایز تعریف نشده است.</p>}
        </div>
        <div className="wide raw-variant-matrix">
          <div>
            <b>تنوع‌های ممکن این محصول</b>
            <small>فقط ترکیب‌های واقعی رنگ و سایز را فعال نگه دارید.</small>
          </div>
          {sizeNames.length && colors.some((color) => color.name.trim()) ? (
            <div className="raw-variant-matrix-grid">
              {colors
                .filter((color) => color.name.trim())
                .flatMap((color) =>
                  sizeNames.map((size) => {
                    const key = `${color.name.trim()}::${size}`;
                    return (
                      <label key={key}>
                        <input
                          type="checkbox"
                          name="variantKey"
                          value={key}
                          defaultChecked
                        />
                        <i style={{ background: color.hex }} />
                        <span>
                          {color.name.trim()} · {size}
                        </span>
                      </label>
                    );
                  }),
                )}
            </div>
          ) : (
            <p>ابتدا نام رنگ‌ها و سایزها را وارد کنید.</p>
          )}
        </div>
        <label className="check-line">
          <input
            name="hasBack"
            type="checkbox"
            checked={hasBack}
            onChange={(event) => setHasBack(event.target.checked)}
          />{" "}
          نمای پشت دارد
        </label>
        <label>
          وضعیت
          <select name="status" defaultValue={raw?.status || "ACTIVE"}>
            <option value="ACTIVE">فعال</option>
            <option value="DRAFT">پیش‌نویس</option>
            <option value="ARCHIVED">بایگانی</option>
          </select>
        </label>
      </div>
      <h3>تصاویر و محدوده قابل طراحی</h3>
      <p className="raw-file-help">
        <b>Overlay محدوده چاپ نیست.</b> Overlay یک فایل شفاف اختیاری مثل سایه،
        چین پارچه یا بافت است که روی طرح قرار می‌گیرد. محدوده چاپ را خودت با
        جابه‌جایی و تغییر اندازه کادر بنفش مشخص می‌کنی.
      </p>
      <RawPrintAreaField
        side="front"
        label="نمای جلو"
        required={!raw}
        initial={{
          x: front?.print_area_x,
          y: front?.print_area_y,
          width: front?.print_area_width,
          height: front?.print_area_height,
        }}
        initialImageUrl={front?.backgroundUrl}
      />
      <div className="form-grid file-grid">
        <label>
          Overlay جلو (اختیاری)
          <input name="frontOverlay" type="file" accept="image/*" />
          <small>PNG شفافِ سایه/بافت روی طرح</small>
        </label>
      </div>
      {hasBack && (
        <>
          <RawPrintAreaField
            side="back"
            label="نمای پشت"
            required={!raw}
            initial={{
              x: back?.print_area_x,
              y: back?.print_area_y,
              width: back?.print_area_width,
              height: back?.print_area_height,
            }}
            initialImageUrl={back?.backgroundUrl}
          />
          <div className="form-grid file-grid">
            <label>
              Overlay پشت (اختیاری)
              <input name="backOverlay" type="file" accept="image/*" />
              <small>PNG شفافِ سایه/بافت روی طرح</small>
            </label>
          </div>
        </>
      )}
      <button className="admin-primary">
        {raw ? "ذخیره تغییرات" : "ساخت محصول خام"}
      </button>
    </ActionForm>
  );
}

function PendingProducts({ data }: { data: AdminData }) {
  const [storeId, setStoreId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [recency, setRecency] = useState<"newest" | "oldest">("newest");
  const [visibleCount, setVisibleCount] = useState(50);
  const approved = useMemo(() => {
    const min = minPrice === "" ? null : Number(minPrice);
    const max = maxPrice === "" ? null : Number(maxPrice);
    return data.approved
      .filter((item) => !storeId || item.store_id === storeId)
      .filter((item) => min === null || Number(item.price) >= min)
      .filter((item) => max === null || Number(item.price) <= max)
      .sort((a, b) => {
        const aTime = new Date(a.published_at || a.created_at).getTime();
        const bTime = new Date(b.published_at || b.created_at).getTime();
        return recency === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [data.approved, storeId, minPrice, maxPrice, recency]);
  const resetCount = () => setVisibleCount(50);
  return (
    <div className="admin-stack">
      <div className="admin-section-head">
        <div>
          <h2>صف بررسی محصول</h2>
          <p>هر تصمیم در تاریخچه دائمی ثبت و اعلان در outbox ایجاد می‌کند.</p>
        </div>
      </div>
      {data.pending.length ? (
        <section className="pending-grid">
          {data.pending.map((item) => (
            <article className="admin-card" key={item.id}>
              <div className="pending-product-image">
                {item.product?.mainImageUrl ? (
                  <Image
                    src={item.product.mainImageUrl}
                    alt={item.product.title}
                    width={640}
                    height={480}
                    unoptimized
                  />
                ) : (
                  <Package />
                )}
              </div>
              <span>{item.store?.name || "فروشگاه"}</span>
              <h3>{item.product?.title || "محصول"}</h3>
              <em className="status-fa">
                {productStatusFa(item.product?.status || item.status)}
              </em>
              <p>
                {item.product ? money(Number(item.product.price)) : "—"} ریال ·{" "}
                {date(item.submitted_at)}
              </p>
              <div className="moderation-actions">
                <ActionForm action={moderateProductAction}>
                  <input
                    type="hidden"
                    name="productId"
                    value={item.seller_product_id}
                  />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <button className="admin-primary">تأیید و انتشار</button>
                </ActionForm>
                <ActionForm action={moderateProductAction}>
                  <input
                    type="hidden"
                    name="productId"
                    value={item.seller_product_id}
                  />
                  <input type="hidden" name="decision" value="REJECTED" />
                  <select name="rejectionReasonId" required>
                    <option value="">دلیل رد</option>
                    {data.rejectionReasons.map((reason) => (
                      <option value={reason.id} key={reason.id}>
                        {reason.title}
                      </option>
                    ))}
                  </select>
                  <input
                    name="customMessage"
                    placeholder="پیام کوتاه اختیاری"
                  />
                  <button className="danger-button">رد محصول</button>
                </ActionForm>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <Empty
          icon={<BadgeCheck />}
          title="صف بررسی خالی است"
          text="محصول ارسال‌شده بعدی اینجا می‌آید."
        />
      )}
      <div className="admin-section-head approved-products-head">
        <div>
          <h2>محصولات تأییدشده</h2>
          <p>{approved.length} محصول مطابق فیلترها؛ در هر مرحله ۵۰ محصول نمایش داده می‌شود.</p>
        </div>
      </div>
      <section className="approved-product-filters" aria-label="فیلتر محصولات تأییدشده">
        <select value={storeId} onChange={(event) => { setStoreId(event.target.value); resetCount(); }}>
          <option value="">همه فروشگاه‌ها</option>
          {Array.from(new Map(data.approved.filter((item) => item.store).map((item) => [item.store_id, item.store!])).values()).map((store) => (
            <option value={store.id} key={store.id}>{store.name}</option>
          ))}
        </select>
        <input type="number" min="0" inputMode="numeric" placeholder="حداقل قیمت" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); resetCount(); }} />
        <input type="number" min="0" inputMode="numeric" placeholder="حداکثر قیمت" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); resetCount(); }} />
        <select value={recency} onChange={(event) => { setRecency(event.target.value as "newest" | "oldest"); resetCount(); }}>
          <option value="newest">جدیدترین تأییدها</option>
          <option value="oldest">قدیمی‌ترین تأییدها</option>
        </select>
      </section>
      {approved.length ? (
        <>
          <section className="pending-grid approved-products-grid">
            {approved.slice(0, visibleCount).map((item) => (
              <article className="admin-card" key={item.id}>
                <div className="pending-product-image">
                  {item.mainImageUrl ? <Image src={item.mainImageUrl} alt={item.title} width={640} height={480} /> : <Package />}
                </div>
                <span>{item.store?.name || "فروشگاه"}</span>
                <h3>{item.title}</h3>
                <p>{money(Number(item.price))} ریال · {date(item.published_at || item.created_at)}</p>
                <div className="moderation-actions approved-product-actions">
                  <ActionForm action={unapproveProductAction} confirmMessage="تأیید این محصول لغو و محصول از انتشار خارج شود؟">
                    <input type="hidden" name="productId" value={item.id} />
                    <button>لغو تأیید</button>
                  </ActionForm>
                  <ActionForm action={deleteApprovedProductAction} confirmMessage="این محصول برای همیشه حذف شود؟ این کار قابل بازگشت نیست.">
                    <input type="hidden" name="productId" value={item.id} />
                    <button className="danger-button"><Trash2 /> حذف</button>
                  </ActionForm>
                </div>
              </article>
            ))}
          </section>
          {visibleCount < approved.length && (
            <button className="admin-load-more" onClick={() => setVisibleCount((count) => count + 50)}>نمایش ۵۰ محصول بیشتر</button>
          )}
        </>
      ) : (
        <Empty icon={<Package />} title="محصول تأییدشده‌ای پیدا نشد" text="فیلترها را تغییر دهید یا محصولات در انتظار را تأیید کنید." />
      )}
    </div>
  );
}

function productStatusFa(status: string) {
  return (
    (
      {
        DRAFT: "پیش‌نویس",
        PENDING: "در انتظار بررسی",
        PUBLISHED: "منتشرشده",
        REJECTED: "ردشده",
        ARCHIVED: "بایگانی‌شده",
        APPROVED: "تأییدشده",
        ACTIVE: "فعال",
        INACTIVE: "غیرفعال",
      } as Record<string, string>
    )[status] || status
  );
}

function Orders({ data }: { data: AdminData }) {
  return (
    <div className="admin-stack">
      <div className="admin-section-head">
        <div>
          <h2>۱۰۰ سفارش ناتمام اول</h2>
          <p>
            مرتب‌شده از قدیمی‌ترین به جدیدترین برای جلوگیری از جا ماندن سفارش.
          </p>
        </div>
      </div>
      <OrderList orders={data.orders} />
      <AdminExceptions data={data} />
    </div>
  );
}

function AdminExceptions({ data }: { data: AdminData }) {
  const one = <T,>(value: T | T[] | null | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const total =
    data.exceptions.cancellations.length +
    data.exceptions.returns.length +
    data.exceptions.disputes.length;
  return (
    <section className="admin-card admin-exceptions">
      <div className="admin-section-head">
        <div>
          <h2>پرونده‌های عملیاتی</h2>
          <p>
            لغو، مرجوعی و اختلاف‌ها؛ هر تصمیم با audit و notification در دیتابیس
            ثبت می‌شود.
          </p>
        </div>
        <b>{total.toLocaleString("fa-IR")}</b>
      </div>
      {total ? (
        <div className="admin-exception-grid">
          {data.exceptions.cancellations.map((item) => {
            const order = one(item.orders);
            const requester = one(item.requester);
            return (
              <article key={item.id}>
                <header>
                  <span>لغو سفارش</span>
                  <em>{item.status}</em>
                </header>
                <h3>{order?.number || item.order_id.slice(0, 8)}</h3>
                <p>{item.reason}</p>
                <small>
                  {[requester?.first_name, requester?.last_name]
                    .filter(Boolean)
                    .join(" ") || "خریدار"}{" "}
                  · {date(item.requested_at)}
                </small>
                {item.status === "REQUESTED" && (
                  <ActionForm
                    action={reviewCancellationAction}
                    confirmMessage="تصمیم لغو سفارش ثبت شود؟"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <textarea
                      name="message"
                      placeholder="یادداشت بررسی (اختیاری)"
                    />
                    <div>
                      <button name="decision" value="approve">
                        تأیید لغو
                      </button>
                      <button
                        className="danger-button"
                        name="decision"
                        value="reject"
                      >
                        رد درخواست
                      </button>
                    </div>
                  </ActionForm>
                )}
              </article>
            );
          })}
          {data.exceptions.returns.map((item) => {
            const orderItem = one(item.order_items);
            const order = one(orderItem?.orders);
            const buyer = one(item.buyer);
            return (
              <article key={item.id}>
                <header>
                  <span>مرجوعی</span>
                  <em>{item.status}</em>
                </header>
                <h3>{order?.number || item.order_item_id.slice(0, 8)}</h3>
                <p>{item.reason}</p>
                {item.description && <p>{item.description}</p>}
                <small>
                  {[buyer?.first_name, buyer?.last_name]
                    .filter(Boolean)
                    .join(" ") || "خریدار"}{" "}
                  · {date(item.requested_at)}
                </small>
                {item.status === "REQUESTED" && (
                  <ActionForm
                    action={reviewReturnAction}
                    confirmMessage="تصمیم مرجوعی ثبت شود؟"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <textarea
                      name="message"
                      placeholder="دستور یا توضیح بررسی"
                    />
                    <div>
                      <button name="decision" value="approve">
                        تأیید مرجوعی
                      </button>
                      <button
                        className="danger-button"
                        name="decision"
                        value="reject"
                      >
                        رد درخواست
                      </button>
                    </div>
                  </ActionForm>
                )}
              </article>
            );
          })}
          {data.exceptions.disputes.map((item) => {
            const order = one(item.orders);
            const opener = one(item.opener);
            return (
              <article key={item.id}>
                <header>
                  <span>اختلاف</span>
                  <em>{item.status}</em>
                </header>
                <h3>{order?.number || item.order_id.slice(0, 8)}</h3>
                <p>
                  <b>{item.reason}</b>
                  <br />
                  {item.description}
                </p>
                <small>
                  {[opener?.first_name, opener?.last_name]
                    .filter(Boolean)
                    .join(" ") || "خریدار"}{" "}
                  · {date(item.opened_at)}
                </small>
                <ActionForm
                  action={resolveDisputeAction}
                  confirmMessage="نتیجه نهایی پرونده ثبت شود؟"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <textarea
                    name="resolution"
                    required
                    minLength={5}
                    placeholder="نتیجه دقیق بررسی"
                  />
                  <div>
                    <button name="decision" value="resolve">
                      حل شد
                    </button>
                    <button
                      className="danger-button"
                      name="decision"
                      value="reject"
                    >
                      رد ادعا
                    </button>
                  </div>
                </ActionForm>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={<BadgeCheck />}
          title="پرونده بازی نیست"
          text="لغو، مرجوعی و اختلاف جدید اینجا ظاهر می‌شوند."
        />
      )}
    </section>
  );
}

function OrderList({ orders }: { orders: AdminData["orders"] }) {
  return (
    <section className="admin-card">
      {orders.length ? (
        <div className="admin-table orders-table">
          <div>
            <span>سفارش</span>
            <span>خریدار</span>
            <span>اقلام</span>
            <span>مبلغ</span>
            <span>وضعیت</span>
            <span>تاریخ</span>
          </div>
          {orders.map((order) => {
            const customer = order.customer_snapshot as Record<string, unknown>;
            return (
              <div key={order.id}>
                <b className="admin-order-identity">
                  {order.firstImageUrl ? <Image src={order.firstImageUrl} alt="" width={48} height={48} /> : <Package />}
                  {order.number}
                </b>
                <span>
                  {String(customer.firstName || customer.email || "—")}
                </span>
                <span>{order.items.length}</span>
                <strong>{money(order.total)} ریال</strong>
                <span>
                  <ActionForm action={adminUpdateOrderAction} className="admin-order-edit-form">
                    <input type="hidden" name="orderId" value={order.id} />
                    <select name="status" defaultValue={order.status}>
                      {["PENDING","CONFIRMED","IN_PRODUCTION","READY_TO_SHIP","SENT","DONE","CANCELLED"].map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <button>ذخیره</button>
                  </ActionForm>
                  <ActionForm action={adminDeleteOrderAction} confirmMessage="سفارش‌های دارای سابقه مالی حذف نمی‌شوند. ادامه می‌دهید؟">
                    <input type="hidden" name="orderId" value={order.id} />
                    <button className="danger-button"><Trash2 /></button>
                  </ActionForm>
                </span>
                <span>{date(order.created_at)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={<ShoppingBag />}
          title="سفارش ناتمامی نیست"
          text="این همان empty state سالم و واقعی است."
        />
      )}
    </section>
  );
}

function Settings({ data }: { data: AdminData }) {
  return (
    <div className="admin-stack">
      <section className="admin-settings-hero">
        <Settings2 />
        <div>
          <h2>دلایل رد و قالب پیامک</h2>
          <p>
            این داده‌ها از دیتابیس خوانده می‌شوند و در تصمیم بررسی استفاده
            می‌شوند.
          </p>
        </div>
      </section>
      <section className="admin-card graphic-admin-settings">
        <header>
          <Palette />
          <div>
            <h2>سبک‌های گرافیکی</h2>
            <p>
              سبک‌هایی که فروشنده برای محصول و مدیر برای طرح رایگان انتخاب
              می‌کند.
            </p>
          </div>
        </header>
        <ActionForm
          action={saveGraphicStyleAction}
          className="graphic-style-form is-new"
        >
          <label>
            نام
            <input name="name" required placeholder="مثلاً تایپوگرافی فارسی" />
          </label>
          <label>
            شناسه انگلیسی
            <input
              name="slug"
              required
              pattern="[a-z0-9-]+"
              placeholder="persian-typography"
            />
          </label>
          <label>
            توضیح
            <input name="caption" placeholder="توضیح کوتاه سبک" />
          </label>
          <button>
            <Plus /> افزودن سبک
          </button>
        </ActionForm>
        <div className="graphic-style-admin-list">
          {data.graphicStyles.map((style) => (
            <article key={style.id}>
              <ActionForm
                action={saveGraphicStyleAction}
                className="graphic-style-form"
              >
                <input type="hidden" name="id" value={style.id} />
                <label>
                  نام
                  <input name="name" required defaultValue={style.name} />
                </label>
                <label>
                  شناسه
                  <input name="slug" required defaultValue={style.slug} />
                </label>
                <label>
                  توضیح
                  <input name="caption" defaultValue={style.caption || ""} />
                </label>
                <button>ذخیره</button>
              </ActionForm>
              <ActionForm
                action={archiveGraphicStyleAction}
                confirmMessage="این سبک غیرفعال شود؟"
                className="inline-archive-form"
              >
                <input type="hidden" name="id" value={style.id} />
                <button>
                  <Archive /> غیرفعال
                </button>
              </ActionForm>
              <ActionForm
                action={deleteGraphicStyleAction}
                confirmMessage="این سبک و تمام طرح‌های رایگان وابسته برای همیشه حذف شوند؟"
                className="inline-archive-form"
              >
                <input type="hidden" name="id" value={style.id} />
                <button className="danger-button">
                  <Trash2 /> حذف
                </button>
              </ActionForm>
            </article>
          ))}
        </div>
      </section>
      <section className="admin-card free-design-settings">
        <header>
          <ImagePlus />
          <div>
            <h2>کتابخانه طرح‌های رایگان</h2>
            <p>
              تصویر آماده را همراه با سبک آن بارگذاری کنید؛ فروشنده با یک کلیک
              آن را به بوم اضافه می‌کند.
            </p>
          </div>
        </header>
        <FreeDesignBatchForm styles={data.graphicStyles} />
        <div className="free-design-admin-grid">
          {data.freeDesigns
            .filter((item) => item.status === "ACTIVE")
            .map((item) => (
              <article key={item.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.title} />
                <div>
                  <b>{item.title}</b>
                  <span>
                    {
                      data.graphicStyles.find(
                        (style) => style.id === item.graphic_style_id,
                      )?.name
                    }
                  </span>
                </div>
                <ActionForm
                  action={saveFreeDesignAction}
                  className="free-design-form free-design-edit-form"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <label>
                    عنوان
                    <input name="title" required defaultValue={item.title} />
                  </label>
                  <label>
                    دسته گرافیکی
                    <select
                      name="graphicStyleId"
                      required
                      defaultValue={item.graphic_style_id}
                    >
                      {data.graphicStyles
                        .filter((style) => style.status === "ACTIVE")
                        .map((style) => (
                          <option value={style.id} key={style.id}>
                            {style.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    تعویض تصویر (اختیاری)
                    <input
                      name="designFile"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                    />
                  </label>
                  <button>
                    <Pencil /> ذخیره تغییرات
                  </button>
                </ActionForm>
                <ActionForm
                  action={deleteFreeDesignAction}
                  confirmMessage="این طرح از کتابخانه فروشندگان حذف شود؟"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <button>
                    <Trash2 /> حذف
                  </button>
                </ActionForm>
              </article>
            ))}
        </div>
      </section>
      <section id="ai-assistant" className="admin-card support-knowledge-settings">
        <header>
          <div>
            <BookOpen />
            <div>
              <h2>پایگاه دانش پشتیبانی هوشمند</h2>
              <p>
                سیاست‌ها، پاسخ‌های صحیح و روش انجام کارها را ثبت کنید تا پاسخ
                پیشنهادی AI فقط بر همین اطلاعات تکیه کند.
              </p>
            </div>
          </div>
        </header>
        <ActionForm
          action={saveSupportAiSettingsAction}
          className="knowledge-form support-ai-settings-form"
        >
          <label>
            مدل OpenAI
            <input name="model" required dir="ltr" defaultValue={data.supportAiSettings?.model || "gpt-5.6-luna"} />
          </label>
          <label className="wide">
            دستور اصلی دستیار
            <textarea name="systemPrompt" required defaultValue={data.supportAiSettings?.system_prompt || ""} placeholder="نقش، لحن، محدودیت‌ها و قواعد پاسخ‌گویی دستیار را بنویسید…" />
          </label>
          <button><Bot /> ذخیره تنظیمات دستیار</button>
        </ActionForm>
        <ActionForm action={uploadSupportKnowledgeFileAction} className="knowledge-form knowledge-file-upload">
          <label>
            عنوان فایل (اختیاری)
            <input name="title" placeholder="در صورت خالی بودن، نام فایل استفاده می‌شود" />
          </label>
          <label>
            دسته
            <select name="category" defaultValue="FILE">
              <option value="FILE">مستندات</option><option value="ORDER">سفارش</option><option value="FINANCIAL">مالی</option><option value="PRODUCT">محصول</option><option value="ACCOUNT">حساب کاربری</option>
            </select>
          </label>
          <label className="wide knowledge-file-picker">
            <FileUp /> افزودن فایل به مغز دستیار
            <input name="knowledgeFile" type="file" required accept=".txt,.md,.csv,.json,.html,text/plain,text/markdown,text/csv,application/json,text/html" />
            <small>TXT، Markdown، CSV، JSON یا HTML تا ۲ مگابایت</small>
          </label>
          <button><FileUp /> بارگذاری و افزودن به دانش</button>
        </ActionForm>
        <ActionForm
          action={saveSupportKnowledgeAction}
          className="knowledge-form knowledge-new"
        >
          <label>
            عنوان
            <input
              name="title"
              required
              placeholder="مثلاً زمان آماده‌سازی سفارش"
            />
          </label>
          <label>
            دسته
            <select name="category" defaultValue="GENERAL">
              <option value="GENERAL">عمومی</option>
              <option value="ORDER">سفارش</option>
              <option value="FINANCIAL">مالی</option>
              <option value="PRODUCT">محصول</option>
              <option value="ACCOUNT">حساب کاربری</option>
              <option value="BUG">مشکلات فنی</option>
            </select>
          </label>
          <label className="wide">
            اطلاعات دقیق
            <textarea
              name="content"
              required
              placeholder="پاسخ قطعی، شرایط و مراحل انجام کار را کامل بنویسید…"
            />
          </label>
          <button>
            <Plus /> افزودن به پایگاه دانش
          </button>
        </ActionForm>
        <div className="knowledge-list">
          {data.knowledgeBase.map((item) => (
            <article key={item.id}>
              {item.file_name && <small className="knowledge-source">فایل: {item.file_name}</small>}
              <ActionForm
                action={saveSupportKnowledgeAction}
                className="knowledge-form"
              >
                <input type="hidden" name="id" value={item.id} />
                <label>
                  عنوان
                  <input name="title" required defaultValue={item.title} />
                </label>
                <label>
                  دسته
                  <input
                    name="category"
                    required
                    defaultValue={item.category}
                  />
                </label>
                <label className="wide">
                  اطلاعات
                  <textarea
                    name="content"
                    required
                    defaultValue={item.content}
                  />
                </label>
                <button>ذخیره تغییرات</button>
              </ActionForm>
              <ActionForm
                action={deleteSupportKnowledgeAction}
                confirmMessage="این مطلب از پایگاه دانش حذف شود؟"
                className="knowledge-delete"
              >
                <input type="hidden" name="id" value={item.id} />
                <button>
                  <Trash2 /> حذف
                </button>
              </ActionForm>
            </article>
          ))}
          {!data.knowledgeBase.length && (
            <div className="empty-state">
              هنوز مطلبی در پایگاه دانش ثبت نشده است.
            </div>
          )}
        </div>
      </section>
      <section className="admin-card reason-settings">
        {data.rejectionReasons.map((reason) => (
          <ActionForm action={saveRejectionReasonAction} key={reason.id}>
            <input type="hidden" name="id" value={reason.id} />
            <span>•</span>
            <label>
              عنوان رد
              <input name="title" required defaultValue={reason.title} />
            </label>
            <label>
              متن پیام فروشنده
              <textarea
                name="message"
                required
                defaultValue={reason.sms_templates?.body || ""}
              />
            </label>
            <button>ذخیره تغییرات</button>
          </ActionForm>
        ))}
      </section>
    </div>
  );
}

function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="admin-empty">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
