import { SupplierConsole } from "@/components/supplier-console";
import { requireSupplier } from "@/lib/auth";
import { getSupplierDashboardData } from "@/lib/dashboard-data";
export default async function Page(){const context=await requireSupplier();return <SupplierConsole section="orders" data={await getSupplierDashboardData(context.membership.organization.id,"orders")}/>}
