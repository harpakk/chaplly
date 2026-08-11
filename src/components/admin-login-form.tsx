"use client";

import { useActionState } from "react";
import { KeyRound, LockKeyhole, LogIn, Mail } from "lucide-react";
import { adminLoginAction } from "@/app/admin/actions";
import { SavingOverlay } from "@/components/saving-overlay";

export function AdminLoginForm({
  sellerSignedIn = false,
  accessMode = "temporary",
}: {
  sellerSignedIn?: boolean;
  accessMode?: "temporary" | "profile";
}) {
  const [error, action, pending] = useActionState(adminLoginAction, "");
  const temporary = accessMode === "temporary";
  return (
    <form action={action} className="admin-login-form">
      <SavingOverlay visible={pending} text="در حال تأیید دسترسی مدیریت…" />
      <span>ورود مدیر</span>
      <h2>
        {sellerSignedIn
          ? temporary
            ? "رمز مدیریت را وارد کن"
            : "ورود امن مدیریت"
          : "با حساب مدیریت وارد شو"}{" "}
        👋
      </h2>
      <p>
        {temporary
          ? sellerSignedIn
            ? "جلسه فروشندگی تو فعال است؛ فقط رمز دسترسی مدیریت لازم است."
            : "در محیط توسعه، حساب فروشنده فعال و رمز مدیریت با هم بررسی می‌شوند."
          : "فقط حسابی که پروفایل مدیر فعال دارد اجازه ورود به این بخش را خواهد داشت."}
      </p>
      {!sellerSignedIn && (
        <>
          <label>
            ایمیل حساب
            <div>
              <Mail />
              <input
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                placeholder="name@example.com"
              />
            </div>
          </label>
          <label>
            رمز حساب
            <div>
              <LockKeyhole />
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </div>
          </label>
        </>
      )}
      {temporary && (
        <label>
          رمز دسترسی مدیریت
          <div>
            <KeyRound />
            <input
              name="accessCode"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus={sellerSignedIn}
              required
              placeholder="رمز ۸ رقمی"
            />
          </div>
        </label>
      )}
      {error && <div className="admin-auth-error">{error}</div>}
      <button disabled={pending}>
        {pending ? "در حال بررسی…" : "ورود به داشبورد"}
        <LogIn />
      </button>
      <small>
        {temporary
          ? "دسترسی مدیریت روی همین مرورگر تا ۲۴ ساعت معتبر می‌ماند."
          : "ورود فقط برای حساب‌های مدیر فعال مجاز است."}
      </small>
    </form>
  );
}
