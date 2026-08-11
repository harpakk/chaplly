import type { ReactNode } from "react";
import { SellerDashboardShell } from "@/components/seller-dashboard-shell";
import { requireSeller } from "@/lib/auth";
import { getSellerStoreRecord } from "@/lib/dashboard-data";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context=await requireSeller();
  const store=context.membership.organization.stores[0];
  const {data}=store?await getSellerStoreRecord(store.id):{data:null};
  const logo=Array.isArray(data?.logo)?data.logo[0]:data?.logo;
  const logoUrl=logo?.bucket&&logo.path?`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${logo.bucket}/${logo.path}`:null;
  return <SellerDashboardShell storeName={data?.name||store?.name||"فروشگاه من"} logoUrl={logoUrl}>{children}</SellerDashboardShell>;
}
