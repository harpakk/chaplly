import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function ReviewRedirectPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order = "" } = await searchParams;
  const destination = `/account/reviews?order=${encodeURIComponent(order)}&review=1`;
  const user = await getCurrentUser();
  redirect(user ? destination : `/account/login?next=${encodeURIComponent(destination)}`);
}
