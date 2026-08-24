import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  ChevronLeft,
  CreditCard,
  PackageCheck,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { AddToCart } from "@/components/add-to-cart";
import { ProductGallery } from "@/components/product-gallery";
import { ProductTabs } from "@/components/product-tabs";
import { ProductCard } from "@/components/product-card";
import { ProductViewTracker } from "@/components/product-view-tracker";
import { SizeGuideModal } from "@/components/size-guide-modal";
import { ReelsGallery } from "@/components/reels-gallery";
import { ResilientImage } from "@/components/resilient-image";
import { formatPrice, type Product } from "@/lib/catalog";
import {
  findProduct,
  getLiveProductInventory,
  getProductQualityDescription,
  getProductSizeGuide,
  getProducts,
} from "@/lib/catalog-data";
import { getProductReviews, getProductReels, getReelInteractionIds } from "@/lib/dashboard-data";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const product = await findProduct((await params).slug);
  return {
    title: product?.title ?? "محصول",
    robots:
      product?.visibility === "PRIVATE" || product?.moderationStatus !== "APPROVED"
        ? { index: false, follow: false }
        : undefined,
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const fromStore = typeof (await searchParams).fromStore === "string";
  const [cachedProduct, products] = await Promise.all([
    findProduct(slug),
    getProducts(),
  ]);
  if (!cachedProduct) notFound();
  const [inventory, reviews, reels, user, sizeGuide, qualityDescription] = await Promise.all([
    getLiveProductInventory(cachedProduct.id),
    getProductReviews(cachedProduct.id),
    getProductReels(cachedProduct.id),
    getCurrentUser(),
    getProductSizeGuide(cachedProduct.id),
    getProductQualityDescription(cachedProduct.id),
  ]);
  const reelInteractions = await getReelInteractionIds(user?.id);
  const product = {
    ...cachedProduct,
    qualityDescription: qualityDescription || undefined,
    variants: cachedProduct.variants.map((variant) => ({
      ...variant,
      inventory: inventory.get(variant.id) || 0,
    })),
  };
  const otherProducts = products.filter((item) => item.id !== product.id);
  const sameCategoryProducts = otherProducts.filter((item) => item.categorySlug === product.categorySlug);
  const sameStyleProducts = otherProducts.filter((item) => item.graphicStyles.some((style) => product.graphicStyles.some((current) => current.slug === style.slug)));
  const admin = createSupabaseAdmin();
  const [supplierResult, wishlistResult] = await Promise.all([
    admin
      .from("seller_products")
      .select("primary:supplier_offers!seller_products_primary_supplier_offer_id_fkey(supplier_organization_id,capacity_per_day),design:designs(owner_user_id)")
      .eq("id", product.id)
      .maybeSingle(),
    user
      ? admin
          .from("wishlist_items")
          .select("seller_product_id")
          .eq("user_id", user.id)
          .eq("seller_product_id", product.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const supplier = supplierResult.data;
  const productDesign = Array.isArray(supplier?.design) ? supplier.design[0] : supplier?.design;
  const isProductCreator = Boolean(user?.id && productDesign?.owner_user_id === user.id);
  const initiallyLiked = Boolean(wishlistResult.data);
  const primary = Array.isArray(supplier?.primary)
    ? supplier.primary[0]
    : supplier?.primary;
  let supplierOverCapacity = false;
  if (primary?.supplier_organization_id && primary.capacity_per_day > 0) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count } = await admin
      .from("fulfilments")
      .select("id", { count: "exact", head: true })
      .eq("supplier_organization_id", primary.supplier_organization_id)
      .gte("created_at", start.toISOString());
    supplierOverCapacity = (count || 0) >= primary.capacity_per_day;
  }
  return (
    <main className="pdp-page">
      <ProductViewTracker productId={product.id} />
      {isProductCreator && (
        <div className="shop-container pdp-owner-toolbar">
          <span>این محصول متعلق به فروشگاه شماست.</span>
          <Link href={`/seller/dashboard/products/${product.id}/edit`}>
            <Pencil /> ویرایش محصول
          </Link>
        </div>
      )}
      {(product.visibility === "PRIVATE" || product.moderationStatus !== "APPROVED") && (
        <div className="shop-container direct-link-product-note">
          این محصول در ویترین و جست‌وجو نمایش داده نمی‌شود و فقط با لینک مستقیم در دسترس است.
        </div>
      )}
      <div className="shop-container breadcrumbs">
        <Link href="/">خانه</Link>
        <ChevronLeft />
        <Link href={`/category/${product.categorySlug}`}>
          {product.category}
        </Link>
        <ChevronLeft />
        <Link href={`/category/${product.subcategorySlug}`}>
          {product.subcategory}
        </Link>
        <ChevronLeft />
        <Link href={`/search?style=${encodeURIComponent(product.graphicStyleSlug)}`}>
          {product.graphicStyle}
        </Link>
        <ChevronLeft />
        <Link href={`/stores/${product.shopSlug}`}>{product.seller}</Link>
        <ChevronLeft />
        <b>{product.title}</b>
      </div>
      <section className="shop-container pdp-grid pdp-grid-wow">
        <ProductGallery
          images={product.images}
          title={product.title}
          productId={product.id}
          initialLiked={initiallyLiked}
        />
        <div className="pdp-story-spine">
          <span className="spine-eyebrow">درباره این محصول</span>
          <h2>{product.subtitle}</h2>
          <p>{product.description}</p>
          {product.qualityDescription && (
            <section className="pdp-quality-story">
              <span>درباره کیفیت</span>
              <p>{product.qualityDescription}</p>
              <a href="#quality">بیشتر بخوانید</a>
            </section>
          )}
          <dl>
            <div>
              <dt>سبک طرح</dt>
              <dd>
                {product.graphicStyles.map((item) => item.name).join("، ") ||
                  "—"}
              </dd>
            </div>
            <div>
              <dt>رنگ‌ها</dt>
              <dd>{product.colors.join("، ")}</dd>
            </div>
            <div>
              <dt>اندازه‌ها</dt>
              <dd>{product.sizes.join("، ")}</dd>
            </div>
            <div>
              <dt>ساخته‌ی</dt>
              <dd>
                <Link href={`/stores/${product.shopSlug}`}>
                  {product.seller}
                </Link>
              </dd>
            </div>
          </dl>
          <div className="trust-spine">
            <span>
              <ShieldCheck />
              <b>تضمین کیفیت چاپلی</b>
              <small>بررسی پیش از ارسال</small>
            </span>
            <span>
              <RotateCcw />
              <b>۷ روز ضمانت بازگشت</b>
              <small>خرید بدون استرس</small>
            </span>
            <span>
              <Sparkles />
              <b>طرح اوریجینال</b>
              <small>از کریتور مستقل</small>
            </span>
            <span>
              <CreditCard />
              <b>خرید امن</b>
              <small>پرداخت محافظت‌شده</small>
            </span>
            <span>
              <PackageCheck />
              <b>بسته‌بندی کنترل‌شده</b>
              <small>آماده رسیدن به دست تو</small>
            </span>
            <span>
              <BadgeCheck />
              <b>فروشنده تأییدشده</b>
              <small>هویت بررسی‌شده</small>
            </span>
          </div>
        </div>
        <aside className="pdp-info pdp-buy-card">
          {product.badge && <span className="pdp-badge">{product.badge}</span>}
          <p className="pdp-seller store-hover-card">
            {product.sellerLogo && (
              <ResilientImage
                className="pdp-seller-logo"
                src={product.sellerLogo}
                alt={`لوگوی ${product.seller}`}
                width={30}
                height={30}
                unoptimized
              />
            )}
            فروشنده: <strong>{product.seller}</strong>
            <ShieldCheck />
            <span>
              <b>{product.seller}</b>
              <small>{product.sellerDescription || "فروشگاه تأییدشده چاپلی"}</small>
              {product.sellerSocialUrl && <small>{product.sellerSocialUrl}</small>}
            </span>
          </p>
          <h1>{product.title}</h1>
          {reviews.length > 0 ? (
            <div className="pdp-rating">
              <span>
                <Star fill="currentColor" />
                {product.rating.toLocaleString("fa-IR")}
              </span>
              <a href="#reviews">
                {reviews.length.toLocaleString("fa-IR")} دیدگاه
              </a>
            </div>
          ) : (
            <div className="pdp-new-product">
              <span className="new-product-badge"><i>NEW</i></span>
            </div>
          )}
          <div className="pdp-price">
            <strong>{formatPrice(product.price)}</strong>
            {product.compareAtPrice && (
              <>
                <del>{formatPrice(product.compareAtPrice)}</del>
                <span>
                  {Math.round(
                    (1 - product.price / product.compareAtPrice) * 100,
                  ).toLocaleString("fa-IR")}
                  ٪ تخفیف
                </span>
              </>
            )}
          </div>
          <AddToCart product={product} redirectToCart={fromStore} />
          {supplierOverCapacity && (
            <p className="supplier-capacity-notice">
              ظرفیت سفارش امروز این تأمین‌کننده تکمیل شده است؛ تحویل این محصول یک روز بیشتر زمان می‌برد.
            </p>
          )}
          {sizeGuide && <SizeGuideModal guide={sizeGuide} />}
          <div className="delivery-card">
            <Truck />
            <div>
              <strong>{product.delivery}</strong>
              <span>پس از ارسال، کد رهگیری فعال می‌شود.</span>
            </div>
          </div>
        </aside>
      </section>
      <ProductTabs product={product} reviews={reviews} />
      {product.videos?.length ? <section className="shop-container product-video-section"><div><span>نمایش واقعی محصول</span><h2>ویدئوی محصول</h2><p>این ویدئو توسط فروشنده برای نمایش بهتر محصول بارگذاری شده است.</p></div><video src={product.videos[0]} controls preload="metadata" playsInline/></section> : null}
      {reels.length ? <section className="shop-container product-reels-section"><div className="section-title-row"><div><span>ریلز این محصول</span><h2>محصول را در ویدیو ببین</h2></div></div><ReelsGallery reels={reels} initialLiked={reelInteractions.liked} initialSaved={reelInteractions.saved}/></section> : null}
      <SimilarityRow
        eyebrow="از همین دسته"
        title={`بیشتر از ${product.category}`}
        items={sameCategoryProducts.length ? sameCategoryProducts : otherProducts}
      />
      <SimilarityRow
        eyebrow="همین سبک"
        title="محصول‌های مشابه"
        items={(sameStyleProducts.length ? sameStyleProducts : otherProducts).slice(0, 4)}
      />
    </main>
  );
}

function SimilarityRow({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: Product[];
}) {
  if (!items.length) return null;
  return (
    <section className="shop-container related-products similarity-row">
      <div className="section-title-row">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="product-grid">
        {items.slice(0, 4).map((item) => (
          <ProductCard product={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}
