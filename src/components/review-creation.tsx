"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { submitProductReviewAction } from "@/app/actions/dashboard";

type Opportunity = {
  orderItemId: string;
  productId: string;
  orderNumber: string;
  title: string;
  slug: string;
  image: string;
};

export function ReviewCreation({ items }: { items: Opportunity[] }) {
  const params = useSearchParams();
  const requestedOrder = params.get("order");
  const direct = params.get("review") === "1" && Boolean(requestedOrder);
  const orderedItems = requestedOrder
    ? [...items].sort((a, b) => Number(b.orderNumber === requestedOrder) - Number(a.orderNumber === requestedOrder))
    : items;
  if (!items.length) return null;
  return (
    <section className={`review-opportunities ${direct ? "review-direct-mode" : ""}`}>
      <header>
        <span>یادآوری دیدگاه</span>
        <h2>خریدت چطور بود؟</h2>
        <p>
          از تکمیل سفارش حداقل ۷ روز گذشته؛ تجربه واقعی تو به انتخاب دیگران کمک
          می‌کند.
        </p>
      </header>
      {orderedItems.map((item, index) => (
        <div id={`review-${item.orderItemId}`} className={requestedOrder === item.orderNumber && index === 0 ? "review-direct-target" : direct ? "review-direct-hidden" : ""} key={item.orderItemId}>
        <ActionForm action={submitProductReviewAction} className="review-create-form">
          <input type="hidden" name="orderItemId" value={item.orderItemId} />
          <div className="review-product-summary">
            <Image src={item.image} alt={item.title} width={90} height={90} />
            <div>
              <small>سفارش {item.orderNumber}</small>
              <Link href={`/products/${item.slug}`}>{item.title}</Link>
            </div>
          </div>
          <fieldset className="review-stars">
            <legend>امتیاز شما ـ الزامی</legend>
            {[5, 4, 3, 2, 1].map((star) => (
              <label key={star}>
                <input type="radio" name="rating" value={star} required />
                <Star fill="currentColor" />
              </label>
            ))}
          </fieldset>
          <div className="review-fields">
            <label>
              عنوان کوتاه
              <input name="title" maxLength={100} placeholder="اختیاری" />
            </label>
            <label className="wide">
              متن دیدگاه
              <textarea
                name="body"
                maxLength={2000}
                placeholder="اختیاری؛ تجربه‌ات را بنویس"
              />
            </label>
            <label>
              نکات مثبت
              <textarea name="pros" placeholder="هر مورد در یک خط" />
            </label>
            <label>
              نکات منفی
              <textarea name="cons" placeholder="هر مورد در یک خط" />
            </label>
            <label className="review-photo">
              <Camera /> افزودن تصویر
              <input name="photos" type="file" accept="image/*" multiple />
            </label>
            <label className="review-anonymous">
              <input name="anonymous" type="checkbox" /> نمایش به‌صورت ناشناس
            </label>
          </div>
          <button className="review-submit">ارسال برای بررسی</button>
        </ActionForm>
        </div>
      ))}
    </section>
  );
}
