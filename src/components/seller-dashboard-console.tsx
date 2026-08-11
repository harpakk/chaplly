"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  BookOpen,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  Eye,
  Landmark,
  Package,
  Pencil,
  PlayCircle,
  Plus,
  Save,
  ShoppingBag,
  Star,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { ExclusiveStoreControl } from "@/components/exclusive-store-control";
import {
  archiveSellerProductAction,
  assignSupplierToProductAction,
  deleteBankAccountAction,
  requestPayoutAction,
  saveBankAccountAction,
  updateStoreAction,
  updateTutorialProgressAction,
} from "@/app/actions/dashboard";
import { formatRial } from "@/lib/catalog";
import type { getSellerDashboardData } from "@/lib/dashboard-data";
import { WooCommercePanel } from "@/components/woocommerce-panel";

type SellerData = Awaited<ReturnType<typeof getSellerDashboardData>>;
const sections = [
  "finance",
  "accounts",
  "store",
  "products",
  "woocommerce",
  "tutorials",
] as const;
const labels = {
  finance: "مالی",
  accounts: "حساب‌های بانکی",
  store: "فروشگاه من",
  products: "محصولات",
  woocommerce: "ووکامرس",
  tutorials: "آموزش",
} as const;
const statusFa = (value: string) =>
  (
    ({
      DRAFT: "پیش‌نویس",
      PENDING: "در انتظار بررسی",
      PUBLISHED: "منتشرشده",
      REJECTED: "ردشده",
      APPROVED: "تأییدشده",
      ARCHIVED: "بایگانی‌شده",
      ACTIVE: "فعال",
      INACTIVE: "غیرفعال",
    }) as Record<string, string>
  )[value] || value;
const financeStatusFa = (value: string) =>
  ({
    PENDING: "در انتظار تکمیل سفارش",
    AVAILABLE: "قابل برداشت",
    RESERVED: "رزروشده برای تسویه",
    PAID: "پرداخت‌شده",
    REVERSED: "لغوشده؛ بدون درآمد",
    REQUESTED: "درخواست‌شده",
    PROCESSING: "در حال پرداخت",
  } as Record<string, string>)[value] || statusFa(value);
const relationOne = <T,>(value: T | T[] | null | undefined) =>
  Array.isArray(value) ? value[0] : value;
const variantInventory = (
  variant: SellerData["products"][number]["seller_product_variants"][number],
) => {
  const relation = variant.supplier_offer_variants;
  const supplierVariant = Array.isArray(relation) ? relation[0] : relation;
  return Number(supplierVariant?.stock_quantity || 0);
};

export function SellerDashboardConsole({
  section,
  data,
}: {
  section: string;
  data: SellerData;
}) {
  const initial = (
    sections.includes(section as (typeof sections)[number])
      ? section
      : "finance"
  ) as (typeof sections)[number];
  const [active, setActive] = useState(initial);
  useEffect(() => setActive(initial), [initial]);
  useEffect(() => {
    const change = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (sections.includes(next as (typeof sections)[number]))
        setActive(next as (typeof sections)[number]);
    };
    window.addEventListener("chapli:seller-section", change);
    return () => window.removeEventListener("chapli:seller-section", change);
  }, []);
  return (
    <>
      <header className="sd-pagehead">
        <div>
          <span className="sd-kicker">{data.store.name} / پنل فروشنده</span>
          <h1>{labels[active]}</h1>
        </div>
      </header>
      <nav className="sd-mobile-tabs">
        {sections.map((key) => (
          <Link
            aria-current={active === key ? "page" : undefined}
            className={active === key ? "active" : ""}
            href={`/seller/dashboard?section=${key}`}
            key={key}
          >
            {labels[key]}
          </Link>
        ))}
      </nav>
      <div className="sd-content">
        {active === "finance" && <Finance data={data} />}
        {active === "accounts" && <Accounts data={data} />}
        {active === "store" && <StorePanel data={data} />}
        {active === "products" && (
          <>
            <Products data={data} />
            <SupplierAssignments data={data} />
          </>
        )}
        {active === "woocommerce" && <WooCommercePanel data={data.woocommerce} />}
        {active === "tutorials" && <Tutorials data={data} />}
      </div>
    </>
  );
}

function Kpi({
  icon,
  title,
  value,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  note: string;
}) {
  return (
    <article className="sd-kpi">
      <div className="sd-kpi-top">
        <i>{icon}</i>
        <span>{note}</span>
      </div>
      <p>{title}</p>
      <strong>{value}</strong>
    </article>
  );
}

function Finance({ data }: { data: SellerData }) {
  const bank = data.banks[0];
  return (
    <div className="sd-stack">
      <section className="sd-hero-finance">
        <div>
          <span>موجودی قابل برداشت</span>
          <strong>{formatRial(data.balance.available)}</strong>
          <p>
            <Check /> فقط درآمد سفارش‌های تکمیل‌شده و خارج از دوره بازگشت.
          </p>
        </div>
        {bank ? (
          <ActionForm action={requestPayoutAction}>
            <input type="hidden" name="role" value="seller" />
            <input type="hidden" name="bankAccountId" value={bank.id} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`seller-payout-${new Date().toISOString().slice(0, 10)}-${data.balance.available}`}
            />
            <label>
              مبلغ تسویه
              <input name="amount" type="number" min="1" max={data.balance.available} defaultValue={data.balance.available} required />
            </label>
            <button disabled={data.balance.available <= 0}>
              <Banknote /> درخواست تسویه کامل
            </button>
          </ActionForm>
        ) : (
          <Link
            className="button button-primary"
            href="/seller/dashboard?section=accounts"
          >
            افزودن حساب بانکی
          </Link>
        )}
      </section>
      <div className="sd-toolbar">
        <span>گزارش واقعی همه زمان‌ها</span>
        <a className="sd-outline" href="/seller/dashboard/products/export">
          <Download /> خروجی کامل CSV
        </a>
      </div>
      <section className="sd-kpis">
        <Kpi
          icon={<BadgeCheck />}
          title="پرداخت‌شده"
          value={formatRial(data.balance.paid)}
          note="مجموع تسویه‌ها"
        />
        <Kpi
          icon={<CircleDollarSign />}
          title="درآمد ناخالص"
          value={formatRial(data.totals.gross)}
          note="همه زمان‌ها"
        />
        <Kpi
          icon={<TrendingUp />}
          title="سود خالص"
          value={formatRial(data.totals.net)}
          note="بعد از کارمزد"
        />
        <Kpi
          icon={<Banknote />}
          title="درآمد ۳۰ روز"
          value={formatRial(data.totals.last30)}
          note="دوره جاری"
        />
        <Kpi
          icon={<Package />}
          title="در انتظار آزادسازی"
          value={formatRial(data.balance.pending)}
          note="تا Done"
        />
      </section>
      <section className="sd-card">
        <div className="sd-card-title">
          <div>
            <h2>دفتر درآمد</h2>
            <p>هر ردیف به سفارش واقعی و وضعیت مالی متصل است.</p>
          </div>
        </div>
        {data.earnings.length ? (
          <div className="sd-table income-ledger">
            <div className="thead">
              <span>سفارش و کالا</span>
              <span>تاریخ</span>
              <span>وضعیت</span>
              <span>ناخالص</span>
              <span>سهم چاپلی (۵٪)</span>
              <span>خالص</span>
            </div>
            {data.earnings.map((item) => {
              const order = relationOne(item.orders);
              const orderItem = relationOne(item.order_items);
              const snapshot = orderItem?.product_snapshot as Record<string, unknown> | undefined;
              return <div className="trow" key={item.id}>
                <span><b>{order?.number || item.order_id?.slice(0, 8) || "—"}</b><small>{String(snapshot?.title || "محصول")} · {Number(orderItem?.quantity || 1).toLocaleString("fa-IR")} عدد</small></span>
                <span>{new Intl.DateTimeFormat("fa-IR").format(new Date(item.created_at))}</span>
                <span>{financeStatusFa(item.status)}</span>
                <span>{formatRial(item.gross_amount)}</span>
                <span>{formatRial(item.fee_amount)}</span>
                <strong>{formatRial(item.net_amount)}</strong>
              </div>;
            })}
          </div>
        ) : (
          <Empty
            title="هنوز درآمدی ثبت نشده"
            text="بعد از Done شدن اولین سفارش، ردیف درآمد اینجا ساخته می‌شود."
          />
        )}
      </section>
      <section className="sd-card">
        <div className="sd-card-title"><div><h2>سوابق تسویه</h2><p>درخواست‌ها، پرداخت‌ها و شماره پیگیری</p></div></div>
        {data.payouts.length ? <div className="sd-table">
          <div className="thead"><span>درخواست</span><span>وضعیت</span><span>مبلغ</span><span>پیگیری</span><span>تاریخ</span></div>
          {data.payouts.map((item) => {
            const history = Array.isArray(item.payout_payment_history) ? item.payout_payment_history[0] : item.payout_payment_history;
            return <div className="trow" key={item.id}><span>{item.id.slice(0, 8)}</span><span>{financeStatusFa(item.status)}</span><strong>{formatRial(item.amount)}</strong><span>{history?.reference || "—"}</span><span>{new Intl.DateTimeFormat("fa-IR").format(new Date(item.requested_at))}</span></div>;
          })}
        </div> : <Empty title="سابقه تسویه‌ای وجود ندارد" text="پس از اولین درخواست، وضعیت آن اینجا نمایش داده می‌شود." />}
      </section>
      {data.cancelledOrders.length > 0 && (
        <details className="seller-cancelled-orders compact">
          <summary>سفارش‌های لغوشده ({data.cancelledOrders.length.toLocaleString("fa-IR")})</summary>
          <p>این سفارش‌ها فقط برای سابقه نمایش داده می‌شوند و وارد درآمد یا موجودی قابل برداشت نمی‌شوند.</p>
          {data.cancelledOrders.map((item) => {
            const order = relationOne(item.orders);
            const snapshot = item.product_snapshot as Record<string, unknown>;
            return <div key={item.id}><b>{order?.number || item.order_id}</b><span>{String(snapshot?.title || "محصول")}</span><em>لغوشده — بدون درآمد</em></div>;
          })}
        </details>
      )}
    </div>
  );
}

function Accounts({ data }: { data: SellerData }) {
  return (
    <div className="sd-stack">
      <section className="sd-intro-row">
        <div>
          <h2>مسیر امن پولت</h2>
          <p>حساب با اولویت ۱ مقصد اصلی تسویه است.</p>
        </div>
      </section>
      <div className="sd-bank-layout">
        <section className="sd-card">
          <div className="sd-card-title">
            <div>
              <h2>حساب‌های ثبت‌شده</h2>
              <p>حساب اصلی همیشه در ابتدای فهرست قرار دارد.</p>
            </div>
          </div>
          <div className="sd-bank-list">
            {data.banks.map((bank, index) => (
              <article className="sd-bank" key={bank.id}>
                <div className="sd-bank-logo">
                  <Landmark />
                </div>
                <div>
                  <div className="sd-bank-name">
                    <strong>{bank.bank_name || "بانک"}</strong>
                    {index === 0 && (
                      <span>
                        <Star /> حساب اصلی
                      </span>
                    )}
                  </div>
                  <p dir="ltr">{bank.card_number}</p>
                  <small dir="ltr">{bank.iban}</small>
                </div>
                <div className="sd-bank-actions">
                  <details className="sd-bank-edit">
                    <summary aria-label="ویرایش حساب بانکی" title="ویرایش حساب بانکی"><Pencil /></summary>
                    <ActionForm action={saveBankAccountAction} refreshAfterSuccess>
                      <input type="hidden" name="role" value="seller" />
                      <input type="hidden" name="id" value={bank.id} />
                      <label>نام بانک<input name="bankName" defaultValue={bank.bank_name || ""} required /></label>
                      <label>نام صاحب حساب<input name="accountHolder" defaultValue={bank.account_holder_name || ""} required /></label>
                      <label>شماره کارت<input name="cardNumber" defaultValue={bank.card_number || ""} required inputMode="numeric" /></label>
                      <label>شماره شبا<input name="iban" defaultValue={bank.iban || ""} required dir="ltr" /></label>
                      <label>اولویت<input name="priority" type="number" min="1" defaultValue={bank.priority} /></label>
                      <button type="submit"><Save /> ذخیره تغییرات</button>
                    </ActionForm>
                  </details>
                  <ActionForm action={deleteBankAccountAction} refreshAfterSuccess>
                    <input type="hidden" name="role" value="seller" />
                    <input type="hidden" name="id" value={bank.id} />
                    <button type="submit" aria-label="حذف حساب بانکی" title="حذف حساب بانکی"><Trash2 /></button>
                  </ActionForm>
                </div>
              </article>
            ))}
          </div>
        </section>
        <ActionForm
          action={saveBankAccountAction}
          refreshAfterSuccess
          className="sd-card sd-form sd-bank-add"
        >
          <input type="hidden" name="role" value="seller" />
          <h2>افزودن حساب</h2>
          <div className="sd-form-grid">
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
              <input name="cardNumber" required inputMode="numeric" />
            </label>
            <label>
              شماره شبا
              <input name="iban" required dir="ltr" placeholder="IR..." />
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
          </div>
          <button className="sd-primary">
            <Plus /> ذخیره حساب
          </button>
        </ActionForm>
      </div>
    </div>
  );
}

function StorePanel({ data }: { data: SellerData }) {
  return (
    <div className="sd-stack">
      <section
        className={`sd-store-cover ${data.store.bannerUrl ? "has-store-banner" : ""}`}
        style={{ background: data.store.bannerUrl ? `linear-gradient(90deg,#171522d9,#17152270),url("${data.store.bannerUrl}") center/cover` : data.store.brand_color || undefined }}
      >
        <div className="sd-store-orb">{data.store.logoUrl ? <Image src={data.store.logoUrl} alt={`لوگوی ${data.store.name}`} width={72} height={72} unoptimized /> : data.store.name.slice(0, 1)}</div>
        <div>
          <span>
            {data.store.brand_tone === "EXCLUSIVE"
              ? data.store.hostname || `${data.store.slug}.chaplly.ir`
              : `chaplly.ir/stores/${data.store.slug}`}
          </span>
          <h2>{data.store.name}</h2>
          <p>{data.store.description || "داستان فروشگاهت را اضافه کن."}</p>
        </div>
        <Link className="sd-outline" href={`/stores/${data.store.slug}`}>
          مشاهده فروشگاه
        </Link>
      </section>
      <ExclusiveStoreControl store={data.store} />
      <section className="sd-ranks">
        <Kpi
          icon={<Eye />}
          title="بازدید محصولات"
          value={new Intl.NumberFormat("fa-IR").format(
            data.products.reduce((sum, item) => sum + item.view_count, 0),
          )}
          note="همه زمان‌ها"
        />
        <Kpi
          icon={<ShoppingBag />}
          title="فروش محصولات"
          value={new Intl.NumberFormat("fa-IR").format(
            data.products.reduce((sum, item) => sum + item.sales_count, 0),
          )}
          note="همه زمان‌ها"
        />
        <Kpi
          icon={<Package />}
          title="تعداد محصول"
          value={String(data.products.length)}
          note="همه وضعیت‌ها"
        />
        <Kpi
          icon={<Star />}
          title="میانگین امتیاز"
          value={(
            data.products.reduce((sum, item) => sum + item.rating_average, 0) /
            Math.max(1, data.products.length)
          ).toFixed(1)}
          note="خریداران"
        />
      </section>
      <ActionForm action={updateStoreAction} className="sd-card sd-form">
        <div className="sd-card-title">
          <div>
            <h2>هویت فروشگاه</h2>
            <p>اطلاعات عمومی و هویت بصری فروشگاه را مدیریت کنید.</p>
          </div>
        </div>
        <div className="sd-form-grid">
          <label>
            نام فروشگاه
            <input name="name" defaultValue={data.store.name} required />
          </label>
          <label>
            شماره پشتیبانی
            <input
              name="supportPhone"
              defaultValue={data.store.support_phone || ""}
            />
          </label>
          <label>
            اینستاگرام / شبکه اجتماعی
            <input
              name="socialUrl"
              defaultValue={data.store.social_url || ""}
            />
          </label>
          <label>
            رنگ برند
            <input
              name="brandColor"
              type="color"
              defaultValue={data.store.brand_color || "#ef5b4c"}
            />
          </label>
          <label className="wide">
            معرفی فروشگاه
            <textarea
              name="description"
              defaultValue={data.store.description || ""}
            />
          </label>
        </div>
        <button className="sd-primary">
          <Save /> ذخیره تغییرات
        </button>
      </ActionForm>
    </div>
  );
}

function Products({ data }: { data: SellerData }) {
  return (
    <div className="sd-stack">
      <section className="sd-intro-row">
        <div>
          <h2>محصول‌هایت، بدون اکسل مخفی</h2>
          <p>
            پیش‌نویس، منتظر بررسی، منتشرشده و ردشده همگی از دیتابیس می‌آیند.
          </p>
        </div>
        <Link className="sd-primary" href="/seller/dashboard/products/new">
          <Plus /> ساخت محصول جدید
        </Link>
      </section>
      {data.products.length ? (
        <section className="sd-card seller-products-card">
          <header className="seller-products-summary">
            <div>
              <b>{data.products.length.toLocaleString("fa-IR")} محصول</b>
              <span>مدیریت تصویر، قیمت، وضعیت انتشار و عملیات محصول</span>
            </div>
            <Link href={`/stores/${data.store.slug}`}>
              <ShoppingBag /> مشاهده فروشگاه
            </Link>
          </header>
          <div className="seller-product-list">
            {data.products.map((product) => {
              const canViewAsBuyer =
                product.status === "PUBLISHED" &&
                product.moderation_status === "APPROVED";
              const inventory = product.seller_product_variants.reduce(
                (sum, variant) => sum + variantInventory(variant),
                0,
              );
              const unavailableVariants =
                product.seller_product_variants.filter(
                  (variant) => variant.status === "OUT_OF_STOCK",
                ).length;
              return (
                <article className="seller-product-row" key={product.id}>
                  <div className="seller-product-image">
                    {product.mainImageUrl ? (
                      <Image
                        src={product.mainImageUrl}
                        alt={product.title}
                        fill
                        sizes="(max-width: 760px) 112px, 150px"
                        unoptimized
                      />
                    ) : (
                      <div>
                        <Package />
                        <small>بدون تصویر</small>
                      </div>
                    )}
                    <span className={`product-status product-status-${product.status.toLowerCase()}`}>
                      {statusFa(product.status)}
                    </span>
                  </div>
                  <div className="seller-product-main">
                    <div className="seller-product-title-row">
                      <div>
                        <h3>{product.title}</h3>
                        <code>{product.slug}</code>
                      </div>
                      <strong>
                        {formatRial(product.discounted_price || product.price)}
                      </strong>
                    </div>
                    <div className="seller-product-badges">
                      <span>
                        بررسی: <b>{statusFa(product.moderation_status)}</b>
                      </span>
                      <span>
                        {product.seller_product_variants.length.toLocaleString(
                          "fa-IR",
                        )} تنوع
                      </span>
                      <span className={unavailableVariants ? "warning" : ""}>
                        {unavailableVariants
                          ? `${unavailableVariants.toLocaleString("fa-IR")} تنوع ناموجود`
                          : `موجودی ${inventory.toLocaleString("fa-IR")}`}
                      </span>
                    </div>
                    <div className="seller-product-stats">
                      <span>
                        <ShoppingBag />
                        <b>{product.sales_count.toLocaleString("fa-IR")}</b>
                        فروش
                      </span>
                      <span>
                        <Eye />
                        <b>{product.view_count.toLocaleString("fa-IR")}</b>
                        بازدید
                      </span>
                      <span>
                        <Star />
                        <b>{product.rating_average.toLocaleString("fa-IR")}</b>
                        امتیاز
                      </span>
                      <small>
                        بروزرسانی {new Intl.DateTimeFormat("fa-IR", {
                          dateStyle: "medium",
                        }).format(new Date(product.updated_at))}
                      </small>
                    </div>
                  </div>
                  <div className="seller-product-actions">
                    {product.design_id && (
                      <Link
                        className="seller-product-action edit"
                        href={`/seller/dashboard/products/new/design?raw=${product.raw_product_id}&design=${product.design_id}`}
                      >
                        <Pencil /> ویرایش طراحی و موکاپ
                      </Link>
                    )}
                    <Link
                      className="seller-product-action edit"
                      href={`/seller/dashboard/products/${product.id}/edit`}
                    >
                      <Pencil /> ویرایش
                    </Link>
                    {canViewAsBuyer ? (
                      <Link
                        className="seller-product-action preview"
                        href={`/products/${product.slug}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Eye /> مشاهده مثل خریدار
                      </Link>
                    ) : (
                      <button
                        className="seller-product-action preview"
                        type="button"
                        disabled
                        title="پس از تأیید و انتشار، مشاهده خریدار فعال می‌شود."
                      >
                        <Eye /> هنوز قابل مشاهده نیست
                      </button>
                    )}
                    <ActionForm
                      action={archiveSellerProductAction}
                      className="seller-product-delete-form"
                      confirmMessage={`محصول «${product.title}» از فروشگاه حذف شود؟ سوابق سفارش‌ها محفوظ می‌ماند.`}
                      onSuccessText="محصول حذف شد."
                      savingText="در حال حذف محصول از فروشگاه…"
                    >
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="slug" value={product.slug} />
                      <button type="submit">
                        <Trash2 /> حذف
                      </button>
                    </ActionForm>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <Empty
          title="هنوز محصولی نداری"
          text="فرآیند ساخت را شروع کن؛ پیش‌نویس به‌صورت خودکار ذخیره می‌شود."
        />
      )}
    </div>
  );
}

function SupplierAssignments({ data }: { data: SellerData }) {
  const lowProducts = data.products.filter(
    (product) =>
      product.primary_supplier_offer_id &&
      product.seller_product_variants.some(
        (variant) => variantInventory(variant) < 10,
      ),
  );
  return (
    <section className="sd-card supplier-assignment-panel">
      <div className="sd-card-title">
        <div>
          <h2>تأمین و موجودی محصول‌ها</h2>
          <p>
            محصول بدون تأمین‌کننده حذف نمی‌شود؛ تنوع‌هایش ناموجود می‌مانند و هر
            زمان می‌توانی تأمین‌کننده را وصل یا عوض کنی.
          </p>
        </div>
      </div>
      {lowProducts.length > 0 && (
        <div className="inventory-warning-banner" role="alert">
          <Package />
          <div>
            <b>
              موجودی {lowProducts.length.toLocaleString("fa-IR")} محصول کمتر از
              ۱۰ است
            </b>
            <span>
              برای جلوگیری از توقف فروش، تأمین‌کننده را تغییر دهید. جزئیات هر
              محصول پایین همین بخش قرار دارد.
            </span>
          </div>
        </div>
      )}
      <div className="supplier-assignment-list">
        {data.products.map((product) => {
          const offers = data.supplierOffers.filter(
            (offer) => offer.raw_product_id === product.raw_product_id,
          );
          const quantities =
            product.seller_product_variants.map(variantInventory);
          const inventoryTotal = quantities.reduce(
            (sum, value) => sum + value,
            0,
          );
          const lowCount = quantities.filter((value) => value < 10).length;
          return (
            <details key={product.id}>
              <summary>
                <span>
                  <b>{product.title}</b>
                  <small>
                    {!product.primary_supplier_offer_id
                      ? "فعلاً ناموجود"
                      : product.seller_product_variants.some(
                            (variant) => variant.status === "OUT_OF_STOCK",
                          )
                        ? `${product.seller_product_variants.filter((variant) => variant.status === "OUT_OF_STOCK").length.toLocaleString("fa-IR")} تنوع ناموجود — تأمین‌کننده را تغییر دهید`
                        : "تأمین‌کننده متصل و موجود"}
                  </small>
                  <em>موجودی کل: {inventoryTotal.toLocaleString("fa-IR")}</em>
                  {lowCount > 0 && (
                    <strong>
                      {lowCount.toLocaleString("fa-IR")} تنوع زیر ۱۰ عدد —
                      تأمین‌کننده را تغییر دهید
                    </strong>
                  )}
                </span>
                <ChevronDown />
              </summary>
              {offers.length ? (
                <ActionForm action={assignSupplierToProductAction}>
                  <input type="hidden" name="productId" value={product.id} />
                  <label>
                    تأمین‌کننده اصلی
                    <select
                      name="primarySupplierOfferId"
                      defaultValue={product.primary_supplier_offer_id || ""}
                    >
                      <option value="">بدون تأمین‌کننده</option>
                      {offers.map((offer) => (
                        <option value={offer.id} key={offer.id}>
                          {offer.organization?.display_name || "شرکت تأمین"} ·{" "}
                          {formatRial(offer.base_cost)} · {offer.lead_time_days}{" "}
                          روز
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    پشتیبان
                    <select
                      name="backupSupplierOfferId"
                      defaultValue={product.backup_supplier_offer_id || ""}
                    >
                      <option value="">بدون پشتیبان</option>
                      {offers.map((offer) => (
                        <option value={offer.id} key={offer.id}>
                          {offer.organization?.display_name || "شرکت تأمین"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="sd-primary">
                    <Save /> ذخیره اتصال تأمین
                  </button>
                </ActionForm>
              ) : (
                <div className="empty-state">
                  هنوز هیچ تأمین‌کننده تأییدشده‌ای برای محصول خام این محصول وجود
                  ندارد.
                </div>
              )}
              <Link
                className="product-edit-link"
                href={`/seller/dashboard/products/${product.id}/edit`}
              >
                ویرایش همه اطلاعات محصول
              </Link>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function Tutorials({ data }: { data: SellerData }) {
  const complete = data.tutorials.filter(
      (item) => item.progress.completed,
    ).length,
    percent = Math.round((complete / Math.max(1, data.tutorials.length)) * 100);
  return (
    <div className="sd-stack">
      <section className="sd-training-hero">
        <div>
          <BookOpen />
          <div>
            <span>مسیر رشد فروشگاه</span>
            <h2>{percent}٪ مسیر را رفتی</h2>
            <p>
              {complete} از {data.tutorials.length} آموزش دیده شده.
            </p>
          </div>
        </div>
        <div>
          <i style={{ width: `${percent}%` }} />
        </div>
      </section>
      <section className="tutorial-grid rich-tutorial-grid">
        {data.tutorials.length ? (
          data.tutorials.map((item, index) => (
            <article
              className={`sd-card rich-tutorial ${item.progress.completed ? "done" : ""}`}
              key={item.id}
            >
              <div className="tutorial-media">
                <Image
                  src={item.thumbnailUrl}
                  alt={`تصویر آموزش ${item.title}`}
                  fill
                  sizes="(max-width: 900px) 100vw, 420px"
                />
                <span>مسیر {String(index + 1).padStart(2, "0")}</span>
              </div>
              {item.videoUrl ? (
                <div className="tutorial-video">
                  <video controls preload="metadata" poster={item.thumbnailUrl}>
                    <source src={item.videoUrl} />
                  </video>
                  <span>
                    <PlayCircle /> آموزش ویدیویی
                  </span>
                </div>
              ) : null}
              <div className="tutorial-content">
                <header>
                  <span>
                    {item.duration_minutes} دقیقه ·{" "}
                    {item.difficulty === "BEGINNER"
                      ? "مقدماتی"
                      : item.difficulty === "ADVANCED"
                        ? "پیشرفته"
                        : "متوسط"}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.summary || item.description}</p>
                </header>
                {item.learning_outcomes?.length ? (
                  <div className="tutorial-outcomes">
                    <b>بعد از این آموزش می‌توانی:</b>
                    <ul>
                      {item.learning_outcomes.map((outcome) => (
                        <li key={outcome}>
                          <Check />
                          {outcome}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <details>
                  <summary>
                    مطالعه آموزش قدم‌به‌قدم <ChevronDown />
                  </summary>
                  <div className="tutorial-steps">
                    <p>{item.description}</p>
                    {item.steps.map((step, stepIndex) => (
                      <section key={`${item.id}-${stepIndex}`}>
                        <i>{stepIndex + 1}</i>
                        <div>
                          <h4>{step.title}</h4>
                          <p>{step.body}</p>
                        </div>
                      </section>
                    ))}
                  </div>
                </details>
                <ActionForm action={updateTutorialProgressAction}>
                  <input type="hidden" name="tutorialId" value={item.id} />
                  <input
                    type="hidden"
                    name="completed"
                    value={item.progress.completed ? "false" : "true"}
                  />
                  <button
                    className={
                      item.progress.completed ? "completed" : "sd-primary"
                    }
                  >
                    {item.progress.completed ? (
                      <>
                        <BadgeCheck /> تکمیل شد
                      </>
                    ) : (
                      <>این آموزش را کامل کردم</>
                    )}
                  </button>
                </ActionForm>
              </div>
            </article>
          ))
        ) : (
          <Empty
            title="آموزشی منتشر نشده"
            text="آموزش‌های ادمین بعد از انتشار اینجا دیده می‌شوند."
          />
        )}
      </section>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <Package />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
