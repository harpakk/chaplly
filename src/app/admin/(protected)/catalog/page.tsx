import { AdminTaxonomyConsole } from "@/components/admin-taxonomy-console";
import { getAdminTaxonomyData } from "@/lib/dashboard-data";

export default async function AdminCatalogPage() {
  return <AdminTaxonomyConsole data={await getAdminTaxonomyData()} />;
}
