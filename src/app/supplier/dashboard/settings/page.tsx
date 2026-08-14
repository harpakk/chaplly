import { updateSupplierProfileAction } from "@/app/actions/supplier-auth";
import { requireSupplier } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSmsPreferenceData } from "@/lib/dashboard-data";
import { SmsPreferences } from "@/components/sms-preferences";

export default async function SupplierSettingsPage() {
  const context = await requireSupplier();
  const organizationId = context.membership.organization.id;
  const db = createSupabaseAdmin();
  const smsData = await getSmsPreferenceData(context.user.id, ["SUPPLIER"]);
  const [{ data: organization }, { data: profile }, { data: facility }] =
    await Promise.all([
      db.from("organizations").select("display_name").eq("id", organizationId).single(),
      db.from("supplier_profiles").select("capacity_per_day,lead_time_days").eq("organization_id", organizationId).single(),
      db.from("facilities").select("city,address").eq("organization_id", organizationId).eq("status", "ACTIVE").limit(1).maybeSingle(),
    ]);
  return (
    <main className="supplier-page supplier-profile-page">
      <div className="supplier-page-title">
        <span>پروفایل مجموعه</span>
        <h1>اطلاعات تأمین‌کننده</h1>
        <p>نام، لوگو و ظرفیت واقعی تولید روزانه را از اینجا به‌روز کنید.</p>
      </div>
      <form action={updateSupplierProfileAction} className="admin-card supplier-profile-form">
        <label>نام مجموعه<input name="displayName" required minLength={2} defaultValue={organization?.display_name || ""} /></label>
        <label>ظرفیت روزانه<input name="capacityPerDay" type="number" min={1} required defaultValue={profile?.capacity_per_day || 20} /><small>کمتر از ۲۰ قابل ثبت است، ولی ظرفیت بالاتر پیشنهاد می‌شود.</small></label>
        <label>زمان آماده‌سازی (روز)<input name="leadTimeDays" type="number" min={1} required defaultValue={profile?.lead_time_days || 1} /></label>
        <label>شهر<input name="city" defaultValue={facility?.city || ""} /></label>
        <label className="wide">آدرس<input name="address" defaultValue={facility?.address || ""} /></label>
        <label>لوگو<input name="supplierLogo" type="file" accept="image/*" /></label>
        <label>بنر<input name="supplierBanner" type="file" accept="image/*" /></label>
        <button>ذخیره اطلاعات</button>
      </form>
      <SmsPreferences items={smsData.items} phone={smsData.phone} />
    </main>
  );
}
