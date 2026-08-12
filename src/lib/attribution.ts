import "server-only";

import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Attribution = {
  referralCode: string | null;
  source: "DIRECT" | "GOOGLE" | "REFERRAL" | "OTHER";
  landingPath: string | null;
};

const cleanRef = (value: string | undefined) =>
  (value || "").normalize("NFKC").trim().replace(/[^\p{L}\p{N}_.-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80).toLowerCase() || null;

export async function readAttribution(): Promise<Attribution> {
  const jar = await cookies();
  const referralCode = cleanRef(jar.get("chapli_ref")?.value);
  const rawSource = jar.get("chapli_source")?.value || "DIRECT";
  const source = referralCode
    ? "REFERRAL"
    : (["DIRECT", "GOOGLE", "OTHER"].includes(rawSource) ? rawSource : "OTHER") as Attribution["source"];
  const landing = jar.get("chapli_landing")?.value || "";
  return {
    referralCode,
    source,
    landingPath: landing.startsWith("/") ? landing.slice(0, 500) : null,
  };
}

export async function persistUserAttribution(userId: string) {
  const attribution = await readAttribution();
  const { error } = await createSupabaseAdmin()
    .from("profiles")
    .update({
      referral_code: attribution.referralCode,
      acquisition_source: attribution.source,
      attribution_landing_path: attribution.landingPath,
      attributed_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .is("attributed_at", null);
  if (error) throw new Error(error.message);
}

export async function persistOrderAttribution(orderId: string, userId?: string) {
  const cookieAttribution = await readAttribution();
  let attribution = cookieAttribution;
  if (userId && !cookieAttribution.referralCode) {
    const { data } = await createSupabaseAdmin()
      .from("profiles")
      .select("referral_code,acquisition_source,attribution_landing_path")
      .eq("id", userId)
      .maybeSingle();
    if (data?.referral_code || data?.acquisition_source) {
      const storedSource = data.acquisition_source;
      const source: Attribution["source"] = data.referral_code
        ? "REFERRAL"
        : storedSource && ["DIRECT", "GOOGLE", "REFERRAL", "OTHER"].includes(storedSource)
          ? storedSource as Attribution["source"]
          : "OTHER";
      attribution = {
        referralCode: data.referral_code || null,
        source,
        landingPath: data.attribution_landing_path || null,
      };
    }
  }
  const { error } = await createSupabaseAdmin()
    .from("orders")
    .update({
      referral_code: attribution.referralCode,
      acquisition_source: attribution.source,
      attribution_landing_path: attribution.landingPath,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}
