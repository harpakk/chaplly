"use server";

import { requireSeller } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { SellerTourName } from "@/lib/seller-tour-shared";
import type { Database } from "@/types/database";

const tours: SellerTourName[] = ["sidebar", "product", "design"];
const events = ["shown", "progress", "completed", "skipped", "dont_show"] as const;

export async function updateSellerTourAction(input: {
  tour: SellerTourName;
  event: (typeof events)[number];
  step?: number;
}) {
  const context = await requireSeller();
  if (!tours.includes(input.tour) || !events.includes(input.event))
    return { ok: false };
  const db = createSupabaseAdmin();
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("login_count")
    .eq("id", context.user.id)
    .single();
  if (profileError) return { ok: false };
  const step = Math.max(0, Math.min(30, Math.floor(Number(input.step) || 0)));
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    user_id: context.user.id,
    eligible: true,
    last_tour: input.tour,
    last_seen_at: now,
  };
  if (input.event === "shown")
    update[`${input.tour}_shown_count`] = undefined;
  if (input.event === "progress" || input.event === "completed")
    update[`${input.tour}_step`] = step;
  if (input.event === "completed")
    update[`${input.tour}_completed_at`] = now;
  if (input.event === "skipped") {
    update.dismissed_login_count = profile.login_count;
    update.skipped_count = undefined;
    update[`${input.tour}_step`] = step;
  }
  if (input.event === "dont_show") {
    update.dont_show_again = true;
    update.dont_show_again_at = now;
  }

  const { data: current, error: currentError } = await db
    .from("seller_tour_progress")
    .select("sidebar_shown_count,product_shown_count,design_shown_count,skipped_count")
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (currentError) return { ok: false };
  if (input.event === "shown") {
    const shownCount = {
      sidebar: current?.sidebar_shown_count,
      product: current?.product_shown_count,
      design: current?.design_shown_count,
    }[input.tour];
    update[`${input.tour}_shown_count`] = Number(shownCount || 0) + 1;
  }
  if (input.event === "skipped")
    update.skipped_count = Number(current?.skipped_count || 0) + 1;
  const { error } = await db.from("seller_tour_progress").upsert(
    update as Database["public"]["Tables"]["seller_tour_progress"]["Insert"],
    { onConflict: "user_id" },
  );
  return { ok: !error };
}
