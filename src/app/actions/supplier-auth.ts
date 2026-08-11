"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { destroySession, requireSupplier } from "@/lib/auth";
import {
  getUserByEmail,
  registerSupplier,
  updateLastLogin,
} from "@/lib/database";
import { insertStorageFileDirect } from "@/lib/postgres";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { persistUserAttribution } from "@/lib/attribution";
import { uploadStorageImage } from "@/lib/supabase/storage-upload";

export type SupplierAuthState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};
const optionalText = z.preprocess(
  (value) => String(value || "").trim() || undefined,
  z.string().optional(),
);
const schema = z
  .object({
    firstName: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد."),
    lastName: z.string().trim().min(2, "نام خانوادگی باید حداقل ۲ حرف باشد."),
    phone: z
      .string()
      .trim()
      .regex(/^(\+98|0)?9\d{9}$/, "شماره موبایل معتبر نیست."),
    email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست."),
    password: z
      .string()
      .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.")
      .regex(/[A-Za-z]/, "رمز باید حرف انگلیسی داشته باشد.")
      .regex(/[0-9]/, "رمز باید عدد داشته باشد."),
    confirmPassword: z.string(),
    displayName: z.string().trim().min(2, "نام مجموعه باید حداقل ۲ حرف باشد."),
    legalName: optionalText,
    nationalId: optionalText,
    registrationNumber: optionalText,
    website: optionalText,
    city: z.string().trim().min(2, "نام شهر را وارد کنید."),
    address: z.string().trim().min(5, "آدرس کامل مرکز تولید را وارد کنید."),
    postalCode: optionalText,
    capacityPerDay: z.coerce
      .number()
      .int()
      .positive("ظرفیت روزانه باید بیشتر از صفر باشد."),
    leadTimeDays: z.coerce
      .number()
      .positive("زمان آماده‌سازی باید بیشتر از صفر باشد."),
    iban: optionalText,
    cardNumber: optionalText,
    terms: z.literal("on", {
      message: "پذیرش قوانین برای ساخت حساب لازم است.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "تکرار رمز عبور یکسان نیست.",
    path: ["confirmPassword"],
  });

export async function supplierRegisterAction(
  _: SupplierAuthState,
  formData: FormData,
): Promise<SupplierAuthState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      message: "لطفاً فیلدهای ضروری را کامل و دقیق وارد کنید.",
      errors: parsed.error.flatten().fieldErrors,
    };
  try {
    if (await getUserByEmail(parsed.data.email))
      return {
        errors: { email: ["برای این ایمیل قبلاً حساب ساخته شده است."] },
      };
    const methodIds = [
      ...new Set(formData.getAll("methodIds").map(String).filter(Boolean)),
    ];
    const categoryIds = [
      ...new Set(formData.getAll("categoryIds").map(String).filter(Boolean)),
    ];
    const user = await registerSupplier({
      ...parsed.data,
      legalName: parsed.data.legalName || "",
      nationalId: parsed.data.nationalId || "",
      registrationNumber: parsed.data.registrationNumber || "",
      website: parsed.data.website || "",
      postalCode: parsed.data.postalCode || "",
      capacityPerDay: parsed.data.capacityPerDay,
      iban: parsed.data.iban || "",
      cardNumber: parsed.data.cardNumber || "",
      methodIds,
      categoryIds,
    });
    await persistUserAttribution(user.id).catch(error=>console.error("Supplier attribution failed",error));
    const provisioned = user.result as { organizationId?: string } | null;
    if (provisioned?.organizationId) {
      try {
        await persistSupplierMedia(
          user.id,
          provisioned.organizationId,
          formData,
        );
      } catch (mediaError) {
        console.error("Supplier media upload failed", mediaError);
      }
    }
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) throw error;
    await updateLastLogin(user.id);
    redirect("/supplier/dashboard");
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    console.error("Supplier registration failed", error);
    if (error instanceof Error && error.message === "EMAIL_EXISTS")
      return {
        errors: { email: ["برای این ایمیل قبلاً حساب ساخته شده است."] },
      };
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "UNKNOWN";
    return {
      message: `ساخت حساب انجام نشد. خطای پایگاه‌داده: ${code}. اطلاعاتت حفظ شده؛ دوباره تلاش کن.`,
    };
  }
}

async function persistSupplierMedia(
  userId: string,
  organizationId: string,
  formData: FormData,
) {
  const db = createSupabaseAdmin();
  const updates: { logo_file_id?: string; banner_file_id?: string } = {};
  for (const [field, kind, column, maxDimension] of [
    ["supplierLogo", "SUPPLIER_LOGO", "logo_file_id", 1200],
    ["supplierBanner", "SUPPLIER_BANNER", "banner_file_id", 2400],
  ] as const) {
    const file = formData.get(field);
    if (!(file instanceof File) || !file.size) continue;
    if (file.size > 10 * 1024 * 1024)
      throw new Error("هر تصویر باید کمتر از ۱۰ مگابایت باشد.");
    const path = `${userId}/supplier/${organizationId}/${randomUUID()}-${file.name.replace(/[^\w.-]+/g, "-")}`;
    const uploaded = await uploadStorageImage(file, "product-images", path, {
      maxDimension,
      quality: 90,
    });
    const fileId = await insertStorageFileDirect({
      ownerUserId: userId,
      bucket: "product-images",
      path: uploaded.path,
      kind,
      originalName: file.name,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
    });
    if (column === "logo_file_id") updates.logo_file_id = fileId;
    else updates.banner_file_id = fileId;
  }
  if (Object.keys(updates).length) {
    const { error } = await db
      .from("supplier_profiles")
      .update(updates)
      .eq("organization_id", organizationId);
    if (error) throw error;
  }
}

export async function updateSupplierProfileAction(formData: FormData) {
  const context = await requireSupplier();
  const organizationId = context.membership.organization.id;
  const displayName = String(formData.get("displayName") || "").trim();
  const capacityPerDay = Math.floor(Number(formData.get("capacityPerDay") || 0));
  const leadTimeDays = Math.floor(Number(formData.get("leadTimeDays") || 0));
  if (displayName.length < 2 || capacityPerDay < 1 || leadTimeDays < 1) return;
  const db = createSupabaseAdmin();
  const [organization, profile, facility] = await Promise.all([
    db.from("organizations").update({ display_name: displayName }).eq("id", organizationId),
    db.from("supplier_profiles").update({ capacity_per_day: capacityPerDay, lead_time_days: leadTimeDays, updated_at: new Date().toISOString() }).eq("organization_id", organizationId),
    db.from("facilities").update({ city: String(formData.get("city") || "").trim(), address: String(formData.get("address") || "").trim(), updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("status", "ACTIVE"),
  ]);
  if (organization.error || profile.error || facility.error)
    throw organization.error || profile.error || facility.error;
  await persistSupplierMedia(context.user.id, organizationId, formData);
  revalidatePath("/supplier/dashboard", "layout");
  redirect("/supplier/dashboard/settings?saved=1");
}

export async function supplierLoginAction(
  _: SupplierAuthState,
  formData: FormData,
): Promise<SupplierAuthState> {
  const email = String(formData.get("email") || "").toLowerCase(),
    password = String(formData.get("password") || "");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user)
    return { message: "ایمیل یا رمز عبور تأمین‌کننده درست نیست." };
  const user = await getUserByEmail(email, true);
  if (
    !user ||
    !user.memberships.some((item) => item.organization.type === "SUPPLIER")
  ) {
    await supabase.auth.signOut();
    return { message: "این حساب دسترسی تأمین‌کننده ندارد." };
  }
  await updateLastLogin(user.id);
  redirect("/supplier/dashboard");
}
export async function supplierLogoutAction() {
  await destroySession();
  redirect("/supplier/login");
}
