"use client";

import { BellRing } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { saveSmsPreferencesAction } from "@/app/actions/dashboard";

export type SmsPreferenceItem = {
  event_type: string;
  name: string;
  description: string;
  enabled: boolean;
};

export function SmsPreferences({ items, phone }: { items: SmsPreferenceItem[]; phone: string | null }) {
  return (
    <section className="admin-card sms-preferences-card">
      <header><BellRing /><div><h2>اطلاع‌رسانی پیامکی</h2><p>هر پیام را جداگانه فعال یا غیرفعال کنید. پیامک‌ها به {phone || "شماره ثبت‌شده حساب"} ارسال می‌شوند.</p></div></header>
      <ActionForm action={saveSmsPreferencesAction} className="sms-preferences-form">
        {items.map((item) => (
          <label key={item.event_type}>
            <span><b>{item.name}</b><small>{item.description}</small></span>
            <input name={`sms_${item.event_type}`} type="checkbox" defaultChecked={item.enabled} />
          </label>
        ))}
        <button>ذخیره تنظیمات پیامک</button>
      </ActionForm>
    </section>
  );
}
