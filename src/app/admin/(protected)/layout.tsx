import { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin-shell";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
export default async function ProtectedAdminLayout({children}:{children:ReactNode}){
  await requireAdmin();
  const { count } = await createSupabaseAdmin()
    .from("product_moderation_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDING");
  return <AdminShell pendingProductCount={count || 0}>{children}</AdminShell>;
}
