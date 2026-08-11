import { notFound } from "next/navigation";
import { MapPin, Star } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { ReviewCreation } from "@/components/review-creation";
import { TicketWorkspace } from "@/components/ticket-workspace";
import { requireBuyer } from "@/lib/auth";
import { getBuyerSectionData, getBuyerSupportData } from "@/lib/dashboard-data";

export default async function AccountSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const user = await requireBuyer();
  const { section } = await params;
  if (!["addresses", "reviews", "support"].includes(section)) notFound();
  const data = await getBuyerSectionData(user.id);
  const supportData = section === "support" ? await getBuyerSupportData(user.id) : null;
  const name = [data.profile.first_name, data.profile.last_name]
    .filter(Boolean)
    .join(" ");
  let content: React.ReactNode;
  if (section === "addresses")
    content = (
      <>
        <div className="account-heading">
          <span>ارسال بی‌دردسر</span>
          <h1>نشانی‌های من</h1>
        </div>
        {data.addresses.length ? (
          <div className="orders-list">
            {data.addresses.map((address) => (
              <article key={address.id}>
                <MapPin />
                <div>
                  <h2>
                    {address.label}
                    {address.is_default ? " · پیش‌فرض" : ""}
                  </h2>
                  <p>
                    {address.province}، {address.city}، {address.address_line}
                  </p>
                  <small>
                    {address.recipient_name} · {address.phone} ·{" "}
                    {address.postal_code}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            icon={<MapPin />}
            text="هنوز نشانی‌ای ذخیره نشده؛ در اولین سفارش ساخته می‌شود."
          />
        )}
      </>
    );
  else if (section === "reviews")
    content = (
      <>
        <div className="account-heading">
          <span>نظر واقعی تو</span>
          <h1>دیدگاه‌های من</h1>
        </div>
        <ReviewCreation items={data.reviewOpportunities} />
        {data.reviews.length ? (
          <div className="orders-list account-review-list">
            {data.reviews.map((review) => (
              <article key={review.id}>
                <Star />
                <div>
                  <h2>{review.title || review.seller_products?.title}</h2>
                  <p>
                    {"★".repeat(review.rating)} · {review.status}
                  </p>
                  <small>{review.body}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          !data.reviewOpportunities.length && (
            <Empty icon={<Star />} text="هنوز دیدگاهی ثبت نکرده‌ای." />
          )
        )}
      </>
    );
  else
    content = (
      <>
        <div className="account-heading">
          <span>مرکز کمک</span>
          <h1>پشتیبانی خریدار</h1>
        </div>
        {supportData && <TicketWorkspace role="buyer" data={supportData} orders={supportData.orders} />}
      </>
    );
  return (
    <AccountShell active={`/account/${section}`} name={name}>
      {content}
    </AccountShell>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="account-empty">
      {icon}
      <b>فعلاً خالی است</b>
      <p>{text}</p>
    </div>
  );
}
