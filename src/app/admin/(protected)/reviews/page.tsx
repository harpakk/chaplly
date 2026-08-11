import { AdminReviewConsole } from "@/components/admin-review-console";
import { getAdminReviewData } from "@/lib/dashboard-data";

export default async function Page() {
  return <AdminReviewConsole data={await getAdminReviewData()} />;
}
