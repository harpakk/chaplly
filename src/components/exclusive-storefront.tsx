"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, ChevronLeft, Instagram, Search, ShoppingBag, Sparkles, Star } from "lucide-react";
import { ReelsGallery } from "@/components/reels-gallery";
import { formatPrice, type Product, type Reel } from "@/lib/catalog";
import type { StorefrontConfig } from "@/lib/storefront";
import { ResilientImage } from "@/components/resilient-image";

type Store = {
  name: string;
  slug: string;
  description: string | null;
  social_url: string | null;
  brand_color: string;
  accent_color: string;
  follower_count: number;
  is_verified: boolean;
  logoUrl: string;
  bannerUrl: string;
  storefront: StorefrontConfig;
};

function StoreProductCard({ product, storeSlug }: { product: Product; storeSlug: string }) {
  const href = `/products/${product.slug}?fromStore=${encodeURIComponent(storeSlug)}`;
  return <article className="store-product-card">
    <Link href={href} className="store-product-image">
      <ResilientImage src={product.image} alt={product.title} fill sizes="(max-width: 700px) 92vw, 45vw" />
      {product.compareAtPrice && <span>{Math.round((1 - product.price / product.compareAtPrice) * 100).toLocaleString("fa-IR")}٪ تخفیف</span>}
    </Link>
    <div>
      <small>{product.category}</small>
      <Link href={href}><h3>{product.title}</h3></Link>
      <p>{product.subtitle || product.description.slice(0, 110)}</p>
      <footer>
        <div><strong>{formatPrice(product.price)}</strong>{product.compareAtPrice && <del>{formatPrice(product.compareAtPrice)}</del>}</div>
        {product.reviewCount > 0 ? <span><Star fill="currentColor" /> {product.rating.toLocaleString("fa-IR")}</span> : <span className="new-product-badge"><i>NEW</i></span>}
        <Link href={href}>دیدن و خرید <ChevronLeft /></Link>
      </footer>
    </div>
  </article>;
}

function ProductSection({ id, eyebrow, title, products, storeSlug }: { id?: string; eyebrow: string; title: string; products: Product[]; storeSlug: string }) {
  if (!products.length) return null;
  return <section className="store-product-section" id={id}>
    <header><div><span>{eyebrow}</span><h2>{title}</h2></div><Link href={`/search?shop=${storeSlug}`}>همه محصولات <ArrowLeft /></Link></header>
    <div>{products.slice(0, 2).map((product) => <StoreProductCard key={product.id} product={product} storeSlug={storeSlug} />)}</div>
  </section>;
}

export function StorefrontLanding({ store, products, reels }: { store: Store; products: Product[]; reels: Reel[] }) {
  const config = store.storefront;
  const storeProducts = useMemo(() => products.filter((product) => product.shopSlug === store.slug), [products, store.slug]);
  const popular = useMemo(() => [...storeProducts].sort((a, b) => (b.salesCount * 100 + b.viewCount + b.reviewCount * 10) - (a.salesCount * 100 + a.viewCount + a.reviewCount * 10)).slice(0, 2), [storeProducts]);
  const newest = storeProducts.slice(0, 2);
  const discounts = useMemo(() => storeProducts.filter((product) => product.compareAtPrice && product.compareAtPrice > product.price).sort((a, b) => (1 - b.price / (b.compareAtPrice || b.price)) - (1 - a.price / (a.compareAtPrice || a.price))).slice(0, 2), [storeProducts]);
  const affordable = useMemo(() => [...storeProducts].sort((a, b) => a.price - b.price).slice(0, 2), [storeProducts]);
  const firstProductSection = config.popularEnabled && popular.length ? "popular" : config.newestEnabled && newest.length ? "newest" : config.discountsEnabled && discounts.length ? "discounts" : config.affordableEnabled && affordable.length ? "affordable" : "";
  const hasProductSections = Boolean(firstProductSection);
  const requiredBanners = config.bannerMode === "SLIDER" ? 2 : 1;
  const banners = config.bannerEnabled && config.banners.length >= requiredBanners ? config.banners : [];
  const [bannerIndex, setBannerIndex] = useState(0);
  useEffect(() => {
    if (config.bannerMode !== "SLIDER" || banners.length < 2) return;
    const timer = window.setInterval(() => setBannerIndex((index) => (index + 1) % banners.length), 5000);
    return () => window.clearInterval(timer);
  }, [banners.length, config.bannerMode]);
  const activeBanner = banners[bannerIndex] || banners[0];
  const aboutParagraphs = config.aboutBody.split(/\n\s*\n|\n/).map((item) => item.trim()).filter(Boolean);

  return <div className="exclusive-store" style={{ "--store-color": store.brand_color, "--store-accent": store.accent_color } as React.CSSProperties}>
    {config.announcementEnabled && config.announcement && <div className="store-announcement">{config.announcement}</div>}
    <header className="exclusive-nav">
      <Link href={`/stores/${store.slug}`}><ResilientImage src={store.logoUrl} alt="" width={72} height={72} /><b>{store.name}</b>{store.is_verified && <BadgeCheck />}</Link>
      <nav>{hasProductSections && <a href="#store-products">محصولات</a>}{config.reelsEnabled && reels.length > 0 && <a href="#store-reels">ویدیوها</a>}{config.aboutEnabled && aboutParagraphs.length > 0 && <a href="#about-store">درباره ما</a>}{config.faqEnabled && config.faqs.length >= 3 && <a href="#store-faq">سؤالات متداول</a>}</nav>
      <div><Link href={`/search?shop=${store.slug}`} aria-label="جست‌وجو"><Search /></Link><Link href="/cart" aria-label="سبد خرید"><ShoppingBag /></Link></div>
    </header>

    {config.heroEnabled && <section className="exclusive-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(12,10,17,.9),rgba(12,10,17,.18)),url("${store.bannerUrl}")` }}>
      <div><span><Sparkles /> فروشگاه اختصاصی</span><ResilientImage src={store.logoUrl} alt={`لوگوی ${store.name}`} width={160} height={160} /><h1>{store.name}</h1><p>{config.tagline || store.description || "محصول‌هایی با امضای خودمان؛ ساخته‌شده برای سلیقه‌هایی که تکراری نیستند."}</p><a href={hasProductSections ? "#store-products" : `/search?shop=${store.slug}`}>دیدن کالکشن</a></div>
      <aside><b>{storeProducts.length.toLocaleString("fa-IR")}</b><span>محصول در کالکشن</span>{store.social_url && <a href={store.social_url} target="_blank" rel="noreferrer"><Instagram /> شبکه اجتماعی برند</a>}</aside>
    </section>}
    {config.heroEnabled && <section className="exclusive-marquee"><span>اوریجینال باش ✦ انتخاب خودت باش ✦ ترند را خودت بساز ✦ {store.name} ✦</span></section>}

    <main className="storefront-main">
      {config.reelsEnabled && reels.length > 0 && <section className="store-reels-section" id="store-reels"><header><span>از نزدیک ببین</span><h2>ویدیوهای {store.name}</h2><p>محصول‌ها، پشت‌صحنه و حال‌وهوای این برند در قاب‌های کوتاه.</p></header><ReelsGallery reels={reels.slice(0, 6)} /></section>}
      {config.popularEnabled && <ProductSection id={firstProductSection === "popular" ? "store-products" : undefined} eyebrow="انتخاب مشتری‌ها" title="محبوب‌ترین محصولات" products={popular} storeSlug={store.slug} />}
      {config.newestEnabled && <ProductSection id={firstProductSection === "newest" ? "store-products" : undefined} eyebrow="تازه از راه رسیده" title="جدیدترین‌های فروشگاه" products={newest} storeSlug={store.slug} />}

      {activeBanner && <section className="store-promo-slider" aria-label="پیشنهادهای فروشگاه">
        <div key={`${bannerIndex}-${activeBanner.url}`} style={{ backgroundImage: `linear-gradient(90deg,rgba(16,12,20,.76),rgba(16,12,20,.1)),url("${activeBanner.url}")` }}>
          <span>پیشنهاد ویژه {store.name}</span>{activeBanner.title && <h2>{activeBanner.title}</h2>}{activeBanner.subtitle && <p>{activeBanner.subtitle}</p>}{activeBanner.ctaLabel && activeBanner.ctaUrl && <Link href={activeBanner.ctaUrl}>{activeBanner.ctaLabel}<ArrowLeft /></Link>}
        </div>
        {config.bannerMode === "SLIDER" && banners.length > 1 && <nav>{banners.map((banner, index) => <button key={banner.url} className={index === bannerIndex ? "active" : ""} onClick={() => setBannerIndex(index)} aria-label={`بنر ${index + 1}`} />)}</nav>}
      </section>}

      {config.discountsEnabled && <ProductSection id={firstProductSection === "discounts" ? "store-products" : undefined} eyebrow="فرصت خوب خرید" title="بیشترین تخفیف‌ها" products={discounts} storeSlug={store.slug} />}
      {config.affordableEnabled && <ProductSection id={firstProductSection === "affordable" ? "store-products" : undefined} eyebrow="انتخاب اقتصادی" title="مقرون‌به‌صرفه‌ترین‌ها" products={affordable} storeSlug={store.slug} />}

      {config.aboutEnabled && aboutParagraphs.length > 0 && <section className="store-about-section" id="about-store"><div><span>پشت این ویترین</span><h2>{config.aboutTitle}</h2></div><article>{aboutParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article></section>}
      {config.faqEnabled && config.faqs.length >= 3 && <section className="store-faq-section" id="store-faq"><header><span>قبل از خرید</span><h2>سؤالات متداول</h2></header><div>{config.faqs.map((faq, index) => <details key={`${faq.question}-${index}`}><summary>{faq.question}<span>+</span></summary><p>{faq.answer}</p></details>)}</div></section>}
    </main>

    <footer className="storefront-footer"><div><ResilientImage src={store.logoUrl} alt="" width={70} height={70} /><div><b>{store.name}</b><p>{config.tagline || store.description}</p></div></div><nav><Link href={hasProductSections ? "#store-products" : `/search?shop=${store.slug}`}>محصولات</Link><Link href="/cart">سبد خرید چاپلی</Link><Link href="/">بازگشت به بازار چاپلی</Link></nav><small>پرداخت و سفارش‌ها با زیرساخت امن چاپلی انجام می‌شوند.</small></footer>
  </div>;
}
