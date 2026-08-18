import { notFound } from "next/navigation";
import { DesignEditor } from "@/components/design-editor";
import { requireSeller } from "@/lib/auth";
import { getDesignEditorData } from "@/lib/dashboard-data";
import { getSellerTourState } from "@/lib/seller-tour";

export default async function DesignPage({searchParams}:{searchParams:Promise<{raw?:string;design?:string}>}){
  const user=await requireSeller();const {raw,design}=await searchParams;if(!raw)notFound();
  const data=await getDesignEditorData(raw,design,user.user.id);if(!data.rawProducts[0])notFound();
  const tourState=await getSellerTourState(user.user.id);
  return <DesignEditor data={data} tourState={tourState}/>;
}
