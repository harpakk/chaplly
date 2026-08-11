"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  encryptWooSecret,
  getWooConnectionForOrganization,
  normalizeWooSiteUrl,
  wooRequest,
} from "@/lib/woocommerce";
import { createZarinpalPayment } from "@/lib/zarinpal";
import type { ActionResult } from "@/app/actions/dashboard";

const fail = (message: string): ActionResult => ({ ok: false, message });

export async function connectWooCommerceAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const context = await requireSeller();
  const organizationId = context.membership.organization.id;
  const storeId = context.membership.organization.stores[0]?.id;
  if (!storeId) return fail("فروشگاه فروشنده پیدا نشد.");
  const key = String(formData.get("consumerKey") || "").trim();
  const secret = String(formData.get("consumerSecret") || "").trim();
  if (!key.startsWith("ck_") || !secret.startsWith("cs_"))
    return fail("Consumer Key و Consumer Secret ووکامرس معتبر نیستند.");
  let siteUrl: string;
  try { siteUrl = await normalizeWooSiteUrl(String(formData.get("siteUrl") || "")); }
  catch (error) { return fail(error instanceof Error ? error.message : "آدرس فروشگاه معتبر نیست."); }
  const priceDivisor = String(formData.get("priceUnit")) === "IRR" ? 1 : 10;
  const webhookSecret = randomBytes(32).toString("base64url");
  const db = createSupabaseAdmin();
  const { data: connection, error } = await db.from("woocommerce_connections").upsert({
    organization_id: organizationId,
    store_id: storeId,
    site_url: siteUrl,
    consumer_key_encrypted: encryptWooSecret(key),
    consumer_secret_encrypted: encryptWooSecret(secret),
    webhook_secret_encrypted: encryptWooSecret(webhookSecret),
    status: "CONNECTING",
    price_divisor: priceDivisor,
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id" }).select("*").single();
  if (error || !connection) return fail("ذخیره اتصال ووکامرس انجام نشد.");
  try {
    await wooRequest(connection, "products?per_page=1");
    const webhookBody = {
      name: "Chaplly order import",
      topic: "order.created",
      delivery_url: `https://chaplly.ir/api/woocommerce/orders/${connection.id}`,
      secret: webhookSecret,
      status: "active",
    };
    const webhook = connection.webhook_id
      ? await wooRequest<{ id: number }>(connection, `webhooks/${connection.webhook_id}`, { method: "PUT", body: webhookBody })
      : await wooRequest<{ id: number }>(connection, "webhooks", { method: "POST", body: webhookBody });
    await db.from("woocommerce_connections").update({ status: "CONNECTED", webhook_id: webhook.id, last_error: null, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", connection.id);
    revalidatePath("/seller/dashboard");
    return { ok: true, message: "فروشگاه متصل شد و وب‌هوک سفارش‌ها فعال شد." };
  } catch (connectionError) {
    const message = connectionError instanceof Error ? connectionError.message : "ارتباط با ووکامرس ناموفق بود.";
    await db.from("woocommerce_connections").update({ status: "ERROR", last_error: message, updated_at: new Date().toISOString() }).eq("id", connection.id);
    return fail(`اتصال ذخیره شد اما تأیید نشد: ${message}`);
  }
}

export async function disconnectWooCommerceAction(_: ActionResult, __: FormData): Promise<ActionResult> {
  void _;
  void __;
  const context = await requireSeller();
  const connection = await getWooConnectionForOrganization(context.membership.organization.id);
  if (!connection) return { ok: true, message: "اتصالی وجود ندارد." };
  if (connection.webhook_id) {
    try { await wooRequest(connection, `webhooks/${connection.webhook_id}?force=true`, { method: "DELETE" }); } catch {}
  }
  await createSupabaseAdmin().from("woocommerce_connections").update({ status: "DISCONNECTED", webhook_id: null, updated_at: new Date().toISOString() }).eq("id", connection.id);
  revalidatePath("/seller/dashboard");
  return { ok: true, message: "اتصال ووکامرس غیرفعال شد." };
}

export async function fundWooCommerceImportAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const context = await requireSeller();
  const importId = String(formData.get("importId") || "");
  const db = createSupabaseAdmin();
  const { data: imported } = await db.from("woocommerce_order_imports").select("id,organization_id,external_order_number,required_amount,funded_amount,status").eq("id", importId).eq("organization_id", context.membership.organization.id).maybeSingle();
  if (!imported || ["CONVERTED","IGNORED","CANCELLED"].includes(imported.status)) return fail("سفارش واردشده قابل شارژ نیست.");
  const useEarnings = String(formData.get("useEarnings") || "") === "on";
  if (useEarnings) {
    const { error } = await db.rpc("service_apply_woocommerce_earnings", { p_import_id: importId });
    if (error) return fail(`برداشت از درآمد قابل تسویه انجام نشد: ${error.message}`);
  }
  const { data: refreshed, error: refreshError } = await db.from("woocommerce_order_imports").select("required_amount,funded_amount,status").eq("id", importId).single();
  if (refreshError || !refreshed) return fail("به‌روزرسانی وضعیت تأمین هزینه سفارش انجام نشد.");
  const remaining = Math.max(0, Number(refreshed.required_amount) - Number(refreshed.funded_amount));
  if (!remaining) {
    revalidatePath("/seller/dashboard");
    return { ok: true, message: "هزینه سفارش کامل تأمین شد و آماده ساخت است." };
  }
  const { data: pendingPayment } = await db.from("woocommerce_funding_payments").select("authority").eq("import_id", importId).eq("status", "PENDING").not("authority", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (pendingPayment?.authority)
    return { ok: true, message: "ادامه پرداخت قبلی…", id: importId, detail: `https://payment.zarinpal.com/pg/StartPay/${encodeURIComponent(pendingPayment.authority)}` };
  const idempotencyKey = `woo-funding:${importId}:${randomUUID()}`;
  const { data: payment, error: paymentError } = await db.from("woocommerce_funding_payments").insert({ import_id: importId, organization_id: context.membership.organization.id, amount: remaining, status: "CREATED", idempotency_key: idempotencyKey }).select("id").single();
  if (paymentError) return fail("ساخت پرداخت شارژ کانال انجام نشد.");
  try {
    const requested = await createZarinpalPayment({
      amount: remaining,
      description: `تأمین هزینه سفارش ووکامرس ${imported.external_order_number}`,
      callbackUrl: "https://chaplly.ir/api/payments/zarinpal/woocommerce/callback",
    });
    await db.from("woocommerce_funding_payments").update({ authority: requested.authority, status: "PENDING", response_payload: requested.response }).eq("id", payment.id);
    return { ok: true, message: "در حال انتقال به زرین‌پال…", id: importId, detail: requested.url };
  } catch (error) {
    await db.from("woocommerce_funding_payments").update({ status: "FAILED" }).eq("id", payment.id);
    return fail(error instanceof Error ? error.message : "درگاه زرین‌پال پاسخ نداد.");
  }
}

export async function createWooCommercePlatformOrderAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const context = await requireSeller();
  const importId = String(formData.get("importId") || "");
  const db = createSupabaseAdmin();
  const { data: imported } = await db.from("woocommerce_order_imports").select("id,status,organization_id,external_order_number").eq("id", importId).eq("organization_id", context.membership.organization.id).maybeSingle();
  if (!imported) return fail("سفارش ووکامرس پیدا نشد.");
  const { data, error } = await db.rpc("service_convert_woocommerce_import", { p_import_id: importId, p_buyer_user_id: context.user.id });
  if (error) return fail(`ساخت سفارش انجام نشد: ${error.message}`);
  revalidatePath("/seller/dashboard");
  return { ok: true, message: `سفارش ووکامرس ${imported.external_order_number} به ${Array.isArray(data) ? data.length.toLocaleString("fa-IR") : "۱"} سفارش تولید تبدیل شد.` };
}
