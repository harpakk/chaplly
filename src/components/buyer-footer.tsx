"use client";

import Link from "next/link";
import { Instagram, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import { TrustLogos } from "@/components/trust-logos";
import { BrandLogo } from "@/components/brand-logo";

export function BuyerFooter({ graphicStyles = [] }: { graphicStyles?: { slug: string; name: string }[] }) {
  const pathname = usePathname();
  if (pathname.startsWith("/seller") || pathname.startsWith("/supplier") || pathname.startsWith("/admin") || pathname.startsWith("/stores/")) return null;
  return (
    <footer className="buyer-footer">
      <div className="shop-container footer-story"><div><BrandLogo className="buyer-logo light" href="/" /><p>چاپلی بازار آنلاین خرید محصولات خاص، بامزه و اوریجینال از طراح‌ها، هنرمندان و فروشگاه‌های مستقل ایرانی است. در چاپلی می‌توانی میان تیشرت‌های گرافیکی، پوشاک متفاوت، اکسسوری، هدیه و محصولات خلاقانه جست‌وجو کنی، رنگ و اندازه مناسب را انتخاب کنی و محصولی هماهنگ با سلیقه و سبک شخصی خودت سفارش بدهی. هر فروشگاه ویترین اختصاصی خودش را دارد و اطلاعات محصول، قیمت، تنوع‌ها و وضعیت سفارش به‌صورت شفاف نمایش داده می‌شود تا کشف و خرید طراحی ایرانی ساده‌تر، مطمئن‌تر و لذت‌بخش‌تر باشد.</p></div><form><label htmlFor="footer-email">تازه‌ترین دراپ‌ها، بدون اسپم</label><div><input id="footer-email" type="email" placeholder="ایمیلت را بنویس" /><button aria-label="عضویت"><Send size={18} /></button></div></form></div>
      <div className="shop-container footer-grid seo-footer">
        <div><strong>دسته‌بندی‌های محبوب</strong><Link href="/search?q=پوشاک">پوشاک خاص</Link><Link href="/search?q=تیشرت">تیشرت گرافیکی</Link><Link href="/search?q=هودی">دورس و هودی</Link><Link href="/search?q=اکسسوری">اکسسوری</Link><Link href="/search?q=خانه">خانه و زندگی</Link></div>
        <div><strong>سبک‌های گرافیکی</strong>{graphicStyles.map((style) => <Link href={`/search?graphic=${encodeURIComponent(style.slug)}`} key={style.slug}>{style.name}</Link>)}</div>
        <div><strong>خرید و سفارش</strong><Link href="/search">همه محصولات</Link><Link href="/account/saved">علاقه‌مندی‌ها</Link><Link href="/account/orders">سفارش‌ها و پیگیری</Link><Link href="/cart">سبد خرید</Link></div>
        <div><strong>راهنمای چاپلی</strong><Link href="/support">روش‌های ارسال و پشتیبانی</Link><Link href="/terms#returns">۷ روز ضمانت بازگشت</Link><Link href="/terms#quality">تضمین کیفیت</Link><Link href="/support#faq">سؤالات متداول</Link><Link href="/support">تماس با پشتیبانی</Link></div>
        <div><strong>همکاری با ما</strong><Link href="/seller">فروشنده شو</Link><Link href="/seller/login">ورود فروشنده</Link><Link href="/search">فروشگاه‌ها و محصولات</Link><Link href="/support">درباره چاپلی</Link></div>
        <div><strong>قوانین و اعتماد</strong><Link href="/terms">قوانین و شرایط استفاده</Link><Link href="/privacy">حریم خصوصی</Link><Link href="/terms#returns">قوانین بازگشت</Link><Link href="/terms#intellectual-property">حقوق مالکیت فکری</Link></div>
      </div>
      <div className="shop-container footer-trust"><TrustLogos /></div>
      <div className="shop-container footer-bottom"><span>© ۱۴۰۵ چاپلی — chaplly.ir، ساخته‌شده برای سلیقه‌های غیرتکراری.</span><div><Link href="/support" aria-label="ارتباط با چاپلی"><Instagram /></Link><Link href="/support" aria-label="پشتیبانی چاپلی"><Send /></Link></div></div>
    </footer>
  );
}
