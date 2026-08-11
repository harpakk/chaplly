import { ProductCreationFlow } from "@/components/product-creation-flow";
import { requireSeller } from "@/lib/auth";
import { getDesignEditorData, getProductStartData } from "@/lib/dashboard-data";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{
    raw?: string;
    design?: string;
    supplier?: string;
    unavailable?: string;
  }>;
}) {
  const user = await requireSeller();
  const params = await searchParams;
  const data =
    params.raw && params.design
      ? await getDesignEditorData(params.raw, params.design, user.user.id, false)
      : await getProductStartData();
  return (
    <ProductCreationFlow
      data={data}
      rawProductId={params.raw}
      designId={params.design}
      supplierOfferId={params.supplier}
    />
  );
}
