import Image from "next/image";
import { Check, Star, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { moderateReviewAction } from "@/app/actions/dashboard";
import type { getAdminReviewData } from "@/lib/dashboard-data";

type Data = Awaited<ReturnType<typeof getAdminReviewData>>;
const one = <T,>(value: T | T[] | null | undefined) =>
  Array.isArray(value) ? value[0] : value;

export function AdminReviewConsole({ data }: { data: Data }) {
  return (
    <div className="admin-page">
      <div className="admin-page-title">
        <div>
          <span>کنترل محتوای خریداران</span>
          <h1>بررسی دیدگاه‌ها</h1>
        </div>
      </div>
      <section className="admin-review-list">
        {data.map((review) => {
          const buyer = one(review.buyer),
            product = one(review.seller_products);
          return (
            <article key={review.id}>
              <header>
                <div>
                  <span>{"★".repeat(review.rating)}</span>
                  <h2>
                    {review.title || product?.title || "دیدگاه بدون عنوان"}
                  </h2>
                  <small>
                    {review.is_anonymous
                      ? "نمایش ناشناس"
                      : `${buyer?.first_name || ""} ${buyer?.last_name || ""}`}{" "}
                    ·{" "}
                    {review.is_verified_purchase
                      ? "خرید تأییدشده"
                      : "خرید تأییدنشده"}
                  </small>
                </div>
                <Star fill="currentColor" />
              </header>
              {review.body && <p>{review.body}</p>}
              {(review.pros.length > 0 || review.cons.length > 0) && (
                <div className="admin-review-points">
                  <ul>
                    {review.pros.map((item) => (
                      <li key={item}>+ {item}</li>
                    ))}
                  </ul>
                  <ul>
                    {review.cons.map((item) => (
                      <li key={item}>− {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {review.images.length > 0 && (
                <div className="admin-review-images">
                  {review.images.map((url) => (
                    <Image
                      src={url}
                      alt="تصویر دیدگاه"
                      width={140}
                      height={140}
                      key={url}
                    />
                  ))}
                </div>
              )}
              <footer>
                <ActionForm action={moderateReviewAction}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  <button name="decision" value="PUBLISHED">
                    <Check /> تأیید و انتشار
                  </button>
                  <button className="reject" name="decision" value="REJECTED">
                    <X /> رد دیدگاه
                  </button>
                </ActionForm>
              </footer>
            </article>
          );
        })}
        {!data.length && (
          <div className="empty-state">دیدگاهی در صف بررسی نیست.</div>
        )}
      </section>
    </div>
  );
}
