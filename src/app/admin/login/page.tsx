import { redirect } from "next/navigation";
import { getAdminAccessMode, isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/admin-login-form";
import { getCurrentUser } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";

export default async function AdminLogin() {
  if (await isAdminAuthenticated()) redirect("/admin");
  const user = await getCurrentUser();
  const sellerSignedIn = Boolean(
    user?.memberships.some(
      (item) => item.status === "ACTIVE" && item.organization.type === "SELLER",
    ),
  );
  return (
    <main className="admin-login" dir="rtl">
      <section>
        <div className="admin-login-brand">
          <BrandLogo variant="white" href="/admin/login" subtitle="مدیریت" priority />
        </div>
        <div className="admin-login-art">
          <i>امن</i>
          <h1>مرکز کنترل چاپلی</h1>
          <p>عملیات، پول و کیفیت بازار؛ همه در یک جای خلوت و دقیق.</p>
          <div>
            <span>● ورود محافظت‌شده</span>
            <span>RTL · فارسی</span>
          </div>
        </div>
      </section>
      <AdminLoginForm
        sellerSignedIn={sellerSignedIn}
        accessMode={getAdminAccessMode()}
      />
    </main>
  );
}
