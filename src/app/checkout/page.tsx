"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  MapPin,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { useCart } from "@/components/cart-context";
import { formatPrice } from "@/lib/catalog";
import { ActionForm } from "@/components/action-form";
import { iranProvinces } from "@/lib/iran-address";
import { checkoutOrderAction, getBuyerWalletBalanceAction } from "@/app/actions/dashboard";

type Address = {
  recipientName: string;
  phone: string;
  postalCode: string;
  province: string;
  city: string;
  addressLine: string;
  deliveryNote: string;
};

const emptyAddress: Address = {
  recipientName: "",
  phone: "",
  postalCode: "",
  province: "",
  city: "",
  addressLine: "",
  deliveryNote: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, coupon, clear } = useCart();
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState(emptyAddress);
  const [addressReady, setAddressReady] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(true);
  const [pendingPayment, setPendingPayment] = useState<{ order: string; receipt: string } | null>(null);
  const idempotency = useMemo(() => crypto.randomUUID(), []);
  const update = (key: keyof Address, value: string) =>
    setAddress((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    getBuyerWalletBalanceAction().then(setWalletBalance).catch(() => setWalletBalance(0));
    try {
      const saved = window.localStorage.getItem("chaplly_pending_payment");
      if (saved) setPendingPayment(JSON.parse(saved));
      const savedAddress = window.localStorage.getItem("chaplly_checkout_address");
      if (savedAddress) setAddress({ ...emptyAddress, ...(JSON.parse(savedAddress) as Partial<Address>) });
    } catch {}
    setAddressReady(true);
  }, []);
  useEffect(() => {
    if (addressReady) window.localStorage.setItem("chaplly_checkout_address", JSON.stringify(address));
  }, [address, addressReady]);
  const discountedTotal = Math.max(0, total - (coupon?.discountAmount || 0));
  const payableTotal = useWallet ? Math.max(0, discountedTotal - walletBalance) : discountedTotal;
  const productSavings = items.reduce((sum, item) =>
    sum + Math.max(0, Number(item.compareAtPrice || 0) - item.price) * item.quantity, 0);

  if (!items.length)
    return (
      <main className="empty-cart">
        <div>
          <PackageCheck />
          <h1>سفارشی برای ثبت وجود ندارد</h1>
          {pendingPayment && (
            <a className="market-button primary" href={`/api/payments/zarinpal/recover?order=${encodeURIComponent(pendingPayment.order)}&receipt=${encodeURIComponent(pendingPayment.receipt)}`}>
              ادامه یا بررسی پرداخت سفارش {pendingPayment.order}
            </a>
          )}
          <Link className="market-button primary" href="/">
            بازگشت به فروشگاه
          </Link>
        </div>
      </main>
    );

  return (
    <main className="checkout-page">
      <div className="shop-container">
        {pendingPayment && (
          <div className="account-order-success" role="status">
            <CreditCard />
            <div>
              <b>یک پرداخت نیمه‌تمام دارید</b>
              <a href={`/api/payments/zarinpal/recover?order=${encodeURIComponent(pendingPayment.order)}&receipt=${encodeURIComponent(pendingPayment.receipt)}`}>
                ادامه یا بررسی سفارش {pendingPayment.order}
              </a>
            </div>
          </div>
        )}
        <div className="checkout-back">
          <Link href="/cart">
            <ChevronRight /> بازگشت به سبد خرید
          </Link>
          <span>
            <ShieldCheck /> ثبت امن اطلاعات
          </span>
          <Link className="checkout-auth-link" href="/account/login?next=/checkout">ورود / ثبت‌نام سریع</Link>
        </div>
        <ol className="checkout-steps">
          {["نشانی تحویل", "مرور سفارش", "پرداخت"].map(
            (label, index) => (
              <li className={step >= index + 1 ? "active" : ""} key={label}>
                <i>{step > index + 1 ? <Check /> : index + 1}</i>
                <span>{label}</span>
              </li>
            ),
          )}
        </ol>
        <div className="checkout-layout">
          <section className="checkout-card">
            {step === 1 && (
              <>
                <div className="checkout-heading">
                  <MapPin />
                  <div>
                    <h1>سفارش را کجا بفرستیم؟</h1>
                    <p>
                      بدون ورود هم می‌توانی خرید کنی. اگر وارد حساب باشی، این
                      نشانی به نشانی‌های حسابت اضافه می‌شود.
                    </p>
                  </div>
                </div>
                <form
                  className="checkout-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setStep(2);
                  }}
                >
                  <label>
                    <span>نام و نام خانوادگی *</span>
                    <input
                      required
                      minLength={2}
                      value={address.recipientName}
                      onChange={(event) =>
                        update("recipientName", event.target.value)
                      }
                    />
                  </label>
                  <div>
                    <label>
                      <span>شماره موبایل *</span>
                      <input
                        required
                        pattern="(?:09[0-9]{9}|989[0-9]{9}|\+989[0-9]{9})"
                        title="شماره باید با 09، 989 یا +989 شروع شود."
                        value={address.phone}
                        onChange={(event) => update("phone", event.target.value)}
                        inputMode="tel"
                      />
                    </label>
                    <label>
                      <span>کد پستی (اختیاری)</span>
                      <input
                        value={address.postalCode}
                        onChange={(event) =>
                          update("postalCode", event.target.value)
                        }
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        title="کد پستی باید دقیقاً ۱۰ رقم باشد."
                      />
                    </label>
                  </div>
                  <div>
                    <label>
                      <span>استان *</span>
                      <select
                        required
                        value={address.province}
                        onChange={(event) =>
                          update("province", event.target.value)
                        }
                      ><option value="">انتخاب استان</option>{iranProvinces.map((province) => <option value={province} key={province}>{province}</option>)}</select>
                    </label>
                    <label>
                      <span>شهر *</span>
                      <input
                        required
                        minLength={2}
                        value={address.city}
                        onChange={(event) => update("city", event.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    <span>نشانی کامل *</span>
                    <textarea
                      required
                      minLength={5}
                      value={address.addressLine}
                      onChange={(event) =>
                        update("addressLine", event.target.value)
                      }
                      rows={3}
                    />
                  </label>
                  <label>
                    <span>پلاک، واحد یا توضیح تحویل (اختیاری)</span>
                    <input
                      value={address.deliveryNote}
                      onChange={(event) =>
                        update("deliveryNote", event.target.value)
                      }
                    />
                  </label>
                  <button className="checkout-next">
                    ادامه به مرور سفارش <ArrowLeft />
                  </button>
                </form>
              </>
            )}

            {step === 2 && (
              <>
                <div className="checkout-heading">
                  <PackageCheck />
                  <div>
                    <h1>یک مرور نهایی</h1>
                    <p>کالاها و نشانی را بررسی کن، سپس وارد مرحله پرداخت شو.</p>
                  </div>
                </div>
                <div className="review-order">
                  {items.map((item) => (
                    <div key={item.variantId}>
                      <Image className="checkout-item-image" src={item.image} alt={item.title} width={58} height={58} />
                      <span>
                        <b>{item.title}</b>
                        <small>
                          {item.color} · {item.size} · تعداد{" "}
                          {item.quantity.toLocaleString("fa-IR")}
                        </small>
                      </span>
                      <strong>{item.compareAtPrice && item.compareAtPrice > item.price && <del>{formatPrice(item.compareAtPrice * item.quantity)}</del>}{formatPrice(item.price * item.quantity)}</strong>
                    </div>
                  ))}
                </div>
                <div className="checkout-address-review">
                  <MapPin />
                  <div>
                    <b>{address.recipientName}</b>
                    <p>{address.addressLine}</p>
                    <small>{address.phone}</small>
                  </div>
                  <button type="button" onClick={() => setStep(1)}>
                    ویرایش
                  </button>
                </div>
                <div className="checkout-shipping-note">
                  <b>روش ارسال: پس‌کرایه</b>
                  <p>به علت نوسان قیمت پست و تیپاکس، هزینه‌ی ارسال هنگام تحویل دریافت می‌شود.</p>
                </div>
                <button className="checkout-next" onClick={() => setStep(3)}>
                  ورود به پرداخت <ArrowLeft />
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <div className="checkout-heading">
                  <CreditCard />
                  <div>
                    <h1>پرداخت سفارش</h1>
                    <p>
                      پس از انتقال به زرین‌پال، سفارش فقط با تأیید نهایی درگاه پرداخت‌شده محسوب می‌شود.
                    </p>
                  </div>
                </div>
                <div className="payment-placeholder payment-ready">
                  <ShieldCheck />
                  <div>
                    <b>درگاه امن زرین‌پال</b>
                    <p>مبلغ قابل پرداخت: {formatPrice(payableTotal)}</p>
                  </div>
                </div>
                {walletBalance > 0 && (
                  <label className="checkout-wallet-choice">
                    <input type="checkbox" checked={useWallet} onChange={(event) => setUseWallet(event.target.checked)} />
                    <span>استفاده از موجودی کیف پول ({formatPrice(walletBalance)})</span>
                  </label>
                )}
                <ActionForm
                  action={checkoutOrderAction}
                  refreshAfterSuccess={false}
                  savingText="در حال پرداخت و ثبت سفارش…"
                  onSuccess={(result) => {
                    if (result.detail?.startsWith("http")) {
                      window.localStorage.setItem(
                        "chaplly_pending_payment",
                        JSON.stringify({ order: result.id, receipt: idempotency }),
                      );
                      window.location.assign(result.detail);
                      return;
                    } else {
                      clear();
                      window.localStorage.removeItem("chaplly_checkout_address");
                    }
                    router.push(result.detail || "/order-success");
                  }}
                >
                  <input
                    type="hidden"
                    name="items"
                    value={JSON.stringify(
                      items.map((item) => ({
                        variantId: item.variantId,
                        quantity: item.quantity,
                      })),
                    )}
                  />
                  {useWallet && <input type="hidden" name="useWallet" value="on" />}
                  <input
                    type="hidden"
                    name="idempotencyKey"
                    value={idempotency}
                  />
                  {coupon && <input type="hidden" name="couponCode" value={coupon.code} />}
                  {Object.entries(address).map(([key, value]) => (
                    <input type="hidden" name={key} value={value} key={key} />
                  ))}
                  <button className="checkout-next">
                    پرداخت و ثبت سفارش <ArrowLeft />
                  </button>
                </ActionForm>
              </>
            )}
          </section>
          <aside className="order-summary checkout-summary">
            <h2>سفارش شما</h2>
            <div className="checkout-summary-items">{items.map((item) => <article key={item.variantId}><Image src={item.image} alt={item.title} width={48} height={48} /><span><b>{item.title}</b><small>{item.color} · {item.size} · {item.quantity.toLocaleString("fa-IR")} عدد</small></span><strong>{item.compareAtPrice && item.compareAtPrice > item.price && <del>{formatPrice(item.compareAtPrice * item.quantity)}</del>}{formatPrice(item.price * item.quantity)}</strong></article>)}</div>
            <div>
              <span>
                {items
                  .reduce((sum, item) => sum + item.quantity, 0)
                  .toLocaleString("fa-IR")} کالا
              </span>
              <strong>{formatPrice(total)}</strong>
            </div>
            {productSavings > 0 && <div className="checkout-savings"><span>سود شما از این خرید</span><strong>{formatPrice(productSavings)}</strong></div>}
            {coupon && <div><span>تخفیف کد {coupon.code}</span><strong>-{formatPrice(coupon.discountAmount)}</strong></div>}
            <div>
              <span>ارسال</span>
              <strong>پس‌کرایه</strong>
            </div>
            <div className="summary-total">
              <span>مبلغ نهایی</span>
              <strong>{formatPrice(payableTotal)}</strong>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
