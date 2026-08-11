import { AdminConsole } from "@/components/admin-console";
import { getAdminOverviewData } from "@/lib/dashboard-data";
export default async function AdminHome(){return <AdminConsole section="dashboard" data={await getAdminOverviewData()}/>}
