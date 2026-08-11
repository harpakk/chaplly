import { TicketWorkspace } from "@/components/ticket-workspace";
import { requireSupplier } from "@/lib/auth";
import { getTicketsData } from "@/lib/dashboard-data";

export default async function Page(){
  const context=await requireSupplier();
  const data=await getTicketsData({organizationId:context.membership.organization.id});
  return <div className="supplier-page"><div className="supplier-page-title"><span>مرکز ارتباط</span><h1>تیکت‌ها و پشتیبانی</h1></div><TicketWorkspace role="supplier" data={data}/></div>;
}
