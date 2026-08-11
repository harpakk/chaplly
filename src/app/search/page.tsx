import type { Metadata } from "next";
import { BrowseView } from "@/components/browse-view";
import { getBrowseData } from "@/lib/catalog-data";
import { getCurrentUser } from "@/lib/auth";
import { getWishlistProductIds } from "@/lib/dashboard-data";

export const metadata: Metadata = { title: "جست‌وجو و کشف محصولات" };
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const [data,user]=await Promise.all([getBrowseData(),getCurrentUser()]);
  const likedProductIds=await getWishlistProductIds(user?.id);
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  return <BrowseView {...data} params={params} likedProductIds={likedProductIds} title={query ? `نتایج «${query}»` : "همه محصولات"} />;
}
