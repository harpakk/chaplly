import { NextRequest, NextResponse } from "next/server";
import { queueCompletedReviewSms } from "@/lib/sms-events";
import { dispatchSmsOutbox } from "@/lib/sms";

export const dynamic = "force-dynamic";

async function run(request: NextRequest) {
  const secret = process.env.SMS_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await queueCompletedReviewSms();
  return NextResponse.json(await dispatchSmsOutbox(100));
}

export const POST = run;
export const GET = run;
