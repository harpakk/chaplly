import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type CouponManagementData = {
  coupons: Array<{
    id: string; code: string; discount_type: string; discount_value: number;
    applies_to: string; all_stores: boolean; expires_at: string; max_usage: number;
    usage_count: number; status: string;
  }>;
  stores: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
};

export async function getCouponManagementData(ownerOrganizationId?: string | null): Promise<CouponManagementData> {
  const db = createSupabaseAdmin();
  let couponsQuery = db.from("coupons").select("id,code,discount_type,discount_value,applies_to,all_stores,expires_at,max_usage,usage_count,status").order("created_at", { ascending: false });
  if (ownerOrganizationId) couponsQuery = couponsQuery.eq("owner_organization_id", ownerOrganizationId);
  let storesQuery = db.from("stores").select("id,name").eq("status", "ACTIVE").order("name");
  if (ownerOrganizationId) storesQuery = storesQuery.eq("organization_id", ownerOrganizationId);
  const [couponsResult, storesResult, categoriesResult] = await Promise.all([
    couponsQuery,
    storesQuery,
    db.from("categories").select("id,name").eq("status", "ACTIVE").order("sort_order"),
  ]);
  if (couponsResult.error || storesResult.error || categoriesResult.error)
    throw new Error(couponsResult.error?.message || storesResult.error?.message || categoriesResult.error?.message);
  return {
    coupons: couponsResult.data || [],
    stores: storesResult.data || [],
    categories: categoriesResult.data || [],
  };
}
