import {MockupAdminConsole} from "@/components/mockup-admin-console";
import {getAdminMockupData} from "@/lib/dashboard-data";
export default async function Page(){return <MockupAdminConsole data={await getAdminMockupData()}/>}
