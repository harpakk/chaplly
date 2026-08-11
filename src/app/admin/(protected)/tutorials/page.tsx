import { AdminTutorialConsole } from "@/components/admin-tutorial-console";
import { getAdminTutorialData } from "@/lib/dashboard-data";

export default async function Page(){return <AdminTutorialConsole tutorials={await getAdminTutorialData()}/>;}
