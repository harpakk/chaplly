"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-context";
import { formatPrice } from "@/lib/catalog";
import { getBuyerWalletBalanceAction } from "@/app/actions/dashboard";
import { TrustLogos } from "@/components/trust-logos";

export default function CartPage() {
  const { items, total, coupon, setCoupon, updateQuantity, removeItem } = useCart();
  const [walletBalance, setWalletBalance] = useState(0);
  const [couponCode, setCouponCode] = useState(coupon?.code || "");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  useEffect(() => {
    getBuyerWalletBalanceAction().then(setWalletBalance).catch(() => setWalletBalance(0));
  }, []);
  useEffect(() => {
    if (coupon) setCouponCode(coupon.code);
  }, [coupon]);
  const discountedTotal = Math.max(0, total - (coupon?.discountAmount || 0));
  const applyCoupon = async () => {
    setCouponBusy(true);
    setCouponMessage("");
    try {
      const response = await fetch("/api/coupons/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: couponCode, items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })) }),
      });
      const result = (await response.json()) as { code?: string; discountAmount?: number; message?: string };
      if (!response.ok || !result.code || !result.discountAmount) throw new Error(result.message || "کد تخفیف معتبر نیست.");
      setCoupon({ code: result.code, discountAmount: Number(result.discountAmount) });
      setCouponMessage("کد تخفیف با موفقیت اعمال شد.");
    } catch (error) {
      setCoupon(null);
      setCouponMessage(error instanceof Error ? error.message : "بررسی کد تخفیف انجام نشد.");
    } finally {
      setCouponBusy(false);
    }
  };

  if (!items.length) {
    return <main className="empty-cart"><div><ShoppingBag size={40} /><h1>سبد خریدت هنوز خالیه</h1><p>بین انتخاب‌های خاص چاپلی بگرد و چیزی که دوست داری را پیدا کن.</p><Link className="market-button primary" href="/#products">مشاهده محصولات <ArrowLeft /></Link></div></main>;
  }

  return (
    <main className="cart-page">
      <div className="shop-container">
        <div className="flow-title"><span>سبد خرید</span><h1>انتخاب‌های تو</h1><p>{items.length.toLocaleString("fa-IR")} محصول آماده ثبت سفارش است.</p></div>
        <div className="cart-layout">
          <section className="cart-items">
            {items.map((item, index) => (
              <article className="cart-item" key={`${item.productId}-${item.color}-${item.size}`}>
                <Link className="cart-image" href={`/products/${item.slug}`}><Image src={item.image} alt={item.title} fill sizes="140px" /></Link>
                <div className="cart-item-copy"><Link href={`/products/${item.slug}`}><h2>{item.title}</h2></Link><p>رنگ: <b>{item.color}</b> · اندازه: <b>{item.size}</b></p><strong>{formatPrice(item.price)}</strong><div className="quantity-control"><button onClick={() => updateQuantity(index, item.quantity + 1)} aria-label="افزایش تعداد"><Plus size={16} /></button><span>{item.quantity.toLocaleString("fa-IR")}</span><button onClick={() => updateQuantity(index, item.quantity - 1)} aria-label="کاهش تعداد"><Minus size={16} /></button></div></div>
                <button className="remove-item" onClick={() => removeItem(index)} aria-label={`حذف ${item.title}`}><Trash2 size={18} /></button>
              </article>
            ))}
          </section>
          <aside className="order-summary">
            <h2>خلاصه سفارش</h2>
            <div><span>جمع کالاها</span><strong>{formatPrice(total)}</strong></div>
            <div><span>روش ارسال</span><strong>پس‌کرایه</strong></div>
            <div className="cart-coupon"><input aria-label="کد تخفیف" inputMode="numeric" maxLength={6} pattern="[0-9]{1,6}" placeholder="کد تخفیف" value={couponCode} onChange={(event) => setCouponCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /><button type="button" disabled={couponBusy || !couponCode} onClick={applyCoupon}>{couponBusy ? "در حال بررسی…" : "اعمال"}</button></div>
            {couponMessage && <p className="coupon-message">{couponMessage}</p>}
            {coupon && <div><span>تخفیف کد {coupon.code}</span><strong>-{formatPrice(coupon.discountAmount)}</strong></div>}
            <p className="free-shipping-note">به علت نوسان قیمت پست و تیپاکس، هزینه‌ی ارسال هنگام تحویل دریافت می‌شود.</p>
            {walletBalance > 0 && <div><span>قابل پرداخت از کیف پول</span><strong>{formatPrice(Math.min(discountedTotal, walletBalance))}</strong></div>}
            <div className="summary-total"><span>{walletBalance > 0 ? "مبلغ پس از کیف پول" : "مبلغ قابل پرداخت"}</span><strong>{formatPrice(Math.max(0, discountedTotal - walletBalance))}</strong></div>
            <Link className="checkout-button" href="/checkout">ادامه و ثبت اطلاعات <ArrowLeft size={19} /></Link>
            <span className="safe-checkout"><ShieldCheck size={16} /> خرید امن و تضمین‌شده با چاپلی</span>
            <TrustLogos />
          </aside>
        </div>
      </div>
    </main>
  );
}
