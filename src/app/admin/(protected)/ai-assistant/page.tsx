import { AdminConsole } from "@/components/admin-console";
import { getAdminDashboardData } from "@/lib/dashboard-data";

export default async function AiAssistantAdminPage() {
  return <AdminConsole section="settings" data={await getAdminDashboardData("settings")} />;
}
