import { AdminConsole } from "@/components/admin-console";
import { getAdminDashboardData } from "@/lib/dashboard-data";
export default async function Page(){return <AdminConsole section="raw-products" data={await getAdminDashboardData("raw-products")}/>}
