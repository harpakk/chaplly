import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="auth-card">
      <div className="auth-title">
        <span>بازیابی حساب</span>
        <h1>رمز عبورت را فراموش کردی؟</h1>
        <p>در نسخه بعدی، لینک بازیابی از طریق ایمیل ارسال می‌شود.</p>
      </div>
      <Link className="button button-primary auth-submit" href="/seller/login">
        بازگشت به ورود
      </Link>
    </div>
  );
}
