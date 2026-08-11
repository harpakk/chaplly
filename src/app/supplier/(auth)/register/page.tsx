import { SupplierRegisterForm } from "@/components/supplier-auth-forms";
import { getSupplierSignupOptions } from "@/lib/dashboard-data";
export default async function Page() {
  const options = await getSupplierSignupOptions();
  return (
    <div className="auth-card auth-card-wide onboarding-card">
      <div className="auth-title">
        <span>همکاری با چاپلی</span>
        <h1>مجموعه‌ات را به شبکه تولید وصل کن.</h1>
        <p>فقط اطلاعات ضروری عملیات را ثبت کن؛ جزئیات دیگر اختیاری‌اند.</p>
      </div>
      <SupplierRegisterForm {...options} />
    </div>
  );
}
