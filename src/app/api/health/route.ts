import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const { error } = await createSupabaseAdmin()
      .from("app_releases")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) throw error;
    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        release: process.env.RELEASE_VERSION || "development",
        environment: process.env.DEPLOYMENT_ENV || "development",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        release: process.env.RELEASE_VERSION || "development",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
