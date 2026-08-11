import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, Building2, CircleCheck, CreditCard, Globe2, Instagram, Palette, Rocket, Sparkles, Store, WalletCards, Zap } from "lucide-react";
import { IncomeCalculator } from "@/components/income-calculator";

const steps = [
  {title:"رایگان ثبت‌نام می‌کنی",copy:"در چند دقیقه حساب و فروشگاهت را می‌سازی؛ بدون کارت بانکی، بدون هزینه راه‌اندازی و بدون اینکه لازم باشد از قبل محصولی بخری.",gif:"/media/seller-how/signup.gif",source:"https://commons.wikimedia.org/wiki/File:Computer_Flat_Icon_GIF_Animation.gif",credit:"Computer Flat Icon — Videoplasty.com / Wikimedia Commons / CC BY-SA 4.0"},
  {title:"طراحی می‌کنی",copy:"فایل خودت را آپلود کن، متن و رنگ اضافه کن و با ابزار طراحی چاپلی جای دقیق طرح را روی ناحیه چاپ تنظیم کن.",gif:"/media/seller-how/design.gif",source:"https://commons.wikimedia.org/wiki/File:Graphic_Tablet_Flat_Icon_GIF_Animation.gif",credit:"Graphic Tablet Flat Icon — Videoplasty.com / Wikimedia Commons / CC BY-SA 4.0"},
  {title:"طرحت را روی محصول می‌اندازی",copy:"محصول خام، رنگ و سایزها را انتخاب کن و موکاپی بساز که مشتری قبل از خرید دقیقاً حس محصول نهایی را ببیند.",gif:"/media/seller-how/product.gif",source:"https://commons.wikimedia.org/wiki/File:Shopping_Bag_Flat_Icon_GIF_Animation.gif",credit:"Shopping Bag Flat Icon — Videoplasty.com / Wikimedia Commons / CC BY-SA 4.0"},
  {title:"می‌فروشی و به درآمد می‌رسی",copy:"لینک فروشگاهت را منتشر کن؛ سفارش، تولید، وضعیت ارسال و درآمدت از همان لحظه داخل پنل قابل پیگیری است.",gif:"/media/seller-how/income.gif",source:"https://commons.wikimedia.org/wiki/File:Money_Flat_Icon_GIF_Animation.gif",credit:"Money Flat Icon — Videoplasty.com / Wikimedia Commons / CC BY-SA 4.0"},
] as const;

const audiences = [
  [Instagram, "اینفلوئنسرها", "پیج داری و مخاطبت هر روز می‌پرسه «از کجا خریدی؟» این‌بار محصول خودت رو معرفی کن و آنلاین‌شاپت رو بزن."],
  [Store, "هرکی می‌خواد آنلاین‌شاپ بزنه", "بدون خرید عمده و خواب سرمایه، ایده‌ت رو تبدیل به یک فروشگاه واقعی کن."],
  [Building2, "برندها و شرکت‌ها", "مرچ تیم، کمپین یا هدیه سازمانی رو سریع‌تر و بدون دردسر انبار اجرا کن."],
  [Palette, "گرافیست‌ها و طراح‌ها", "طرحت فقط توی فولدر نمونه‌کار نمونه؛ بذارش روی محصول و از هر فروش سهم بگیر."],
] as const;

const benefits = [
  [WalletCards, "بدون نیاز به سرمایه اولیه", "اول می‌فروشی، بعد سفارش وارد مسیر تولید می‌شه."],
  [CreditCard, "درگاه پرداخت آماده", "مشتری مستقیم و امن از فروشگاه تو خرید می‌کنه."],
  [Globe2, "سایت شخصی برای تو", "زیردامنه رایگان یا اتصال دامنه اختصاصی خودت."],
  [Zap, "سریع و آسان", "از ایده تا لینک فروش، بدون درگیری فنی اضافه."],
  [BadgeDollarSign, "بدون محدودیت درآمد", "هرچقدر بیشتر بفروشی، مسیر رشدت بازتره."],
] as const;

export default function SellerLandingPage() {
  return (
    <main className="creator-landing">
      <header className="creator-header"><div className="creator-container"><Link className="creator-logo" href="/seller"><span>چ</span>چاپلی <small>برای سازنده‌ها</small></Link><nav><a href="#how">چطور کار می‌کنه؟</a><a href="#benefits">چی گیرم میاد؟</a><a href="#calculator">حساب درآمد</a><a href="#for-who">برای کیه؟</a></nav><div><Link className="creator-login" href="/seller/login">ورود</Link><Link className="creator-button small" href="/seller/register">رایگان شروع کن <ArrowLeft /></Link></div></div></header>
      <section className="creator-hero"><div className="creator-blob one"/><div className="creator-blob two"/><div className="creator-container creator-hero-grid"><div><span className="creator-kicker"><Sparkles /> ایده‌ت می‌تونه درآمدت باشه</span><h1>درآمد چند صد میلیونی<br/><em>بدون سرمایه اولیه</em></h1><p>طرحت رو تبدیل به محصول کن، فروشگاه خودت رو بساز و لینکش رو برای مخاطبت بفرست. لازم نیست اول جنس بخری، انبار کنی یا درگیر ساخت سایت و درگاه بشی.</p><div className="creator-actions"><Link className="creator-button" href="/seller/register">فروشگاهت رو رایگان بساز <ArrowLeft /></Link><a className="creator-button ghost" href="#calculator">اول درآمدمو حساب کنم</a></div><div className="creator-reassure"><span><CircleCheck/> شروع کاملاً رایگان</span><span><CircleCheck/> درگاه آماده</span><span><CircleCheck/> فروشگاه شخصی</span></div></div><div className="money-visual"><div className="money-window"><header><span/><b>درآمد این ماه</b><i>•••</i></header><strong>۲۴۸٬۵۰۰٬۰۰۰ <small>تومان</small></strong><p><b>+۳۲٪</b> نسبت به ماه قبل</p><div className="money-chart"><i/><i/><i/><i/><i/><i/><i/></div><footer><span><small>سفارش‌ها</small><b>۲۶۳</b></span><span><small>محصول پرفروش</small><b>تیشرت موج</b></span></footer></div><div className="money-float sale">+ یک فروش جدید 🎉</div><div className="money-float payout">واریزی بعدی<br/><b>شنبه</b></div></div></div></section>
      <section className="money-strip"><div className="creator-container"><span><b>۰ تومان</b> هزینه شروع</span><span><b>۱۰۰٪</b> فروشگاه خودت</span><span><b>۲ دقیقه</b> تا ساخت حساب</span><span><b>∞</b> سقف درآمد</span></div></section>
      <section className="creator-section" id="how"><div className="creator-container"><SectionTitle eyebrow="واقعاً همین‌قدر ساده" title="چهار قدم تا اولین فروش" copy="تو ایده و مخاطب رو میاری؛ ابزار فروش از قبل آماده‌ست."/><div className="how-grid">{steps.map((step,index)=><article key={step.title}><div className="how-gif icon-gif"><Image src={step.gif} alt={`نمای متحرک مرحله ${step.title}`} fill unoptimized sizes="(max-width: 700px) 100vw, 52vw"/><a href={step.source} target="_blank" rel="noreferrer">GIF: {step.credit}</a></div><div className="how-copy"><i>۰{index+1}</i><div><span>مرحله {index+1}</span><h3>{step.title}</h3><p>{step.copy}</p></div></div></article>)}</div></div></section>
      <CtaStrip title="ایده‌ت برای پول‌ساز شدن، فقط یه فروشگاه کم داره." button="همین الان فروشگاه بساز" />
      <section className="creator-section benefit-section" id="benefits"><div className="creator-container"><SectionTitle eyebrow="کمتر خرج کن، بیشتر بساز" title="همه‌چی آماده‌ست؛ فقط شروع کن" copy="از زیرساخت فروش تا ویترین شخصی، لازم نیست چرخ رو دوباره اختراع کنی."/><div className="benefit-grid">{benefits.map(([Icon,title,copy])=><article key={title}><span><Icon/></span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>
      <section className="creator-section audience-section" id="for-who"><div className="creator-container"><SectionTitle eyebrow="اگه ایده داری، جای درستی اومدی" title="چاپلی برای کیه؟"/><div className="audience-grid">{audiences.map(([Icon,title,copy],index)=><article key={title}><div><Icon/><small>۰{index+1}</small></div><h3>{title}</h3><p>{copy}</p><Link href="/seller/register">این دقیقاً منم <ArrowLeft/></Link></article>)}</div></div></section>
      <section className="creator-section calculator-section" id="calculator"><div className="creator-container"><SectionTitle eyebrow="عددش رو خودت ببین" title="پیج یا فروشت چقدر می‌تونه پول بسازه؟" copy="سناریوت رو با اسلایدرها بساز. عدد خروجی فروش کل تخمینیه، نه قول درآمد یا سود."/><IncomeCalculator/><div className="calc-cta"><div><b>عددش هیجان‌انگیز شد؟</b><span>قدم بعدی ساخت فروشگاهته؛ رایگان و بدون تعهد.</span></div><Link className="creator-button" href="/seller/register">بزن بریم <Rocket/></Link></div></div></section>
      <section className="creator-section creator-faq"><div className="creator-container"><SectionTitle eyebrow="سؤال‌های قبل از شروع" title="چیزهایی که احتمالاً توی ذهنت هست"/><div>{[["واقعاً شروعش رایگانه؟","آره. برای ساخت حساب و فروشگاه اولیه پولی نمی‌دی."],["درگاه پرداخت چی؟","آماده‌ست؛ لازم نیست برای شروع درگیر اتصال فنی بشی."],["می‌تونم دامنه خودمو وصل کنم؟","بله؛ اول با زیردامنه شروع کن و بعد دامنه اختصاصی رو وصل کن."],["تولید و ارسال با کیه؟","تو روی طرح، برند و فروش تمرکز می‌کنی؛ مسیر تولید و ارسال در چاپلی مدیریت می‌شه."],["درآمد تضمینیه؟","نه. ماشین‌حساب یک سناریوی تخمینیه و نتیجه واقعی به محصول، قیمت، مخاطب و معرفی تو بستگی داره."]].map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div></section>
      <section className="creator-final"><div className="creator-container"><span>وقتشه طرحت از گالری گوشیت پول بسازه.</span><h2>فروشگاهت رو امروز بساز؛<br/>اولین فروش شاید نزدیک‌تر از چیزیه که فکر می‌کنی.</h2><Link className="creator-button light" href="/seller/register">رایگان شروع کن <ArrowLeft/></Link></div></section>
      <footer className="creator-footer"><div className="creator-container"><Link className="creator-logo" href="/seller"><span>چ</span>چاپلی</Link><p>ابزار ساخت و فروش برای آدم‌های خلاق.</p><div><Link href="/seller/login">ورود فروشنده</Link><Link href="/terms">قوانین</Link><Link href="/privacy">حریم خصوصی</Link><Link href="/support">پشتیبانی</Link></div></div></footer>
    </main>
  );
}

function SectionTitle({eyebrow,title,copy}:{eyebrow:string;title:string;copy?:string}){return <div className="creator-section-title"><span>{eyebrow}</span><h2>{title}</h2>{copy&&<p>{copy}</p>}</div>}
function CtaStrip({title,button}:{title:string;button:string}){return <section className="creator-cta-strip"><div className="creator-container"><h2>{title}</h2><Link className="creator-button light" href="/seller/register">{button}<ArrowLeft/></Link></div></section>}
