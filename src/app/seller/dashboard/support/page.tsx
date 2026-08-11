import { TicketWorkspace } from "@/components/ticket-workspace";
import { requireSeller } from "@/lib/auth";
import { getTicketsData } from "@/lib/dashboard-data";

export default async function Page(){
  const context=await requireSeller();
  const data=await getTicketsData({organizationId:context.membership.organization.id});
  return <div className="sd-content"><div className="sd-intro-row"><div><h2>پشتیبانی و تیکت‌ها</h2><p>گفت‌وگوهای سفارشی، مالی و محصول را یک‌جا دنبال کن.</p></div></div><TicketWorkspace role="seller" data={data}/></div>;
}
