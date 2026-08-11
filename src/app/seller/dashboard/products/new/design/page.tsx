import { notFound } from "next/navigation";
import { DesignEditor } from "@/components/design-editor";
import { requireSeller } from "@/lib/auth";
import { getDesignEditorData } from "@/lib/dashboard-data";

export default async function DesignPage({searchParams}:{searchParams:Promise<{raw?:string;design?:string}>}){
  const user=await requireSeller();const {raw,design}=await searchParams;if(!raw)notFound();
  const data=await getDesignEditorData(raw,design,user.user.id);if(!data.rawProducts[0])notFound();
  return <DesignEditor data={data}/>;
}
