import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type WooConnection = {
  id: string;
  organization_id: string;
  store_id: string;
  site_url: string;
  consumer_key_encrypted: string;
  consumer_secret_encrypted: string;
  webhook_secret_encrypted: string;
  webhook_id: number | null;
  price_divisor: number;
  status: string;
};

function encryptionKey() {
  const source = process.env.WOOCOMMERCE_ENCRYPTION_KEY || process.env.ADMIN_COOKIE_SECRET;
  if (!source || source.length < 24) throw new Error("WOOCOMMERCE_ENCRYPTION_KEY is not configured.");
  return createHash("sha256").update(source).digest();
}

export function encryptWooSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptWooSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted WooCommerce credential.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

function privateIp(ip: string) {
  const normalized = ip.replace(/^::ffff:/, "");
  return /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(normalized) ||
    normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

export async function normalizeWooSiteUrl(input: string) {
  const url = new URL(input.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error("آدرس فروشگاه باید HTTPS و بدون نام کاربری، رمز یا پورت اختصاصی باشد.");
  if (isIP(url.hostname) && privateIp(url.hostname)) throw new Error("این آدرس فروشگاه عمومی نیست.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => privateIp(entry.address)))
    throw new Error("آدرس فروشگاه به شبکه خصوصی یا محلی اشاره می‌کند.");
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export async function wooRequest<T>(
  connection: WooConnection,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const endpoint = `${connection.site_url}/wp-json/wc/v3/${path.replace(/^\/+/, "")}`;
  const response = await fetch(endpoint, {
    method: init.method || "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${decryptWooSecret(connection.consumer_key_encrypted)}:${decryptWooSecret(connection.consumer_secret_encrypted)}`).toString("base64")}`,
      "User-Agent": "Chaplly-WooCommerce/1.0",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok)
    throw new Error(
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `WooCommerce HTTP ${response.status}`,
    );
  return payload as T;
}

export async function getWooConnectionForOrganization(organizationId: string) {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("woocommerce_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return data as WooConnection | null;
}

export async function publishProductToWooCommerce(organizationId: string, sellerProductId: string) {
  const connection = await getWooConnectionForOrganization(organizationId);
  if (!connection || connection.status !== "CONNECTED") throw new Error("ابتدا فروشگاه ووکامرس را متصل کنید.");
  const db = createSupabaseAdmin();
  const [{ data: product }, { data: images }, { data: details }, { data: variants }] = await Promise.all([
    db.from("seller_products").select("id,title,slug,subtitle,description,price,discounted_price").eq("id", sellerProductId).single(),
    db.from("product_images").select("sort_order,alt_text,file:storage_files!product_images_file_id_fkey(bucket,path)").eq("seller_product_id", sellerProductId).order("sort_order"),
    db.from("product_details").select("title,value,sort_order").eq("seller_product_id", sellerProductId).order("sort_order"),
    db.from("seller_product_variants").select("id,sku,price,compare_at_price,raw_product_variant_id,status").eq("seller_product_id", sellerProductId).neq("status", "INACTIVE"),
  ]);
  if (!product || !variants?.length) throw new Error("محصول یا تنوع قابل انتشار پیدا نشد.");
  const rawIds = variants.map((item) => item.raw_product_variant_id);
  const { data: rawVariants } = await db.from("raw_product_variants").select("id,color_id,size_id").in("id", rawIds);
  const colorIds = [...new Set((rawVariants || []).map((item) => item.color_id))];
  const sizeIds = [...new Set((rawVariants || []).map((item) => item.size_id))];
  const [{ data: colors }, { data: sizes }, { data: existingRaw }] = await Promise.all([
    db.from("raw_product_colors").select("id,name").in("id", colorIds),
    db.from("raw_product_sizes").select("id,name").in("id", sizeIds),
    db.from("woocommerce_product_links").select("id,woo_product_id").eq("connection_id", connection.id).eq("seller_product_id", sellerProductId).maybeSingle(),
  ]);
  const colorMap = new Map((colors || []).map((item) => [item.id, item.name]));
  const sizeMap = new Map((sizes || []).map((item) => [item.id, item.name]));
  const rawMap = new Map((rawVariants || []).map((item) => [item.id, item]));
  const divisor = connection.price_divisor || 10;
  const money = (value: number | null) => value == null ? undefined : (Number(value) / divisor).toFixed(0);
  const imagePayload = (images || []).flatMap((item) => {
    const file = Array.isArray(item.file) ? item.file[0] : item.file;
    return file?.bucket && file.path ? [{ src: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path.split("/").map(encodeURIComponent).join("/")}`, alt: item.alt_text }] : [];
  });
  const attributes = [
    { name: "رنگ", visible: true, variation: true, options: [...new Set([...colorMap.values()])] },
    { name: "سایز", visible: true, variation: true, options: [...new Set([...sizeMap.values()])] },
  ].filter((item) => item.options.length);
  const body = {
    name: product.title, slug: product.slug, type: "variable", status: "publish",
    description: product.description || "", short_description: product.subtitle || "",
    regular_price: money(Number(product.price)), sale_price: money(product.discounted_price == null ? null : Number(product.discounted_price)),
    images: imagePayload, attributes,
    meta_data: [{ key: "_chaplly_product_id", value: product.id }, ...(details || []).map((item) => ({ key: `chaplly_${item.title}`, value: item.value }))],
  };
  const external = existingRaw
    ? await wooRequest<{ id: number; permalink?: string }>(connection, `products/${existingRaw.woo_product_id}`, { method: "PUT", body })
    : await wooRequest<{ id: number; permalink?: string }>(connection, "products", { method: "POST", body });
  const { data: link, error: linkError } = await db.from("woocommerce_product_links").upsert({ connection_id: connection.id, seller_product_id: sellerProductId, woo_product_id: external.id, status: "ACTIVE", last_error: null, synced_at: new Date().toISOString() }, { onConflict: "connection_id,seller_product_id" }).select("id,woo_product_id").single();
  if (linkError || !link) throw linkError ?? new Error("woocommerce_product_link_failed");
  for (const variant of variants) {
    const raw = rawMap.get(variant.raw_product_variant_id);
    const variationBody = {
      sku: variant.sku,
      regular_price: money(Number(variant.price)),
      ...(variant.compare_at_price ? { sale_price: money(Number(variant.price)), regular_price: money(Number(variant.compare_at_price)) } : {}),
      status: "publish",
      attributes: [
        raw?.color_id ? { name: "رنگ", option: colorMap.get(raw.color_id) } : null,
        raw?.size_id ? { name: "سایز", option: sizeMap.get(raw.size_id) } : null,
      ].filter(Boolean),
      meta_data: [{ key: "_chaplly_variant_id", value: variant.id }],
    };
    const { data: existingVariant } = await db.from("woocommerce_variant_links").select("woo_variation_id").eq("seller_product_variant_id", variant.id).maybeSingle();
    const externalVariant = existingVariant
      ? await wooRequest<{ id: number }>(connection, `products/${external.id}/variations/${existingVariant.woo_variation_id}`, { method: "PUT", body: variationBody })
      : await wooRequest<{ id: number }>(connection, `products/${external.id}/variations`, { method: "POST", body: variationBody });
    await db.from("woocommerce_variant_links").upsert({ product_link_id: link.id, seller_product_variant_id: variant.id, woo_variation_id: externalVariant.id, synced_at: new Date().toISOString() }, { onConflict: "seller_product_variant_id" });
  }
  return { productId: Number(external.id), permalink: String(external.permalink || "") };
}
