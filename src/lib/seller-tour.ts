import "server-only";
import { cache } from "react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { SellerTourState } from "@/lib/seller-tour-shared";

export const getSellerTourState = cache(async (userId: string): Promise<SellerTourState> => {
  const db = createSupabaseAdmin();
  const [profile, progress] = await Promise.all([
    db.from("profiles").select("login_count").eq("id", userId).maybeSingle(),
    db.from("seller_tour_progress").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (progress.error) throw progress.error;
  const row = progress.data;
  return {
    eligible: Boolean(row?.eligible),
    loginCount: Number(profile.data?.login_count || 0),
    dismissedLoginCount: row?.dismissed_login_count ?? null,
    dontShowAgain: Boolean(row?.dont_show_again),
    steps: {
      sidebar: Number(row?.sidebar_step || 0),
      product: Number(row?.product_step || 0),
      design: Number(row?.design_step || 0),
    },
    completed: {
      sidebar: Boolean(row?.sidebar_completed_at),
      product: Boolean(row?.product_completed_at),
      design: Boolean(row?.design_completed_at),
    },
  };
});
