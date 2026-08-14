"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { formatPrice } from "@/lib/catalog";
import type { CouponManagementData } from "@/lib/coupon-data";
import type { ActionResult } from "@/app/actions/dashboard";

export function CouponManager({ data, seller, createAction, toggleAction }: {
  data: CouponManagementData;
  seller: boolean;
  createAction: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  toggleAction: (state: ActionResult, data: FormData) => Promise<ActionResult>;
}) {
  const [code, setCode] = useState("");
  const [allStores, setAllStores] = useState(!seller);
  const generate = () => setCode(String(Math.floor(100000 + Math.random() * 900000)));
  return <div className="coupon-manager">
    <section className="coupon-create-card">
      <h2>ساخت کد تخفیف</h2>
      <ActionForm action={createAction} className="coupon-form" savingText="در حال ساخت کد تخفیف…">
        <label><span>کد عددی (حداکثر ۶ رقم)</span><div className="coupon-code-row"><input name="code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} pattern="[0-9]{1,6}" placeholder="خالی بگذارید تا خودکار ساخته شود" /><button type="button" onClick={generate}>ساخت خودکار</button></div></label>
        <div className="coupon-grid">
          <label><span>نوع تخفیف</span><select name="discountType" required><option value="PERCENTAGE">درصدی</option><option value="FIXED_RIAL">مبلغ ثابت ریالی</option></select></label>
          <label><span>مقدار تخفیف</span><input name="discountValue" type="number" min={1} required /><small>{seller ? "حداکثر ۱۰٪ یا ۱٬۰۰۰٬۰۰۰ ریال" : "برای درصد، حداکثر ۱۰۰"}</small></label>
          <label><span>اثر روی</span><select name="appliesTo" required><option value="BASKET">کل سبد واجد شرایط</option><option value="ITEM">یک قلم واجد شرایط</option></select></label>
          <label><span>حداکثر دفعات استفاده</span><input name="maxUsage" type="number" min={1} required /></label>
          <label><span>تاریخ و ساعت انقضا</span><input name="expiresAt" type="datetime-local" required /></label>
        </div>
        <fieldset><legend>نوع محصول</legend><p>اگر چیزی انتخاب نشود، همه نوع‌های محصول مجازند.</p><div className="coupon-checks">{data.categories.map((category) => <label key={category.id}><input type="checkbox" name="categoryIds" value={category.id} />{category.name}</label>)}</div></fieldset>
        {!seller && <fieldset><legend>فروشگاه‌ها</legend><label><input type="checkbox" name="allStores" checked={allStores} onChange={(event) => setAllStores(event.target.checked)} /> همه فروشگاه‌ها</label>{!allStores && <div className="coupon-checks">{data.stores.map((store) => <label key={store.id}><input type="checkbox" name="storeIds" value={store.id} />{store.name}</label>)}</div>}</fieldset>}
        {seller && <p className="coupon-seller-note">این کد فقط برای فروشگاه خودتان قابل استفاده خواهد بود.</p>}
        <button className="sd-primary">ساخت و ذخیره کد</button>
      </ActionForm>
    </section>
    <section className="coupon-list-card"><h2>کدهای ساخته‌شده</h2>{data.coupons.length ? <div className="coupon-table">{data.coupons.map((coupon) => <article key={coupon.id}>
      <div><b>{coupon.code}</b><span>{coupon.discount_type === "PERCENTAGE" ? `${coupon.discount_value.toLocaleString("fa-IR")}٪` : formatPrice(coupon.discount_value)}</span></div>
      <small>{coupon.applies_to === "ITEM" ? "یک قلم" : "سبد"} · استفاده {coupon.usage_count.toLocaleString("fa-IR")} از {coupon.max_usage.toLocaleString("fa-IR")} · انقضا {new Date(coupon.expires_at).toLocaleString("fa-IR")}</small>
      <ActionForm action={toggleAction} showSavingOverlay={false}><input type="hidden" name="couponId" value={coupon.id} /><input type="hidden" name="status" value={coupon.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} /><button className={coupon.status === "ACTIVE" ? "coupon-disable" : "coupon-enable"}>{coupon.status === "ACTIVE" ? "غیرفعال کردن" : "فعال کردن"}</button></ActionForm>
    </article>)}</div> : <p>هنوز کد تخفیفی ساخته نشده است.</p>}</section>
  </div>;
}
