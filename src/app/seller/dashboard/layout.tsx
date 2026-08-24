import type { ReactNode } from "react";
import { SellerDashboardShell } from "@/components/seller-dashboard-shell";
import { requireSeller } from "@/lib/auth";
import { getSellerStoreRecord } from "@/lib/dashboard-data";
import { getSellerTourState } from "@/lib/seller-tour";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context=await requireSeller();
  const store=context.membership.organization.stores[0];
  const {data}=store?await getSellerStoreRecord(store.id):{data:null};
  const logo=Array.isArray(data?.logo)?data.logo[0]:data?.logo;
  const logoUrl=logo?.bucket&&logo.path?`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${logo.bucket}/${logo.path}`:null;
  const tourState=await getSellerTourState(context.user.id);
  const {data:readStates}=await createSupabaseAdmin().from("ticket_read_states").select("unread_count").eq("user_id",context.user.id);
  const unreadTickets=(readStates||[]).reduce((sum,item)=>sum+Number(item.unread_count||0),0);
  return <SellerDashboardShell storeName={data?.name||store?.name||"فروشگاه من"} logoUrl={logoUrl} tourState={tourState} unreadTickets={unreadTickets}>{children}</SellerDashboardShell>;
}
