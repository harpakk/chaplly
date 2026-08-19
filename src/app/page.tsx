import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Headphones, PackageCheck, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getMarketplaceData } from "@/lib/catalog-data";
import { getCurrentUser } from "@/lib/auth";
import { getWishlistProductIds } from "@/lib/dashboard-data";
import { SiteViewTracker } from "@/components/site-view-tracker";
import { ReelsGallery } from "@/components/reels-gallery";
import { getReelInteractionIds } from "@/lib/dashboard-data";

const marqueeMessages = [
  "اوریجینال، نه کپی",
  "ساخته‌شده توسط کریتورها",
  "هرچی کمتر تکراری، بهتر",
  "وایب خودتو بپوش",
  "طرح‌هایی که همه‌جا نیستن",
  "هدیه برای آدم‌های سخت‌پسند",
  "کشف برندهای مستقل ایرانی",
  "ترند باش، ولی خودت بمون",
  "هر محصول یک قصه واقعی",
  "انتخاب‌های بامزه و غیرمنتظره",
];

export default async function MarketplaceHome() {
  const [marketplace,user]=await Promise.all([getMarketplaceData(),getCurrentUser()]);
  const {graphicStyles,products,shops,categories,reels}=marketplace;
  const [likedProductIds,reelInteractions]=await Promise.all([getWishlistProductIds(user?.id),getReelInteractionIds(user?.id)]);
  return (
    <main>
      <SiteViewTracker kind="index" />
      <section className="market-hero">
        <div className="shop-container market-hero-grid">
          <div className="market-hero-copy">
            <span className="market-kicker"><Sparkles size={16} /> ساخته‌شده برای متفاوت بودن</span>
            <h1>چیزهایی که دوست داری،<br /><em>همان‌طور که دوست داری.</em></h1>
            <p>محصولات خاص از طراحان مستقل ایرانی؛ با چاپ حرفه‌ای، تضمین کیفیت و ارسال قابل پیگیری.</p>
            <div className="market-hero-actions">
              <a className="market-button primary" href="#products">دیدن محصولات <ArrowLeft size={19} /></a>
              <a className="market-button secondary" href="#why">چرا چاپلی؟</a>
            </div>
            <div className="hero-trust">
              <span><ShieldCheck size={18} /> ضمانت کیفیت</span>
              <span><Truck size={18} /> ارسال به سراسر ایران</span>
              <span><Headphones size={18} /> پشتیبانی واقعی</span>
            </div>
          </div>
          <div className="market-hero-product">
            <div className="hero-product-orbit orbit-one" />
            <div className="hero-product-orbit orbit-two" />
            <Image src="/images/product-placeholder.png" alt="تیشرت چاپی مینیمال چاپلی" width={680} height={680} priority />
            <div className="floating-pill top"><BadgeCheck size={19} /> انتخاب خریداران</div>
            <div className="floating-pill bottom"><strong>۴٫۸</strong> امتیاز از ۱۲۶ خریدار</div>
          </div>
        </div>
      </section>
      <div className="trend-marquee" aria-label="ارزش‌های چاپلی"><div>{[...marqueeMessages,...marqueeMessages].map((message,index)=><span key={`${message}-${index}`}>{message}<i>✦</i></span>)}</div></div>
      {reels.length>0&&<section className="home-reels-section"><div className="shop-container"><div className="section-title-row"><div><span>پربازدیدهای ۱۰ روز اخیر</span><h2>ریلز محصولات</h2></div></div><ReelsGallery reels={reels} initialLiked={reelInteractions.liked} initialSaved={reelInteractions.saved}/></div></section>}
      <section className="category-section" id="categories">
        <div className="shop-container">
          <div className="section-title-row"><div><span>برای هر سلیقه</span><h2>از کجا شروع کنیم؟</h2></div><a href="#products">مشاهده همه <ArrowLeft size={17} /></a></div>
          <div className="category-grid">
            {categories.map((category, index) => (
              <Link className={`category-card cat-${["coral","blue","gold","mint"][index%4]}`} href={`/category/${category.slug}`} key={category.name}>
                <Image
                  src={category.image === "/images/product-placeholder.png"
                    ? products.find((product) => product.categorySlug === category.slug)?.image || category.image || "/images/product-placeholder.png"
                    : category.image || "/images/product-placeholder.png"}
                  alt={category.name}
                  fill
                  sizes="(max-width: 700px) 100vw, 25vw"
                />
                <div><small>۰{index + 1}</small><h3>{category.name}</h3><p>{category.detail}</p></div><ArrowLeft size={22} />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="shelf-section">
        <div className="shop-container">
          <div className="section-title-row"><div><span>برای مود امروز</span><h2>تیشرت‌هایی که حرف دارن</h2></div><Link href="/subcategory/tshirts">همه تیشرت‌ها <ArrowLeft /></Link></div>
          <div className="product-grid">{products.filter((item) => item.categorySlug === "apparel").map((product) => <ProductCard product={product} liked={likedProductIds.includes(product.id)} key={product.id} />)}</div>
        </div>
      </section>
      <section className="shops-section" id="shops">
        <div className="shop-container">
          <div className="section-title-row"><div><span>آدم‌های پشت طرح‌ها</span><h2>فروشگاه‌هایی که باید بشناسی</h2></div><Link href="/search">همه فروشگاه‌ها <ArrowLeft /></Link></div>
          <div className="shop-grid">{shops.map((shop) => {const preview=products.filter((item)=>item.shopSlug===shop.slug).slice(0,3);return <article className="shop-card" key={shop.id}><Link className="shop-cover" href={`/stores/${shop.slug}`}><Image src={shop.banner || "/images/product-placeholder.png"} alt={`بنر ${shop.name}`} fill sizes="400px" /></Link><div><span className="shop-avatar"><Image src={shop.logo || "/images/product-placeholder.png"} alt={`لوگوی ${shop.name}`} fill sizes="52px" /></span><small>{shop.handle}</small><h3>{shop.name}</h3><p>{shop.bio}</p>{preview.length>0&&<div className="shop-product-peek">{preview.map((product)=><Link href={`/products/${product.slug}`} key={product.id}><Image src={product.image} alt={product.title} fill sizes="90px"/><span>{product.title}</span></Link>)}</div>}<Link href={`/stores/${shop.slug}`}>دیدن فروشگاه <ArrowLeft /></Link></div></article>})}</div>
        </div>
      </section>
      <section className="products-section">
        <div className="shop-container">
          <div className="section-title-row"><div><span>بدون مرز دسته‌بندی</span><h2>الان همه اینا رو می‌خوان</h2></div><Link href="/search?sort=popular">بیشتر ببین <ArrowLeft /></Link></div>
          <div className="product-grid">{[...products].sort((a,b) => b.reviewCount-a.reviewCount).slice(0,4).map((product) => <ProductCard product={product} liked={likedProductIds.includes(product.id)} key={product.id} />)}</div>
        </div>
      </section>
      <section className="graphic-section" id="graphics">
        <div className="shop-container">
          <div className="section-title-row"><div><span>اول وایب، بعد محصول</span><h2>با سبک گرافیک بگرد</h2></div></div>
          <div className="graphic-grid">{graphicStyles.map((style, index) => {const matches=products.filter((product)=>product.graphicStyles.some((item)=>item.slug===style.slug));const image=matches[index%Math.max(1,matches.length)]?.image||style.image;return <Link className={`graphic-card graphic-${index+1}`} href={`/search?graphic=${style.slug}`} key={style.slug}>{image&&<Image src={image} alt={`محصولی با سبک ${style.name}`} fill sizes="(max-width: 700px) 100vw, 25vw"/>}<span>0{index+1}</span><div><h3>{style.name}</h3><p>{style.caption}</p><ArrowLeft /></div></Link>})}</div>
        </div>
      </section>
      <section className="products-section" id="products">
        <div className="shop-container">
          <div className="section-title-row"><div><span>محبوب این هفته</span><h2>انتخاب‌های دوست‌داشتنی</h2></div><div className="product-tabs"><button className="active">پرفروش‌ها</button><button>تازه‌ها</button><button>پیشنهاد ویژه</button></div></div>
          {products.length?<div className="product-grid lovable-grid">{products.slice(0,24).map((product) => <ProductCard product={product} liked={likedProductIds.includes(product.id)} key={product.id} />)}</div>:<div className="no-results"><PackageCheck/><h3>هنوز محصولی منتشر نشده</h3><p>پس از تأیید اولین محصول، این ویترین خودکار پر می‌شود.</p></div>}
          <div className="feed-continuation"><span>این فقط شروعشه</span><p>این فید برای نمایش ۲۴ محصول و بیشتر طراحی شده؛ با اضافه‌شدن محصول‌ها ردیف‌های جدید خودکار ساخته می‌شن.</p><Link className="market-button secondary" href="/search">ادامه فید محصولات <ArrowLeft/></Link></div>
        </div>
      </section>
      <section className="why-section" id="why">
        <div className="shop-container why-grid">
          <div className="why-copy"><span>خرید با خیال راحت</span><h2>هر سفارش، با دقت برای تو ساخته می‌شود.</h2><p>ما از لحظه ثبت سفارش تا رسیدن بسته کنارت هستیم و وضعیت سفارش را شفاف به تو اطلاع می‌دهیم.</p><Link href="/search">اولین انتخابت را پیدا کن <ArrowLeft size={18} /></Link></div>
          <div className="why-points">
            <article><PackageCheck /><div><h3>تولید پس از سفارش</h3><p>محصول تازه و اختصاصی تو تولید می‌شود.</p></div></article>
            <article><ShieldCheck /><div><h3>تضمین رضایت</h3><p>اگر مشکلی باشد، برای حلش کنار تو هستیم.</p></div></article>
            <article><Truck /><div><h3>تحویل شفاف</h3><p>زمان تولید و ارسال را پیش از خرید می‌بینی.</p></div></article>
          </div>
        </div>
      </section>
    </main>
  );
}
