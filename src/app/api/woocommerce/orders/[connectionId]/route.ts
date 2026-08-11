import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptWooSecret } from "@/lib/woocommerce";
import type { Json } from "@/types/database";

type JsonObject = { [key: string]: Json | undefined };

function isJson(value: unknown): value is Json {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJson);
  return typeof value === "object" && Object.values(value).every(isJson);
}

function objectValue(value: Json | undefined): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params;
  const raw = await request.text();
  const signature = request.headers.get("x-wc-webhook-signature") || "";
  const deliveryId = request.headers.get("x-wc-webhook-delivery-id") || createHmac("sha256", "delivery").update(raw).digest("hex");
  const topic = request.headers.get("x-wc-webhook-topic") || "";
  const db = createSupabaseAdmin();
  const { data: connection } = await db.from("woocommerce_connections").select("*").eq("id", connectionId).eq("status", "CONNECTED").maybeSingle();
  if (!connection) return NextResponse.json({ error: "connection_not_found" }, { status: 404 });
  const expected = createHmac("sha256", decryptWooSecret(connection.webhook_secret_encrypted)).update(raw).digest("base64");
  const valid = Buffer.byteLength(signature) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!isJson(parsed) || !parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  const payload = parsed;
  const { data: event, error: eventError } = await db.from("woocommerce_webhook_events").insert({ connection_id: connection.id, delivery_id: deliveryId, topic, signature, payload }).select("id").single();
  if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (eventError) return NextResponse.json({ error: "event_storage_failed" }, { status: 500 });
  if (topic && topic !== "order.created") {
    await db.from("woocommerce_webhook_events").update({ status: "IGNORED", processed_at: new Date().toISOString() }).eq("id", event.id);
    return NextResponse.json({ received: true, ignored: true });
  }
  try {
    const { data: priorImport } = await db.from("woocommerce_order_imports").select("id").eq("connection_id", connection.id).eq("external_order_id", Number(payload.id)).maybeSingle();
    if (priorImport) {
      await db.from("woocommerce_webhook_events").update({ status: "PROCESSED", processed_at: new Date().toISOString() }).eq("id", event.id);
      return NextResponse.json({ received: true, duplicate_order: true });
    }
    const lines = Array.isArray(payload.line_items)
      ? payload.line_items.filter((line): line is JsonObject => Boolean(line) && typeof line === "object" && !Array.isArray(line))
      : [];
    const { data: productLinks } = await db.from("woocommerce_product_links").select("id,woo_product_id").eq("connection_id", connection.id).eq("status", "ACTIVE");
    const linkIds = (productLinks || []).map((item) => item.id);
    const { data: variantLinks } = linkIds.length ? await db.from("woocommerce_variant_links").select("product_link_id,seller_product_variant_id,woo_variation_id").in("product_link_id", linkIds) : { data: [] };
    const productMap = new Map((productLinks || []).map((item) => [Number(item.woo_product_id), item]));
    const variationMap = new Map((variantLinks || []).map((item) => [Number(item.woo_variation_id), item.seller_product_variant_id]));
    const mapped = lines.flatMap((line) => {
      let variantId = Number(line.variation_id) ? variationMap.get(Number(line.variation_id)) : null;
      if (!variantId) {
        const productLink = productMap.get(Number(line.product_id));
        const candidates = (variantLinks || []).filter((item) => item.product_link_id === productLink?.id);
        if (candidates.length === 1) variantId = candidates[0].seller_product_variant_id;
      }
      return variantId ? [{ line, variantId }] : [];
    });
    const variantIds = [...new Set(mapped.map((item) => item.variantId))];
    const { data: variants } = variantIds.length ? await db.from("seller_product_variants").select("id,seller_product_id,supplier_offer_variant_id,supplier_offer_variants!seller_product_variants_supplier_offer_variant_id_fkey(unit_cost)").in("id", variantIds) : { data: [] };
    const variantMap = new Map((variants || []).map((item) => [item.id, item]));
    const importedItems = mapped.flatMap(({ line, variantId }) => {
      const variant = variantMap.get(variantId);
      const relation = Array.isArray(variant?.supplier_offer_variants) ? variant.supplier_offer_variants[0] : variant?.supplier_offer_variants;
      return variant && relation ? [{ external_product_id: Number(line.product_id), external_variation_id: Number(line.variation_id) || null, seller_product_variant_id: variant.id, quantity: Math.max(1, Number(line.quantity) || 1), unit_cost: Number(relation.unit_cost), item_snapshot: line }] : [];
    });
    const shipping = objectValue(payload.shipping ?? payload.billing);
    const billing = objectValue(payload.billing);
    const required = importedItems.reduce((sum, item) => sum + item.unit_cost * item.quantity, 0);
    const { data: imported, error: importError } = await db.from("woocommerce_order_imports").insert({
      connection_id: connection.id, organization_id: connection.organization_id,
      external_order_id: Number(payload.id), external_order_number: String(payload.number || payload.id),
      status: importedItems.length ? "NEW" : "IGNORED", required_amount: required,
      customer_snapshot: { name: `${billing.first_name || ""} ${billing.last_name || ""}`.trim(), email: billing.email || null, phone: billing.phone || null, source: "WOOCOMMERCE" },
      shipping_address_snapshot: { recipientName: `${shipping.first_name || ""} ${shipping.last_name || ""}`.trim(), phone: billing.phone || null, province: shipping.state || "", city: shipping.city || "", addressLine: [shipping.address_1, shipping.address_2].filter(Boolean).join("، "), postalCode: shipping.postcode || "", country: shipping.country || "" },
      raw_payload: payload,
    }).select("id").single();
    if (importError || !imported) throw importError ?? new Error("order_import_failed");
    if (importedItems.length) await db.from("woocommerce_order_import_items").insert(importedItems.map((item) => ({ ...item, import_id: imported.id })));
    await db.from("woocommerce_webhook_events").update({ status: importedItems.length ? "PROCESSED" : "IGNORED", processed_at: new Date().toISOString() }).eq("id", event.id);
    return NextResponse.json({ received: true, matched_items: importedItems.length });
  } catch (error) {
    await db.from("woocommerce_webhook_events").update({ status: "FAILED", error_message: error instanceof Error ? error.message : "import_failed", processed_at: new Date().toISOString() }).eq("id", event.id);
    return NextResponse.json({ error: "import_failed" }, { status: 500 });
  }
}
