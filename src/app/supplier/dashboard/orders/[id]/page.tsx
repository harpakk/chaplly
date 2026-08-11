import { notFound } from "next/navigation";
import { SupplierConsole } from "@/components/supplier-console";
import { requireSupplier } from "@/lib/auth";
import { getSupplierDashboardData } from "@/lib/dashboard-data";

export default async function SupplierOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireSupplier();
  const { id } = await params;
  const data = await getSupplierDashboardData(
    context.membership.organization.id,
    "orders",
  );
  if (!data.fulfilments.some((item) => item.id === id)) notFound();
  return <SupplierConsole section="orders" data={data} fulfilmentId={id} />;
}
