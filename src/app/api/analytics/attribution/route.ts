import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const normalizeRef = (value: unknown) =>
  typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/[^\p{L}\p{N}_.-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80).toLowerCase()
    : "";

export async function POST(request: NextRequest) {
  if (/bot|crawler|spider|preview/i.test(request.headers.get("user-agent") || ""))
    return new NextResponse(null, { status: 204 });
  const body = (await request.json().catch(() => null)) as {
    ref?: unknown;
    source?: unknown;
    landing?: unknown;
  } | null;
  const referral = normalizeRef(body?.ref);
  const requestedSource = String(body?.source || "DIRECT").toUpperCase();
  const source = referral
    ? "REFERRAL"
    : (["DIRECT", "GOOGLE", "OTHER"].includes(requestedSource) ? requestedSource : "OTHER");
  const landing = typeof body?.landing === "string" ? body.landing.slice(0, 500) : "/";
  const visitorId = request.cookies.get("chapli_visitor")?.value || randomUUID();
  const salt = process.env.ANALYTICS_VISITOR_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "chapli";
  const visitorHash = createHash("sha256").update(`${salt}:${visitorId}`).digest("hex");
  const db = createSupabaseAdmin();
  const rpc = db.rpc as unknown as (
    name: string,
    args: object,
  ) => Promise<{ error: { message: string } | null }>;
  const { error } = await rpc("record_attribution_visit", {
    p_visitor_hash: visitorHash,
    p_source_type: source,
    p_referral_code: referral || null,
    p_landing_path: landing,
  });
  if (error) console.error("Attribution visit tracking failed", error.message);
  const response = new NextResponse(null, { status: error ? 503 : 204 });
  response.cookies.set("chapli_visitor", visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  const existingReferral = normalizeRef(request.cookies.get("chapli_ref")?.value);
  const existingSource = request.cookies.get("chapli_source")?.value;
  if (referral || !existingSource) {
    response.cookies.set("chapli_source", referral ? "REFERRAL" : source, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 90, path: "/",
    });
    response.cookies.set("chapli_landing", landing, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 90, path: "/",
    });
  }
  if (referral && !existingReferral)
    response.cookies.set("chapli_ref", referral, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 90, path: "/",
    });
  return response;
}
