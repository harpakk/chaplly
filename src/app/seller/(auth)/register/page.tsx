import type { Metadata } from "next";
import Link from "next/link";
import { QuickSellerSignupForm } from "@/components/seller-quick-signup";

export const metadata: Metadata = { title: "ساخت رایگان فروشگاه" };
export default function SellerRegisterPage(){return <div className="auth-card quick-register-page"><div className="auth-title"><span>کاملاً رایگان</span><h1>۶۰ ثانیه دیگه اولین محصولت آماده‌ست.</h1><p>برای ساخت حساب فقط ایمیل و رمز عبور لازمه.</p><small className="register-login-prompt">قبلاً ثبت‌نام کردی؟ <Link href="/seller/login">ورود به حساب فروشنده</Link></small></div><QuickSellerSignupForm/></div>}
