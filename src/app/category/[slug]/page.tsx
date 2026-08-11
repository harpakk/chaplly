import { BrowseView } from "@/components/browse-view";
import { getBrowseData } from "@/lib/catalog-data";

export default async function CategoryPage({ params, searchParams }: { params: Promise<{slug:string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const slug = (await params).slug;
  const data=await getBrowseData();const name = data.categories.find((item) => item.slug === slug)?.name ?? "دسته‌بندی";
  return <BrowseView {...data} params={await searchParams} fixed={{ category: slug }} title={name} intro={`انتخاب‌های خاص ${name} از فروشگاه‌ها و طراح‌های مستقل.`} />;
}
