import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!source || !supabaseUrl) return new NextResponse("Image URL is required.", { status: 400 });
  let target: URL;
  let allowedOrigin: URL;
  try {
    target = new URL(source);
    allowedOrigin = new URL(supabaseUrl);
  } catch {
    return new NextResponse("Invalid image URL.", { status: 400 });
  }
  if (target.origin !== allowedOrigin.origin || !target.pathname.startsWith("/storage/v1/object/"))
    return new NextResponse("Image source is not allowed.", { status: 403 });
  const response = await fetch(target, { cache: "no-store" }).catch(() => null);
  if (!response) return new NextResponse("Image source is unavailable.", { status: 502 });
  if (!response.ok) return new NextResponse("Image could not be loaded.", { status: response.status });
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/")) return new NextResponse("Source is not an image.", { status: 415 });
  return new NextResponse(response.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
