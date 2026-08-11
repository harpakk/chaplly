import { SellerDashboardConsole } from "@/components/seller-dashboard-console";
import { requireSeller } from "@/lib/auth";
import { getSellerDashboardData } from "@/lib/dashboard-data";

export default async function SellerDashboardPage({searchParams}:{searchParams:Promise<{section?:string}>}){
  const context=await requireSeller();const store=context.membership.organization.stores[0];
  if(!store)throw new Error("Seller store is missing.");
  const {section}=await searchParams;
  const selected=["finance","accounts","store","products","woocommerce","tutorials"].includes(section||"")?section as "finance"|"accounts"|"store"|"products"|"woocommerce"|"tutorials":"finance";
  const data=await getSellerDashboardData(context.membership.organization.id,store.id,context.user.id,selected);
  return <SellerDashboardConsole section={selected} data={data}/>;
}
