import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { getSellerProductEditData } from "@/lib/dashboard-data";
import { SellerProductEditForm } from "@/components/seller-product-edit-form";

export default async function SellerProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireSeller();
  const store = context.membership.organization.stores[0];
  if (!store) notFound();
  const { id } = await params;
  const data = await getSellerProductEditData(id, store.id);
  if (!data) notFound();
  return <SellerProductEditForm data={data} />;
}
