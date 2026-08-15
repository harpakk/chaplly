import { notFound } from "next/navigation";
import { getStorefrontData } from "@/lib/catalog-data";
import { StorefrontLanding } from "@/components/exclusive-storefront";

export default async function StorePage({ params }: { params: Promise<{slug:string}> }) {
  const slug = (await params).slug;
  const data=await getStorefrontData(slug);
  if (!data) notFound();
  return <StorefrontLanding store={data.store} products={data.products} reels={data.reels} />;
}
