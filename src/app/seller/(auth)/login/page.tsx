import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "ورود فروشندگان" };

export default async function SellerLoginPage() {
  const user = await getCurrentUser();
  if (user?.memberships.some((item) => item.status === "ACTIVE" && item.organization.type === "SELLER"))
    redirect("/seller/dashboard");
  return (
    <div className="auth-card">
      <div className="auth-title">
        <span>خوش برگشتی 👋</span>
        <h1>ورود به حساب فروشنده</h1>
        <p>برای مدیریت فروشگاه و سفارش‌ها وارد حساب چاپلی شوید.</p>
      </div>
      <LoginForm />
      <div className="secure-note">ورود امن با رمزنگاری و نشست محافظت‌شده</div>
    </div>
  );
}
