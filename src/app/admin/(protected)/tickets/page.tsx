import { TicketWorkspace } from "@/components/ticket-workspace";
import { getTicketsData } from "@/lib/dashboard-data";

export default async function Page(){
  return <div className="admin-page"><div className="admin-page-title"><div><span>مرکز ارتباط</span><h1>تیکت‌های پشتیبانی</h1></div></div><TicketWorkspace role="admin" data={await getTicketsData({admin:true})}/></div>;
}
