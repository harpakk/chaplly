import Link from "next/link";
import { ArrowLeft, Heart, Package, Sparkles, Star } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { ProductCard } from "@/components/product-card";
import { requireBuyer } from "@/lib/auth";
import { getBuyerAccountData } from "@/lib/dashboard-data";

export default async function AccountPage() {
  const user = await requireBuyer();
  const data = await getBuyerAccountData(user.id);
  const name =
    [data.profile.first_name, data.profile.last_name]
      .filter(Boolean)
      .join(" ") || "دوست چاپلی";
  const active = data.orders.find(
    (order) => !["DONE", "CANCELLED", "RETURNED"].includes(order.status),
  );
  return (
    <AccountShell active="/account" name={name}>
      <div className="account-heading">
        <span>داشبورد من</span>
        <h1>سلام {data.profile.first_name || ""}، چه خبر؟</h1>
        <p>اول وضعیت سفارشت، بعد کمی چیز قشنگ برای دیدن.</p>
      </div>
      {data.reviewOpportunities.length > 0 && (
        <Link className="review-reminder-card" href="/account/reviews">
          <Star fill="currentColor" />
          <div><b>{data.reviewOpportunities.length.toLocaleString("fa-IR")} محصول منتظر دیدگاه توست</b><span>امتیاز بده و تجربه خریدت را با دیگران به اشتراک بگذار.</span></div>
          <ArrowLeft />
        </Link>
      )}
      {active ? (
        <Link className="active-order-card" href={`/orders/${active.number}`}>
          <Package />
          <div>
            <small>سفارش {active.number}</small>
            <h2>سفارشت در جریان است</h2>
            <p>وضعیت فعلی: {active.status}</p>
            <i>
              <b />
            </i>
          </div>
          <ArrowLeft />
        </Link>
      ) : (
        <div className="empty-state">
          <Package />
          <h2>سفارش فعالی نداری</h2>
          <p>یک چیز اورجینال پیدا کن و اینجا روندش را ببین.</p>
        </div>
      )}
      <div className="account-stats">
        <Link href="/account/orders">
          <Package />
          <b>{data.orders.length}</b>
          <span>سفارش</span>
        </Link>
        <Link href="/account/recent">
          <Sparkles />
          <b>{data.recent.length}</b>
          <span>دیده‌شده اخیر</span>
        </Link>
      </div>
      <div className="account-section-title">
        <h2><Heart /> محصول‌هایی که پسندیدی</h2>
        <Link href="/search">
          بیشتر <ArrowLeft />
        </Link>
      </div>
      {data.wishlist.length ? (
        <div className="product-grid account-products">
          {data.wishlist.map((product) => (
            <ProductCard product={product} liked key={product.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">هنوز محصولی را نپسندیده‌ای.</div>
      )}
    </AccountShell>
  );
}
