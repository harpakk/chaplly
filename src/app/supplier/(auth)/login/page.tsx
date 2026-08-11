import { redirect } from "next/navigation";
import { SupplierLoginForm } from "@/components/supplier-auth-forms";
import { getCurrentUser } from "@/lib/auth";

export default async function Page() {
  const user = await getCurrentUser();
  if (user?.memberships.some((item) => item.status === "ACTIVE" && item.organization.type === "SUPPLIER"))
    redirect("/supplier/dashboard");
  return <div className="auth-card"><div className="auth-title"><span>پنل تأمین‌کننده</span><h1>برگردیم سر سفارش‌ها.</h1><p>با حساب شرکت وارد مرکز تولید و ارسال شو.</p></div><SupplierLoginForm/></div>;
}
