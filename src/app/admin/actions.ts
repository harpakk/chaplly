"use server";

import { redirect } from "next/navigation";
import { destroyAdminSession, signInAdmin } from "@/lib/admin-auth";

export async function adminLoginAction(_: string, formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const accessCode = String(formData.get("accessCode") || "");
  if (!(await signInAdmin(email, password, accessCode)))
    return "ورود ناموفق بود. اطلاعات حساب، سطح دسترسی مدیریت و در صورت نیاز رمز مدیریت را بررسی کن.";
  redirect("/admin");
}

export async function adminLogoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}
