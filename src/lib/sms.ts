import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const ENDPOINT = "https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber";
const RETRY_DELAYS_MINUTES = [5, 30, 180];

export type SmsPayload = Record<string, string | number | null | undefined>;

function normalizePhone(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^989\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return "";
}

export async function sendMeliPayamakPattern(input: {
  to: string;
  patternId: number;
  values: string[];
}) {
  const username = process.env.MELIPAYAMAK_USERNAME;
  const password = process.env.MELIPAYAMAK_API_KEY;
  if (!username || !password) throw new Error("MELIPAYAMAK_CREDENTIALS_MISSING");
  const to = normalizePhone(input.to);
  if (!to) throw new Error("INVALID_RECIPIENT_PHONE");
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      username,
      password,
      text: input.values.map((value) => String(value).replace(/;/g, "،")).join(";"),
      to,
      bodyId: input.patternId,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let result: { Value?: string; RetStatus?: number; StrRetStatus?: string } = {};
  try { result = JSON.parse(raw); } catch { throw new Error(`MELIPAYAMAK_INVALID_RESPONSE:${response.status}`); }
  const providerId = String(result.Value || "");
  if (!response.ok || result.RetStatus !== 1 || !/^\d{16,}$/.test(providerId))
    throw new Error(`MELIPAYAMAK_${providerId || result.StrRetStatus || response.status}`);
  return { providerId, response: result as Json };
}

export async function queueSms(input: {
  eventType: string;
  recipientUserId?: string | null;
  recipientPhone?: string | null;
  payload: SmsPayload;
  idempotencyKey: string;
  availableAt?: string;
}) {
  const db = createSupabaseAdmin();
  const phone = normalizePhone(input.recipientPhone);
  if (!phone && !input.recipientUserId) return null;
  const { data: config } = await db.from("sms_event_configs").select("event_type,enabled,pattern_id").eq("event_type", input.eventType).maybeSingle();
  if (!config?.enabled || !config.pattern_id) return null;
  if (input.recipientUserId) {
    const { data: preference } = await db.from("notification_preferences").select("enabled").eq("user_id", input.recipientUserId).eq("event_type", input.eventType).eq("channel", "SMS").maybeSingle();
    if (preference?.enabled === false) return null;
  }
  const resolvedPhone = phone || normalizePhone((await db.from("profiles").select("phone").eq("id", input.recipientUserId!).maybeSingle()).data?.phone);
  if (!resolvedPhone) return null;
  const { data, error } = await db.from("notification_outbox").upsert({
    event_type: input.eventType,
    recipient_user_id: input.recipientUserId || null,
    recipient_phone: resolvedPhone,
    payload: input.payload as Json,
    idempotency_key: input.idempotencyKey,
    available_at: input.availableAt || new Date().toISOString(),
  }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

export async function dispatchSmsOutbox(limit = 50) {
  const db = createSupabaseAdmin();
  const { data: rows, error } = await db.from("notification_outbox")
    .select("id,event_type,recipient_phone,payload,attempts")
    .eq("status", "PENDING").lte("available_at", new Date().toISOString())
    .order("available_at").limit(limit);
  if (error) throw error;
  let sent = 0, failed = 0;
  for (const row of rows || []) {
    const attempt = row.attempts + 1;
    const { data: config } = await db.from("sms_event_configs").select("enabled,pattern_id,variable_keys").eq("event_type", row.event_type).maybeSingle();
    if (!config?.enabled || !config.pattern_id) {
      await db.from("notification_outbox").update({ status: "CANCELLED", last_error: "SMS_EVENT_DISABLED" }).eq("id", row.id);
      continue;
    }
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload as Record<string, unknown> : {};
    try {
      const result = await sendMeliPayamakPattern({ to: row.recipient_phone || "", patternId: Number(config.pattern_id), values: config.variable_keys.map((key) => String(payload[key] ?? "")) });
      await Promise.all([
        db.from("notification_outbox").update({ status: "SENT", attempts: attempt, sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id),
        db.from("notification_deliveries").insert({ outbox_id: row.id, channel: "SMS", provider: "MELIPAYAMAK", provider_message_id: result.providerId, attempt_number: attempt, status: "SENT", provider_response: result.response }),
      ]);
      sent++;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "SMS_SEND_FAILED";
      const terminal = attempt >= RETRY_DELAYS_MINUTES.length;
      const availableAt = new Date(Date.now() + RETRY_DELAYS_MINUTES[Math.min(attempt - 1, RETRY_DELAYS_MINUTES.length - 1)] * 60000).toISOString();
      await Promise.all([
        db.from("notification_outbox").update({ status: terminal ? "FAILED" : "PENDING", attempts: attempt, available_at: availableAt, last_error: message }).eq("id", row.id),
        db.from("notification_deliveries").insert({ outbox_id: row.id, channel: "SMS", provider: "MELIPAYAMAK", attempt_number: attempt, status: "FAILED", error_code: message, error_message: message }),
      ]);
      failed++;
    }
  }
  return { processed: (rows || []).length, sent, failed };
}
