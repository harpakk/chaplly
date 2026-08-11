import { CreditCard, WalletCards } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { ActionForm } from "@/components/action-form";
import { saveBuyerRefundPreferenceAction } from "@/app/actions/dashboard";
import { requireBuyer } from "@/lib/auth";
import { getBuyerWalletData } from "@/lib/dashboard-data";
import { formatPrice } from "@/lib/catalog";

export default async function WalletPage() {
  const user = await requireBuyer();
  const data = await getBuyerWalletData(user.id);
  const name = [data.profile?.first_name, data.profile?.last_name].filter(Boolean).join(" ");
  return (
    <AccountShell active="/account/wallet" name={name}>
      <div className="account-heading"><span>بازپرداخت و اعتبار خرید</span><h1>کیف پول چاپلی</h1></div>
      <section className="buyer-wallet-balance"><WalletCards /><span>موجودی قابل استفاده</span><strong>{formatPrice(data.balance)}</strong><p>این مبلغ هنگام پرداخت سفارش از جمع سبد کم می‌شود.</p></section>
      <section className="buyer-refund-preference">
        <h2>روش دریافت بازپرداخت سفارش لغوشده</h2>
        <ActionForm action={saveBuyerRefundPreferenceAction}>
          <label><input type="radio" name="destination" value="WALLET" defaultChecked={data.preference.destination !== "BANK"} /><span>واریز فوری به کیف پول چاپلی</span></label>
          <label><input type="radio" name="destination" value="BANK" defaultChecked={data.preference.destination === "BANK"} /><span>بازگشت به کارت بانکی</span></label>
          <label className="buyer-card-field"><CreditCard /> شماره کارت ۱۶ رقمی<input name="cardNumber" inputMode="numeric" maxLength={19} defaultValue={data.preference.card_number || ""} placeholder="6037..." /></label>
          <button>ذخیره روش بازپرداخت</button>
        </ActionForm>
      </section>
      <section className="buyer-refund-history"><h2>بازپرداخت‌ها و رسیدها</h2>{data.refunds.length ? data.refunds.map((refund) => <article key={refund.id}><div><b>سفارش {refund.orders?.number || refund.order_id}</b><span>{refund.destination === "BANK" ? "کارت بانکی" : "کیف پول"}</span></div><strong>{formatPrice(refund.amount)}</strong><em>{refund.status === "SUCCEEDED" ? "پرداخت‌شده" : "در انتظار پرداخت"}</em>{refund.transfer_reference && <small>پیگیری: {refund.transfer_reference}</small>}{refund.receiptUrl && <a href={refund.receiptUrl} target="_blank" rel="noreferrer">مشاهده رسید</a>}</article>) : <p>هنوز بازپرداختی ثبت نشده است.</p>}</section>
      <section className="buyer-refund-history"><h2>گردش کیف پول</h2>{data.transactions.map((item) => <article key={item.id}><div><b>{item.description}</b><span>{new Date(item.created_at).toLocaleDateString("fa-IR")}</span></div><strong className={item.direction === "CREDIT" ? "credit" : "debit"}>{item.direction === "CREDIT" ? "+" : "−"}{formatPrice(item.amount)}</strong></article>)}</section>
    </AccountShell>
  );
}
