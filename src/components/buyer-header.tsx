"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useCart } from "@/components/cart-context";
import { BrandLogo } from "@/components/brand-logo";
import { formatPrice } from "@/lib/catalog";
import { ResilientImage } from "@/components/resilient-image";

export function BuyerHeader() {
  const pathname = usePathname();
  const { count, items, total } = useCart();
  const [menuOpen,setMenuOpen]=useState(false);
  useEffect(()=>setMenuOpen(false),[pathname]);
  if (pathname.startsWith("/seller") || pathname.startsWith("/supplier") || pathname.startsWith("/admin") || pathname.startsWith("/stores/")) return null;

  return (
    <>
      <div className="topbar">ارسال رایگان برای سفارش‌های بالای ۱٬۵۰۰٬۰۰۰ تومان</div>
      <header className="buyer-header">
        <div className="shop-container buyer-header-row">
          <BrandLogo className="buyer-logo" href="/" priority />
          <nav className="buyer-nav" aria-label="منوی اصلی">
            <Link href="/search">محصولات</Link>
            <Link href="/#categories">دسته‌بندی‌ها</Link>
            <Link href="/#graphics">سبک‌های گرافیک</Link>
            <Link href="/#shops">فروشگاه‌ها</Link>
            <Link className="seller-link" href="/seller">فروشنده شو</Link>
          </nav>
          <div className="buyer-actions">
            <Link className="seller-login-shortcut" href="/seller/login">ورود فروشنده</Link>
            <Link href="/search" aria-label="جست‌وجو"><Search size={21} /></Link>
            <Link className="desktop-action" href="/account/saved" aria-label="علاقه‌مندی‌ها"><Heart size={21} /></Link>
            <Link className="desktop-action" href="/account" aria-label="حساب کاربری"><UserRound size={21} /></Link>
            <div className="cart-menu-wrap">
              <Link className="cart-action" href="/cart" aria-label={`سبد خرید، ${count} کالا`}>
                <ShoppingBag size={22} />
                {count > 0 && <b>{count.toLocaleString("fa-IR")}</b>}
              </Link>
              {items.length > 0 && <aside className="cart-hover-preview">
                <strong>{count.toLocaleString("fa-IR")} کالا در سبد</strong>
                {items.slice(0,3).map((item)=><Link href={`/products/${item.slug}`} key={item.variantId}><ResilientImage src={item.image} alt="" width={44} height={44}/><span>{item.title}<small>{item.color} · {item.size} · {item.quantity.toLocaleString("fa-IR")}</small></span></Link>)}
                {items.length>3&&<small>و {(items.length-3).toLocaleString("fa-IR")} مورد دیگر</small>}
                <div><b>{formatPrice(total)}</b><Link href="/cart">مشاهده و ادامه خرید</Link></div>
              </aside>}
            </div>
            <button className="mobile-menu" aria-expanded={menuOpen} aria-controls="buyer-mobile-nav" aria-label={menuOpen?"بستن منو":"باز کردن منو"} onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X size={22}/>:<Menu size={22}/>}</button>
          </div>
        </div>
        {menuOpen&&<><button className="buyer-mobile-backdrop" aria-label="بستن منو" onClick={()=>setMenuOpen(false)}/><nav className="buyer-mobile-nav" id="buyer-mobile-nav">
          <Link href="/search">همه محصولات</Link><Link href="/#categories">دسته‌بندی‌ها</Link><Link href="/#graphics">سبک‌های گرافیکی</Link><Link href="/#shops">فروشگاه‌ها</Link>
          <div><Link href="/account"><UserRound/> حساب من</Link><Link href="/account/saved"><Heart/> ذخیره‌شده‌ها</Link></div>
          <Link className="seller-entry" href="/seller">فروشنده شو</Link><Link href="/seller/login">ورود فروشنده</Link>
        </nav></>}
      </header>
    </>
  );
}
