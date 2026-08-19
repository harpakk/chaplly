import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { getDesignEditorData, getSellerProductEditData } from "@/lib/dashboard-data";
import { ProductCreationFlow } from "@/components/product-creation-flow";
import { getSellerTourState } from "@/lib/seller-tour";

export default async function SellerProductEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ supplier?: string }>;
}) {
  const context = await requireSeller();
  const store = context.membership.organization.stores[0];
  if (!store) notFound();
  const { id } = await params;
  const { supplier } = await searchParams;
  const editData = await getSellerProductEditData(id, store.id);
  if (!editData?.product.design_id) notFound();
  const data = await getDesignEditorData(
    editData.product.raw_product_id,
    editData.product.design_id,
    context.user.id,
    false,
    editData.product.id,
  );
  if (data.productDraft?.id !== editData.product.id) notFound();
  const tourState = await getSellerTourState(context.user.id);
  return (
    <ProductCreationFlow
      data={data}
      tourState={tourState}
      rawProductId={editData.product.raw_product_id}
      designId={editData.product.design_id}
      supplierOfferId={supplier || editData.product.primary_supplier_offer_id || undefined}
      editingProductId={editData.product.id}
    />
  );
}
