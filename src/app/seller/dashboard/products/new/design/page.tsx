import { notFound } from "next/navigation";
import { DesignEditor } from "@/components/design-editor";
import { requireSeller } from "@/lib/auth";
import { getDesignEditorData } from "@/lib/dashboard-data";
import { getSellerTourState } from "@/lib/seller-tour";

export default async function DesignPage({searchParams}:{searchParams:Promise<{raw?:string;design?:string;product?:string}>}){
  const user=await requireSeller();const {raw,design,product}=await searchParams;if(!raw)notFound();
  const data=await getDesignEditorData(raw,design,user.user.id,true,product);if(!data.rawProducts[0]||(product&&data.productDraft?.id!==product))notFound();
  const tourState=await getSellerTourState(user.user.id);
  return <DesignEditor data={data} tourState={tourState} productId={product}/>;
}
