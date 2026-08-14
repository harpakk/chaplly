"use client";
import Link from "next/link";
import { useActionState } from "react";
import { LogIn } from "lucide-react";
import {
  buyerLoginAction,
  buyerSignupAction,
  type BuyerAuthState,
} from "@/app/actions/buyer-auth";
import { SavingOverlay } from "@/components/saving-overlay";
import { useSearchParams } from "next/navigation";

export default function BuyerLoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "";
  const [state, action, pending] = useActionState<BuyerAuthState, FormData>(
    buyerLoginAction,
    {},
  );
  const [signupState, signupAction, signupPending] = useActionState<BuyerAuthState, FormData>(buyerSignupAction, {});
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-card-copy">
          <span>حساب خریدار</span>
          <h1>خریدها و سیوها، یک‌جا</h1>
          <p>برای دیدن سفارش‌ها، علاقه‌مندی‌ها و ویدیوهای ذخیره‌شده وارد شو.</p>
        </div>
        <form action={action} className="auth-form">
          <input type="hidden" name="next" value={next} />
          <SavingOverlay visible={pending} text="در حال ورود به حساب خریدار…" />
          {state.message && <div className="form-alert">{state.message}</div>}
          <label className="field">
            <span>ایمیل</span>
            <input
              className="input"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="buyer@chapli.dev"
            />
          </label>
          <label className="field">
            <span>رمز عبور</span>
            <input
              className="input"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <button
            className="button button-primary auth-submit"
            disabled={pending}
          >
            {pending ? "در حال ورود..." : "ورود به حساب"} <LogIn />
          </button>
          <p className="auth-switch"><Link href="/">ادامه خرید به‌عنوان مهمان</Link></p>
        </form>
        <form action={signupAction} className="auth-form buyer-signup-form">
          <input type="hidden" name="next" value={next} />
          <SavingOverlay visible={signupPending} text="در حال ساخت حساب…" />
          <h2>حساب نداری؟ سریع ثبت‌نام کن</h2>
          {signupState.message && <div className="form-alert">{signupState.message}</div>}
          <label className="field"><span>ایمیل</span><input className="input" name="email" type="email" required autoComplete="email" /></label>
          <label className="field"><span>رمز عبور</span><input className="input" name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
          <label className="field"><span>شماره موبایل <small>(اختیاری)</small></span><input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxxx" /></label>
          <button className="button button-primary auth-submit" disabled={signupPending}>{signupPending?"در حال ثبت‌نام…":"ساخت حساب خریدار"}</button>
        </form>
      </section>
    </main>
  );
}
