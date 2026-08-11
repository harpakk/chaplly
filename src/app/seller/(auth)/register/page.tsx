import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "ساخت رایگان فروشگاه" };
export default function SellerRegisterPage(){return <div className="auth-card auth-card-wide onboarding-card"><div className="auth-title"><span>رایگان شروع کن؛ بدون کارت بانکی</span><h1>حس می‌کنیم قراره چیز باحالی بسازی.</h1><p>حساب و فروشگاهت رو قدم‌به‌قدم می‌سازیم؛ اطلاعاتش بعداً هم قابل تغییره.</p><small className="register-login-prompt">قبلاً ثبت‌نام کردی؟ <Link href="/seller/login">ورود به حساب فروشنده</Link></small></div><RegisterForm/></div>}
