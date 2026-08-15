import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, PackageCheck, Palette, Rocket, Sparkles, Store, WalletCards } from "lucide-react";
import { IncomeCalculator } from "@/components/income-calculator";
import { QuickSellerSignupForm, SellerSignupTrigger } from "@/components/seller-quick-signup";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const number=(value:number)=>value.toLocaleString("fa-IR");
const one=<T,>(value:T|T[]|null|undefined)=>Array.isArray(value)?value[0]:value;
const fileUrl=(file:{bucket?:string;path?:string}|null|undefined)=>file?.bucket&&file.path?`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(file.bucket)}/${file.path.split("/").map(encodeURIComponent).join("/")}`:"/images/product-placeholder.png";

async function getSellerLandingData(){
 const db=createSupabaseAdmin();
 const tehranDate=new Date(Date.now()+3.5*3600000).toISOString().slice(0,10);
 const todayStart=new Date(`${tehranDate}T00:00:00+03:30`).toISOString();
 const [raws,sellerCount,todayOrders,products,recentItems]=await Promise.all([
  db.from("raw_products").select("id,name,description,base_cost,suggested_price,raw_product_views(side,background:storage_files!raw_product_views_background_file_id_fkey(bucket,path))").eq("status","ACTIVE").order("name"),
  db.from("organizations").select("id",{count:"exact",head:true}).eq("type","SELLER"),
  db.from("orders").select("id",{count:"exact",head:true}).not("paid_at","is",null).gte("paid_at",todayStart),
  db.from("seller_products").select("id,title,slug,store_id,sales_count,stores(id,name,slug,description,organization_id,banner:storage_files!stores_banner_file_id_fkey(bucket,path)),product_images(is_primary,sort_order,file:storage_files!product_images_file_id_fkey(bucket,path))").eq("status","PUBLISHED").eq("moderation_status","APPROVED").order("sales_count",{ascending:false}).limit(8),
  db.from("order_items").select("order_id,seller_organization_id,orders!inner(paid_at,status)").not("seller_organization_id","is",null).gte("orders.paid_at",new Date(Date.now()-30*86400000).toISOString()).not("orders.status","in",'("CANCELLED","RETURNED")').limit(5000),
 ]);
 for(const result of [raws,sellerCount,todayOrders,products,recentItems])if(result.error)throw new Error(result.error.message);
 const salesBySeller=new Map<string,Set<string>>();for(const item of recentItems.data||[]){if(!item.seller_organization_id)continue;const orders=salesBySeller.get(item.seller_organization_id)||new Set<string>();orders.add(item.order_id);salesBySeller.set(item.seller_organization_id,orders);}
 const topSeller=[...salesBySeller].sort((a,b)=>b[1].size-a[1].size)[0];
 const topSellerResult=topSeller?await db.from("organizations").select("display_name").eq("id",topSeller[0]).maybeSingle():null;
 const productRows=products.data||[];const exampleStore=one(productRows[0]?.stores);
 return{
  rawProducts:(raws.data||[]).map(raw=>{const view=raw.raw_product_views?.find(view=>view.side==="FRONT")||raw.raw_product_views?.[0];return{id:raw.id,name:raw.name,description:raw.description,profit:Math.max(0,Number(raw.suggested_price)-Number(raw.base_cost)),image:fileUrl(one(view?.background))};}),
  sellerCount:sellerCount.count||0,todayOrders:todayOrders.count||0,
  success:topSeller&&topSellerResult?.data?{name:topSellerResult.data.display_name,orders:topSeller[1].size}:null,
  example:exampleStore?{name:exampleStore.name,slug:exampleStore.slug,description:exampleStore.description,banner:fileUrl(one(exampleStore.banner)),products:productRows.filter(product=>product.store_id===exampleStore.id).slice(0,3).map(product=>({title:product.title,slug:product.slug,image:fileUrl(one([...product.product_images].sort((a,b)=>Number(b.is_primary)-Number(a.is_primary)||a.sort_order-b.sort_order)[0]?.file))}))}:null,
 };
}

export default async function SellerLandingPage(){
 const data=await getSellerLandingData();
 return <main className="creator-landing seller-conversion-page">
  <header className="creator-header"><div className="creator-container"><Link className="creator-logo" href="/seller"><span>چ</span>چاپلی <small>برای سازنده‌ها</small></Link><div><Link className="creator-login" href="/seller/login">ورود</Link><SellerSignupTrigger className="creator-button small">رایگان شروع کن <ArrowLeft/></SellerSignupTrigger></div></div></header>
  <section className="creator-hero seller-conversion-hero"><div className="creator-blob one"/><div className="creator-container creator-hero-grid"><div><span className="creator-kicker"><Sparkles/> بدون سرمایه اولیه</span><h1>فروشگاه خودتو<br/><em>رایگان بساز</em></h1><p>برند خودتو بدون خرید موجودی، انبار، ساخت سایت یا درگیری با چاپ و ارسال راه بنداز.</p><div className="free-proof"><strong>کاملاً رایگان</strong><span>بدون هزینه ثبت‌نام • بدون خرید موجودی • بدون حداقل سفارش</span></div><div className="hero-objections"><span>هزینه داره؟ <b>نه</b></span><span>باید جنس بخری؟ <b>نه</b></span><span>ارسال با منه؟ <b>نه</b></span></div></div><aside className="hero-signup-box"><span>۶۰ ثانیه دیگه اولین محصولت آماده‌ست.</span><h2>همین الان شروع کن</h2><QuickSellerSignupForm compact/></aside></div></section>
  <section className="money-strip free-strip"><div className="creator-container"><span><b>۰ ریال</b> هزینه ثبت‌نام</span><span><b>۰ عدد</b> حداقل سفارش</span><span><b>۰ عدد</b> موجودی لازم</span></div></section>
  <section className="creator-section simple-workflow" id="how"><div className="creator-container"><SectionTitle eyebrow="واقعاً همین‌قدر ساده" title="سه قدم تا فروشگاه آماده" copy="سرعت، بخشی از محصوله؛ نه یک وعده تبلیغاتی."/><div>{[[Store,"۱. رایگان ثبت‌نام کن","فقط ایمیل و رمز عبور."],[Palette,"۲. محصولت رو بساز","محصول خام رو انتخاب کن و طرحت رو بنداز روش."],[PackageCheck,"۳. بفروش؛ بقیه با ما","چاپ، بسته‌بندی و ارسال در چاپلی مدیریت می‌شه."]].map(([Icon,title,copy])=><article key={String(title)}><Icon/><h3>{String(title)}</h3><p>{String(copy)}</p></article>)}</div><CenteredCta/></div></section>
  <section className="creator-section raw-profit-section"><div className="creator-container"><SectionTitle eyebrow="محصول آماده برای ایده تو" title="همه محصول‌های خام؛ با سود پیشنهادی" copy="سود نمایش‌داده‌شده از اختلاف قیمت پیشنهادی و هزینه پایه واقعی هر محصول محاسبه شده است."/><div className="raw-profit-grid">{data.rawProducts.map(product=><article key={product.id}><div><Image src={product.image} alt={product.name} fill sizes="(max-width:600px) 46vw,220px"/></div><h3>{product.name}</h3><p>{product.description||"آماده برای طراحی و فروش در فروشگاه تو"}</p><span>سود پیشنهادی تا <b>{number(product.profit)} ریال</b></span></article>)}</div><CenteredCta/></div></section>
  {data.example&&<section className="creator-section example-store-section"><div className="creator-container"><SectionTitle eyebrow="یک فروشگاه واقعی" title="فروشگاه شما می‌تونه ۱۰ دقیقه دیگه شبیه این باشه."/><article className="finished-store"><div className="finished-store-banner"><Image src={data.example.banner} alt={`بنر ${data.example.name}`} fill sizes="900px"/><span>{data.example.name}</span></div><p>{data.example.description||"یک فروشگاه واقعی ساخته‌شده با چاپلی"}</p><div>{data.example.products.map(product=><Link href={`/products/${product.slug}`} key={product.slug}><span><Image src={product.image} alt={product.title} fill sizes="180px"/></span><b>{product.title}</b></Link>)}</div></article><CenteredCta/></div></section>}
  {(data.success||data.sellerCount>100||data.todayOrders>500)&&<section className="creator-section real-proof-section"><div className="creator-container"><SectionTitle eyebrow="فقط عدد واقعی" title="فروشنده‌ها همین حالا در حال ساختن‌اند"/><div>{data.success&&<article><WalletCards/><b>{data.success.name}</b><span>در ۳۰ روز اخیر {number(data.success.orders)} سفارش واقعی گرفته.</span></article>}{data.sellerCount>100&&<article><Store/><b>+{number(data.sellerCount)} فروشنده</b><span>به چاپلی پیوسته‌اند.</span></article>}{data.todayOrders>500&&<article><Rocket/><b>{number(data.todayOrders)} سفارش امروز</b><span>توسط فروشنده‌ها ثبت شده.</span></article>}</div></div></section>}
  <section className="creator-section calculator-section" id="calculator"><div className="creator-container"><SectionTitle eyebrow="عددش رو خودت ببین" title="فروشت چقدر می‌تونه درآمد بسازه؟" copy="این فقط سناریوی تخمینی است و تضمین درآمد نیست."/><IncomeCalculator/><CenteredCta/></div></section>
  <section className="creator-section creator-faq"><div className="creator-container"><SectionTitle eyebrow="بدون ترس شروع کن" title="جواب نگرانی‌های اصلی"/><div>{[["اگه نفروشم چی؟","هیچ هزینه ثبت‌نام، خرید موجودی یا حداقل سفارشی نداری؛ پس بدون فروش بدهکار نمی‌شی."],["چطور پول می‌گیرم؟","سود هر سفارش در پنل مالی ثبت می‌شه و طبق چرخه تسویه به حساب بانکی تأییدشده‌ات واریز می‌شه."],["چاپ و ارسال با کیه؟","چاپ، آماده‌سازی و ارسال در شبکه تأمین چاپلی انجام می‌شه؛ تو روی محصول، برند و فروش تمرکز می‌کنی."],["سرمایه اولیه می‌خواد؟","نه. محصول بعد از ثبت سفارش مشتری وارد تولید می‌شه."],["واقعاً رایگانه؟","ساخت حساب و فروشگاه، اضافه‌کردن محصول و شروع کار هزینه ثبت‌نام نداره."]].map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div></section>
  <section className="creator-final"><div className="creator-container"><span>بدون هزینه ثبت‌نام • بدون موجودی • بدون حداقل سفارش</span><h2>برند خودتو بدون سرمایه اولیه راه بنداز.</h2><SellerSignupTrigger className="creator-button light">رایگان شروع کن <ArrowLeft/></SellerSignupTrigger></div></section>
  <div className="seller-mobile-cta"><SellerSignupTrigger>رایگان شروع کن <ArrowLeft/></SellerSignupTrigger></div>
  <footer className="creator-footer"><div className="creator-container"><Link className="creator-logo" href="/seller"><span>چ</span>چاپلی</Link><p>ابزار ساخت و فروش برای آدم‌های خلاق.</p><div><Link href="/seller/login">ورود فروشنده</Link><Link href="/terms">قوانین</Link><Link href="/privacy">حریم خصوصی</Link></div></div></footer>
 </main>;
}

function SectionTitle({eyebrow,title,copy}:{eyebrow:string;title:string;copy?:string}){return <div className="creator-section-title"><span>{eyebrow}</span><h2>{title}</h2>{copy&&<p>{copy}</p>}</div>}
function CenteredCta(){return <div className="seller-centered-cta"><SellerSignupTrigger>فروشگاه خودتو رایگان بساز <ArrowLeft/></SellerSignupTrigger></div>}
