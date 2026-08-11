import { BrowseView } from "@/components/browse-view";
import { getBrowseData } from "@/lib/catalog-data";

export default async function SubcategoryPage({ params, searchParams }: { params: Promise<{slug:string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const slug = (await params).slug;
  const data=await getBrowseData();const name = data.subcategories.find((item) => item.slug === slug)?.name ?? "محصولات";
  return <BrowseView {...data} params={await searchParams} fixed={{ subcategory: slug }} title={name} intro={`${name}‌هایی که شبیه همه‌جا نیستند.`} />;
}
