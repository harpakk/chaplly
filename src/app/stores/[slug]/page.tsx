import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse-view";
import { getStorefrontData } from "@/lib/catalog-data";
import { ExclusiveStoreHero } from "@/components/exclusive-storefront";

export default async function StorePage({ params, searchParams }: { params: Promise<{slug:string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const slug = (await params).slug;
  const data=await getStorefrontData(slug);
  if (!data) notFound();
  const {store,...browse}=data;
  return <div className="exclusive-store" style={{"--store-color":store.brand_color,"--store-accent":store.accent_color} as React.CSSProperties}>
    <ExclusiveStoreHero store={store}/>
    <BrowseView {...browse} params={await searchParams} fixed={{ shop: slug }} title={store.name} intro={store.description||""}/>
  </div>;
}
