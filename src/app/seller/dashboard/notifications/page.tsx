import { requireSeller } from "@/lib/auth";
import { getSmsPreferenceData } from "@/lib/dashboard-data";
import { SmsPreferences } from "@/components/sms-preferences";

export default async function SellerSmsSettingsPage() {
  const context = await requireSeller();
  const data = await getSmsPreferenceData(context.user.id, ["SELLER"]);
  return <div className="sd-page"><div className="sd-page-head"><span>اطلاع‌رسانی</span><h1>تنظیمات پیامک</h1><p>پیامک‌های مربوط به فروشگاه را جداگانه مدیریت کنید.</p></div><SmsPreferences items={data.items} phone={data.phone} /></div>;
}
