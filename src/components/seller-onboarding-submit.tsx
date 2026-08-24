"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SellerOnboardingSubmit() {
  const { pending } = useFormStatus();
  return <button className="creator-button onboarding-submit" disabled={pending} aria-busy={pending}>{pending ? <><LoaderCircle /> در حال آماده‌سازی داشبورد…</> : "ذخیره و ورود به داشبورد"}</button>;
}
