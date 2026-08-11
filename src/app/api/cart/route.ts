import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getProducts } from "@/lib/catalog-data";

export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET() {
  const auth = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await auth.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (claimsError || !userId)
    return response({ authenticated: false, items: [] }, 401);
  const db = createSupabaseAdmin();
  const { data: cart, error: cartError } = await db
    .from("carts")
    .select("id")
    .eq("buyer_user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (cartError) return response({ error: "CART_READ_FAILED" }, 503);
  if (!cart) return response({ authenticated: true, items: [] });
  const { data: stored, error } = await db
    .from("cart_items")
    .select("seller_product_variant_id,quantity")
    .eq("cart_id", cart.id)
    .order("created_at");
  if (error) return response({ error: "CART_READ_FAILED" }, 503);
  const products = await getProducts();
  const productByVariant = new Map(
    products.flatMap((product) =>
      product.variants.map((variant) => [variant.id, { product, variant }] as const),
    ),
  );
  const items = (stored || []).flatMap((row) => {
    const match = productByVariant.get(row.seller_product_variant_id);
    if (!match) return [];
    return [
      {
        productId: match.product.id,
        variantId: match.variant.id,
        slug: match.product.slug,
        title: match.product.title,
        image: match.product.image,
        price: match.variant.price,
        color: match.variant.color,
        size: match.variant.size,
        quantity: row.quantity,
      },
    ];
  });
  return response({ authenticated: true, items });
}

export async function POST(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const origin = request.headers.get("origin");
  if (
    process.env.DEPLOYMENT_ENV === "production" &&
    (!origin || !configuredOrigin || new URL(origin).origin !== new URL(configuredOrigin).origin)
  )
    return response({ error: "INVALID_ORIGIN" }, 403);
  const db = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await db.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (claimsError || !userId)
    return response({ authenticated: false }, 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: "INVALID_JSON" }, 400);
  }
  const rawItems =
    body && typeof body === "object" && "items" in body
      ? (body as { items: unknown }).items
      : null;
  if (!Array.isArray(rawItems) || rawItems.length > 100)
    return response({ error: "INVALID_CART" }, 400);
  const items = rawItems.map((item) => ({
    variantId:
      item && typeof item === "object" && "variantId" in item
        ? String(item.variantId)
        : "",
    quantity:
      item && typeof item === "object" && "quantity" in item
        ? Number(item.quantity)
        : 0,
  })).filter(
    (item) =>
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(item.variantId) &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 99,
  );
  const { data, error } = await db.rpc("sync_buyer_cart", { p_items: items });
  if (error)
    return response(
      { error: error.message === "RATE_LIMIT_EXCEEDED" ? error.message : "CART_SYNC_FAILED" },
      error.message === "RATE_LIMIT_EXCEEDED" ? 429 : 400,
    );
  return response({ authenticated: true, cartId: data });
}
