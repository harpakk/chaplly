import { ReactNode } from "react";
import { SupplierShell } from "@/components/supplier-shell";
import { requireSupplier } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const one = <T,>(value: T | T[] | null | undefined) =>
  Array.isArray(value) ? value[0] : value;
const url = (file: { bucket?: string; path?: string } | null | undefined) =>
  file?.bucket && file.path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path.split("/").map(encodeURIComponent).join("/")}`
    : null;

export default async function Layout({ children }: { children: ReactNode }) {
  const context = await requireSupplier();
  const db = createSupabaseAdmin();
  const [profileResult, facilityResult] = await Promise.all([
    db
      .from("supplier_profiles")
      .select(
        "capacity_per_day,organization:organizations(display_name),logo:storage_files!supplier_profiles_logo_file_id_fkey(bucket,path),banner:storage_files!supplier_profiles_banner_file_id_fkey(bucket,path)",
      )
      .eq("organization_id", context.membership.organization.id)
      .maybeSingle(),
    db
      .from("facilities")
      .select("city")
      .eq("organization_id", context.membership.organization.id)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle(),
  ]);
  const profile = profileResult.data;
  return (
    <SupplierShell
      companyName={
        one(profile?.organization)?.display_name ||
        context.membership.organization.displayName
      }
      city={facilityResult.data?.city || ""}
      capacity={profile?.capacity_per_day || 0}
      logoUrl={url(one(profile?.logo))}
      bannerUrl={url(one(profile?.banner))}
    >
      {children}
    </SupplierShell>
  );
}
