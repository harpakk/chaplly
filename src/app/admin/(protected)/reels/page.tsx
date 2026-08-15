import { AdminReelConsole } from "@/components/admin-reel-console";
import { getAdminReelData } from "@/lib/dashboard-data";
export default async function AdminReelsPage(){return <AdminReelConsole reels={await getAdminReelData()}/>;}
