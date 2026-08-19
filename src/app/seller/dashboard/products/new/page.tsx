import { ProductCreationFlow } from "@/components/product-creation-flow";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { getDesignEditorData, getProductStartData } from "@/lib/dashboard-data";
import { getSellerTourState } from "@/lib/seller-tour";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{
    raw?: string;
    design?: string;
    supplier?: string;
    unavailable?: string;
    product?: string;
  }>;
}) {
  const user = await requireSeller();
  const params = await searchParams;
  const data =
    params.raw && params.design
      ? await getDesignEditorData(params.raw, params.design, user.user.id, false, params.product)
      : await getProductStartData();
  if (params.product && (!("productDraft" in data) || data.productDraft?.id !== params.product)) notFound();
  const tourState = await getSellerTourState(user.user.id);
  return (
    <ProductCreationFlow
      data={data}
      tourState={tourState}
      rawProductId={params.raw}
      designId={params.design}
      supplierOfferId={params.supplier}
      editingProductId={params.product}
    />
  );
}
