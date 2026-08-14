import "server-only";
import { cache } from "react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getProducts } from "@/lib/catalog-data";

const n = (value: unknown) => Number(value ?? 0);
const faDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const one = <T>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : (value ?? undefined);
const publicFileUrl = (value: unknown) => {
  const file = one(
    value as
      | { bucket: string; path: string }
      | { bucket: string; path: string }[]
      | null,
  );
  return file?.bucket && file.path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path.split("/").map(encodeURIComponent).join("/")}`
    : null;
};
const publicUrl = (value: unknown) =>
  publicFileUrl(value) || "/images/product-placeholder.png";
type FileRef = { bucket: string; path: string };
type FreeDesignRow = {
  id: string;
  title: string;
  graphic_style_id: string;
  file_id: string;
  status: string;
  sort_order: number;
  is_premium: boolean;
  file: FileRef | FileRef[] | null;
};
const fileRef = (value: unknown): FileRef | undefined =>
  one(value as FileRef | FileRef[] | null);
const fileKey = (value: unknown) => {
  const file = fileRef(value);
  return file?.bucket && file.path ? `${file.bucket}:${file.path}` : null;
};
async function freeDesignRows(
  db: ReturnType<typeof createSupabaseAdmin>,
  activeOnly = false,
) {
  const select = (includePremium: boolean) => {
    let query = db.from("free_designs").select(
      `id,title,graphic_style_id,file_id,status,sort_order${includePremium ? ",is_premium" : ""},file:storage_files!free_designs_file_id_fkey(bucket,path)`,
    );
    if (activeOnly) query = query.eq("status", "ACTIVE");
    return query.order("sort_order").order("created_at", { ascending: false });
  };
  const result = await select(true);
  const missingPremium =
    result.error?.code === "42703" ||
    result.error?.code === "PGRST204" ||
    Boolean(result.error?.message?.includes("is_premium"));
  if (!missingPremium)
    return {
      ...result,
      data: result.data as unknown as FreeDesignRow[] | null,
    };
  const fallback = await select(false);
  return {
    ...fallback,
    data:
      fallback.data?.map((item) => ({
        ...(item as unknown as Omit<FreeDesignRow, "is_premium">),
        is_premium: false,
      })) || null,
  };
}
const signedFileUrls = async (
  db: ReturnType<typeof createSupabaseAdmin>,
  values: unknown[],
) => {
  const files = new Map<string, FileRef>();
  for (const value of values) {
    const file = fileRef(value);
    const key = fileKey(file);
    if (file && key) files.set(key, file);
  }
  const urls = new Map<string, string | null>();
  const privateBuckets = new Map<string, FileRef[]>();
  for (const [key, file] of files) {
    if (file.bucket === "product-images" || file.bucket === "variant-mockups")
      urls.set(key, publicFileUrl(file));
    else
      privateBuckets.set(file.bucket, [
        ...(privateBuckets.get(file.bucket) || []),
        file,
      ]);
  }
  await Promise.all(
    [...privateBuckets].map(async ([bucket, bucketFiles]) => {
      const { data, error } = await db.storage
        .from(bucket)
        .createSignedUrls(
          bucketFiles.map((file) => file.path),
          60 * 60,
        );
      if (error) return;
      for (const item of data || [])
        urls.set(`${bucket}:${item.path}`, item.signedUrl || null);
    }),
  );
  return urls;
};
const primaryRawMediaUrls = async (
  db: ReturnType<typeof createSupabaseAdmin>,
  media: Array<{ raw_product_id: string; file: unknown }>,
) => {
  const firstByProduct = new Map<string, unknown>();
  for (const item of media)
    if (!firstByProduct.has(item.raw_product_id))
      firstByProduct.set(item.raw_product_id, item.file);
  const resolved = await signedFileUrls(db, [...firstByProduct.values()]);
  return new Map(
    [...firstByProduct].map(([rawProductId, file]) => [
      rawProductId,
      (fileKey(file) && resolved.get(fileKey(file)!)) || null,
    ]),
  );
};
export const getSellerStoreRecord = cache(async (storeId: string) => {
  const result = await createSupabaseAdmin()
    .from("stores")
    .select(
      "id,name,slug,status,description,support_email,support_phone,social_url,brand_color,brand_tone,follower_count,is_verified,logo:storage_files!stores_logo_file_id_fkey(bucket,path),banner:storage_files!stores_banner_file_id_fkey(bucket,path),store_domains(hostname,status,domain_type)",
    )
    .eq("id", storeId)
    .single();
  return result;
});

async function getReviewOpportunities(userId: string) {
  const db = createSupabaseAdmin();
  const eligibleBefore = new Date(
    Date.now() - 2 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: orders, error: ordersError } = await db
    .from("orders")
    .select("id,number,completed_at,updated_at")
    .eq("buyer_user_id", userId)
    .eq("status", "DONE")
    .or(
      `completed_at.lte.${eligibleBefore},and(completed_at.is.null,updated_at.lte.${eligibleBefore})`,
    );
  if (ordersError) throw new Error(ordersError.message);
  const orderIds = (orders || []).map((order) => order.id);
  if (!orderIds.length) return [];
  const [itemsResult, reviewsResult] = await Promise.all([
    db
      .from("order_items")
      .select(
        "id,order_id,seller_product_id,product_snapshot,seller_products(id,title,slug,product_images(is_primary,sort_order,file:storage_files!product_images_file_id_fkey(bucket,path)))",
      )
      .in("order_id", orderIds)
      .not("seller_product_id", "is", null),
    db.from("reviews").select("order_item_id").eq("buyer_user_id", userId),
  ]);
  if (itemsResult.error || reviewsResult.error)
    throw new Error(itemsResult.error?.message || reviewsResult.error?.message);
  const reviewed = new Set(
    (reviewsResult.data || []).map((item) => item.order_item_id),
  );
  const orderMap = new Map((orders || []).map((order) => [order.id, order]));
  return (itemsResult.data || [])
    .filter((item) => !reviewed.has(item.id))
    .map((item) => {
      const product = one(item.seller_products);
      const images = [...(product?.product_images || [])].sort(
        (a, b) =>
          Number(b.is_primary) - Number(a.is_primary) ||
          a.sort_order - b.sort_order,
      );
      const snapshot = item.product_snapshot as {
        title?: string;
        image?: string;
      } | null;
      return {
        orderItemId: item.id,
        productId: item.seller_product_id!,
        orderNumber: orderMap.get(item.order_id)?.number || "",
        title: product?.title || snapshot?.title || "محصول",
        slug: product?.slug || "",
        image:
          publicFileUrl(images[0]?.file) ||
          snapshot?.image ||
          "/images/product-placeholder.png",
      };
    });
}

export async function getBuyerAccountData(userId: string) {
  const db = createSupabaseAdmin();
  const [
    profileResult,
    ordersResult,
    wishlistResult,
    recentResult,
    reelSavesResult,
    products,
    reviewOpportunities,
  ] = await Promise.all([
    db
      .from("profiles")
      .select("first_name,last_name,email")
      .eq("id", userId)
      .single(),
    db
      .from("orders")
      .select("id,number,status,total,created_at,updated_at,paid_at")
      .eq("buyer_user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("wishlist_items")
      .select("seller_product_id,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("recent_product_views")
      .select("seller_product_id,viewed_at,view_count")
      .eq("user_id", userId)
      .order("viewed_at", { ascending: false }),
    db
      .from("reel_saves")
      .select(
        "reel_id,reel_posts(id,caption,like_count,save_count,stores(name,slug),seller_products(slug),storage_files(bucket,path))",
      )
      .eq("user_id", userId),
    getProducts(),
    getReviewOpportunities(userId),
  ]);
  for (const result of [
    profileResult,
    ordersResult,
    wishlistResult,
    recentResult,
    reelSavesResult,
  ])
    if (result.error) throw new Error(result.error.message);
  if (!profileResult.data) throw new Error("Buyer profile not found.");
  const productById = new Map(products.map((item) => [item.id, item]));
  return {
    profile: profileResult.data,
    orders: (ordersResult.data || []).map((item) => ({
      ...item,
      total: n(item.total),
      createdLabel: faDate(item.created_at),
    })),
    wishlist: (wishlistResult.data || []).flatMap(
      (item) => productById.get(item.seller_product_id) ?? [],
    ),
    recent: (recentResult.data || []).flatMap(
      (item) => productById.get(item.seller_product_id) ?? [],
    ),
    recommendations: products.slice(0, 4),
    reviewOpportunities,
    savedReels: (reelSavesResult.data || []).flatMap((item) => {
      const reel = one(item.reel_posts);
      if (!reel) return [];
      const store = one(reel.stores),
        product = one(reel.seller_products);
      return [
        {
          id: reel.id,
          shopSlug: store?.slug || "",
          shopName: store?.name || "چاپلی",
          handle: `@${store?.slug || "chapli"}`,
          productSlug: product?.slug || "",
          caption: reel.caption,
          media: publicUrl(reel.storage_files),
          likes: Number(reel.like_count),
          saves: Number(reel.save_count),
        },
      ];
    }),
  };
}

export async function getBuyerWalletData(userId: string) {
  const db = createSupabaseAdmin();
  const [walletResult, preferenceResult, transactionsResult, refundsResult, profileResult] = await Promise.all([
    db.from("buyer_wallets").select("balance,currency,updated_at").eq("user_id", userId).maybeSingle(),
    db.from("buyer_refund_preferences").select("destination,card_number,updated_at").eq("user_id", userId).maybeSingle(),
    db.from("buyer_wallet_transactions").select("id,order_id,refund_id,direction,amount,description,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    db.from("refunds").select("id,order_id,amount,status,destination,destination_card_number,transfer_reference,requested_at,processed_at,receipt_file_id,orders(number),receipt:storage_files!refunds_receipt_file_id_fkey(bucket,path)").eq("requested_by", userId).order("requested_at", { ascending: false }),
    db.from("profiles").select("first_name,last_name").eq("id", userId).single(),
  ]);
  for (const result of [walletResult, preferenceResult, transactionsResult, refundsResult, profileResult])
    if (result.error) throw new Error(result.error.message);
  const receiptUrls = await signedFileUrls(db, (refundsResult.data || []).map((item) => item.receipt));
  return {
    profile: profileResult.data,
    balance: n(walletResult.data?.balance),
    preference: preferenceResult.data || { destination: "WALLET", card_number: null },
    transactions: (transactionsResult.data || []).map((item) => ({ ...item, amount: n(item.amount) })),
    refunds: (refundsResult.data || []).map((item) => ({
      ...item,
      amount: n(item.amount),
      receiptUrl: (fileKey(item.receipt) && receiptUrls.get(fileKey(item.receipt)!)) || null,
    })),
  };
}

export async function getBuyerSectionData(userId: string) {
  const db = createSupabaseAdmin();
  const [addresses, reviews, profile, reviewOpportunities] = await Promise.all([
    db
      .from("buyer_addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at"),
    db
      .from("reviews")
      .select(
        "id,rating,title,body,pros,cons,is_anonymous,status,is_verified_purchase,created_at,seller_products(title,slug)",
      )
      .eq("buyer_user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("profiles")
      .select("first_name,last_name,email,phone,locale,primary_role,created_at")
      .eq("id", userId)
      .single(),
    getReviewOpportunities(userId),
  ]);
  if (addresses.error || reviews.error || profile.error)
    throw new Error(
      addresses.error?.message ||
        reviews.error?.message ||
        profile.error?.message,
    );
  return {
    addresses: addresses.data || [],
    reviews: reviews.data || [],
    profile: profile.data,
    reviewOpportunities,
  };
}

export async function getWishlistProductIds(userId?: string) {
  if (!userId) return [] as string[];
  const { data, error } = await createSupabaseAdmin()
    .from("wishlist_items")
    .select("seller_product_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data || []).map((item) => item.seller_product_id);
}

export async function getProductReels(productId: string) {
  const { data, error } = await createSupabaseAdmin()
    .from("reel_posts")
    .select("id,caption,like_count,save_count,stores(name,slug),seller_products(slug),storage_files(bucket,path)")
    .eq("seller_product_id", productId)
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((reel) => {
    const store = one(reel.stores), product = one(reel.seller_products);
    return {
      id: reel.id,
      shopSlug: store?.slug || "",
      shopName: store?.name || "چاپلی",
      handle: `@${store?.slug || "chapli"}`,
      productSlug: product?.slug || "",
      caption: reel.caption,
      media: publicUrl(reel.storage_files),
      likes: Number(reel.like_count),
      saves: Number(reel.save_count),
    };
  });
}

export async function getSellerReelUploadData(storeId: string) {
  const db = createSupabaseAdmin();
  const [products, reels] = await Promise.all([
    db.from("seller_products").select("id,title,slug").eq("store_id", storeId).eq("status", "PUBLISHED").eq("moderation_status", "APPROVED").order("title"),
    db.from("reel_posts").select("id,caption,status,published_at,seller_products(title),storage_files(bucket,path)").eq("store_id", storeId).order("created_at", { ascending: false }),
  ]);
  if (products.error || reels.error) throw new Error(products.error?.message || reels.error?.message);
  return {
    products: products.data || [],
    reels: (reels.data || []).map((reel) => ({ ...reel, media: publicUrl(reel.storage_files), productTitle: one(reel.seller_products)?.title || "محصول" })),
  };
}

export async function getProductReviews(productId: string) {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("reviews")
    .select(
      "id,buyer_user_id,rating,title,body,pros,cons,is_anonymous,is_verified_purchase,created_at,buyer:profiles!reviews_buyer_user_id_fkey(first_name,last_name),review_images(sort_order,file:storage_files!review_images_file_id_fkey(bucket,path))",
    )
    .eq("seller_product_id", productId)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((review) => {
    const buyer = one(review.buyer);
    return {
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      pros: review.pros,
      cons: review.cons,
      is_verified_purchase: review.is_verified_purchase,
      created_at: review.created_at,
      displayName: review.is_anonymous
        ? "خریدار ناشناس"
        : [buyer?.first_name, buyer?.last_name].filter(Boolean).join(" ") ||
          "خریدار چاپلی",
      images: [...(review.review_images || [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((image) => publicFileUrl(image.file))
        .filter((url): url is string => Boolean(url)),
    };
  });
}

export async function getAdminReviewData() {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("reviews")
    .select(
      "id,rating,title,body,pros,cons,is_anonymous,is_verified_purchase,status,created_at,buyer:profiles!reviews_buyer_user_id_fkey(first_name,last_name),seller_products(title,slug),review_images(sort_order,file:storage_files!review_images_file_id_fkey(bucket,path))",
    )
    .eq("status", "PENDING")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data || []).map((review) => ({
    ...review,
    images: [...(review.review_images || [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => publicFileUrl(image.file))
      .filter((url): url is string => Boolean(url)),
  }));
}

export async function getAdminTaxonomyData() {
  const db = createSupabaseAdmin();
  const [categories, graphicStyles] = await Promise.all([
    db.from("categories").select("id,parent_id,slug,name,description,status,sort_order,image_file_id,image:storage_files!categories_image_file_id_fkey(bucket,path)").order("sort_order").order("name"),
    db.from("graphic_styles").select("id,slug,name,caption,status,sort_order,image_file_id,image:storage_files!graphic_styles_image_file_id_fkey(bucket,path)").order("sort_order").order("name"),
  ]);
  if (categories.error || graphicStyles.error) throw new Error(categories.error?.message || graphicStyles.error?.message);
  return {
    categories: (categories.data || []).map((item) => ({ ...item, imageUrl: publicFileUrl(item.image) })),
    graphicStyles: (graphicStyles.data || []).map((item) => ({ ...item, imageUrl: publicFileUrl(item.image) })),
  };
}

export async function getSupplierSignupOptions() {
  const db = createSupabaseAdmin();
  const [methods, categories] = await Promise.all([
    db
      .from("print_methods")
      .select("id,name,description")
      .eq("status", "ACTIVE")
      .order("name"),
    db
      .from("categories")
      .select("id,name,parent_id")
      .eq("status", "ACTIVE")
      .order("sort_order")
      .order("name"),
  ]);
  if (methods.error || categories.error)
    throw new Error(methods.error?.message || categories.error?.message);
  return {
    printMethods: methods.data || [],
    categories: categories.data || [],
  };
}

export async function getReelInteractionIds(userId?: string) {
  if (!userId) return { liked: [], saved: [] };
  const db = createSupabaseAdmin();
  const [liked, saved] = await Promise.all([
    db.from("reel_likes").select("reel_id").eq("user_id", userId),
    db.from("reel_saves").select("reel_id").eq("user_id", userId),
  ]);
  if (liked.error || saved.error)
    throw new Error(liked.error?.message || saved.error?.message);
  return {
    liked: (liked.data || []).map((item) => item.reel_id),
    saved: (saved.data || []).map((item) => item.reel_id),
  };
}

export async function getOrderDetail(number: string, userId?: string) {
  const db = createSupabaseAdmin();
  let query = db
    .from("orders")
    .select(
      "id,number,buyer_user_id,status,subtotal,shipping_amount,discount_amount,tax_amount,total,currency,customer_snapshot,shipping_address_snapshot,created_at,updated_at,paid_at",
    )
    .eq("number", number);
  if (userId) query = query.eq("buyer_user_id", userId);
  const { data: order, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return null;
  const [itemsResult, fulfilmentsResult] = await Promise.all([
    db
      .from("order_items")
      .select("id,seller_product_id,seller_product_variant_id,raw_product_variant_id,quantity,unit_price,line_total,product_snapshot,design_snapshot")
      .eq("order_id", order.id),
    db
      .from("fulfilments")
      .select(
        "id,status,tracking_code,created_at,sent_at,done_at,fulfilment_items(order_item_id,quantity),fulfilment_status_events(from_status,to_status,occurred_at),shipments(carrier,tracking_code,status,shipped_at,delivered_at)",
      )
      .eq("order_id", order.id),
  ]);
  if (itemsResult.error || fulfilmentsResult.error)
    throw new Error(
      itemsResult.error?.message || fulfilmentsResult.error?.message,
    );
  const itemIds = (itemsResult.data || []).map((item) => item.id);
  const [cancellationsResult, returnsResult, disputesResult] =
    await Promise.all([
      db
        .from("order_cancellations")
        .select("id,reason,status,review_message,requested_at,reviewed_at")
        .eq("order_id", order.id)
        .order("requested_at", { ascending: false }),
      itemIds.length
        ? db
            .from("return_requests")
            .select(
              "id,order_item_id,reason,description,status,resolution,requested_at",
            )
            .in("order_item_id", itemIds)
            .order("requested_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      db
        .from("disputes")
        .select(
          "id,order_item_id,reason,description,status,resolution,opened_at",
        )
        .eq("order_id", order.id)
        .order("opened_at", { ascending: false }),
    ]);
  if (cancellationsResult.error || returnsResult.error || disputesResult.error)
    throw new Error(
      cancellationsResult.error?.message ||
        returnsResult.error?.message ||
        disputesResult.error?.message,
    );
  return {
    ...order,
    subtotal: n(order.subtotal),
    shipping_amount: n(order.shipping_amount),
    discount_amount: n(order.discount_amount),
    tax_amount: n(order.tax_amount),
    total: n(order.total),
    items: (itemsResult.data || []).map((item) => ({
      ...item,
      unit_price: n(item.unit_price),
      line_total: n(item.line_total),
    })),
    fulfilments: fulfilmentsResult.data || [],
    cancellations: cancellationsResult.data || [],
    returns: returnsResult.data || [],
    disputes: disputesResult.data || [],
  };
}

export async function getSellerProductEditData(
  productId: string,
  storeId: string,
) {
  const db = createSupabaseAdmin();
  const { data: product, error } = await db
    .from("seller_products")
    .select(
      "id,store_id,raw_product_id,design_id,primary_supplier_offer_id,backup_supplier_offer_id,title,slug,subtitle,description,price,discounted_price,gender,status,moderation_status,seo_title,seo_description,version",
    )
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!product) return null;
  const [detailsResult, offersResult, stylesResult, selectedStylesResult, variantsResult] = await Promise.all([
    db
      .from("product_details")
      .select("id,title,value,sort_order")
      .eq("seller_product_id", product.id)
      .order("sort_order")
      .limit(20),
    db
      .from("supplier_offers")
      .select(
        "id,base_cost,lead_time_days,capacity_per_day,organization:organizations(display_name)",
      )
      .eq("raw_product_id", product.raw_product_id)
      .eq("approval_status", "APPROVED")
      .eq("status", "ACTIVE")
      .order("base_cost")
      .limit(100),
    db.from("graphic_styles").select("id,name,caption").eq("status", "ACTIVE").order("sort_order"),
    db.from("product_graphic_styles").select("graphic_style_id").eq("seller_product_id", product.id),
    db.from("seller_product_variants").select("raw_product_variant_id,price,raw_product_variants(raw_product_colors(name),raw_product_sizes(name))").eq("seller_product_id", product.id),
  ]);
  if (detailsResult.error || offersResult.error || stylesResult.error || selectedStylesResult.error || variantsResult.error)
    throw new Error(
      detailsResult.error?.message || offersResult.error?.message || stylesResult.error?.message || selectedStylesResult.error?.message || variantsResult.error?.message,
    );
  return {
    product: {
      ...product,
      gender: product.gender || "UNISEX",
      price: n(product.price),
      discounted_price:
        product.discounted_price == null ? null : n(product.discounted_price),
    },
    details: detailsResult.data || [],
    graphicStyles: stylesResult.data || [],
    selectedGraphicStyleIds: (selectedStylesResult.data || []).map((item) => item.graphic_style_id),
    variantPrices: (variantsResult.data || []).map((item) => {
      const rawVariant = Array.isArray(item.raw_product_variants) ? item.raw_product_variants[0] : item.raw_product_variants;
      const color = Array.isArray(rawVariant?.raw_product_colors) ? rawVariant.raw_product_colors[0] : rawVariant?.raw_product_colors;
      const size = Array.isArray(rawVariant?.raw_product_sizes) ? rawVariant.raw_product_sizes[0] : rawVariant?.raw_product_sizes;
      return { rawProductVariantId: item.raw_product_variant_id, price: n(item.price), label: `${color?.name || "رنگ استاندارد"} · ${size?.name || "سایز استاندارد"}` };
    }),
    suppliers: (offersResult.data || []).map((item) => ({
      ...item,
      base_cost: n(item.base_cost),
    })),
  };
}

export async function getSellerDashboardData(
  organizationId: string,
  storeId: string,
  userId: string,
  section:
    | "finance"
    | "accounts"
    | "store"
    | "products"
    | "woocommerce"
    | "tutorials"
    | "all" = "all",
) {
  const db = createSupabaseAdmin();
  const needsFinance = section === "all" || section === "finance";
  const needsAccounts =
    section === "all" || section === "accounts" || section === "finance";
  const needsProducts = section === "all" || section === "products" || section === "store";
  const needsWooCommerce = section === "all" || section === "woocommerce";
  const needsTutorials = section === "all" || section === "tutorials";
  const emptyMany = Promise.resolve({ data: [], error: null });
  const emptyOne = Promise.resolve({ data: null, error: null });
  const [
    balanceResult,
    earningsResult,
    payoutsResult,
    banksResult,
    storeResult,
    productsResult,
    tutorialsResult,
    progressResult,
    cancelledOrdersResult,
  ] = await Promise.all([
    needsFinance ? db
      .from("balance_projections")
      .select("pending,available,reserved,currency,updated_at")
      .eq("organization_id", organizationId)
      .maybeSingle() : emptyOne,
    needsFinance ? db
      .from("earnings")
      .select(
        "id,earning_type,status,gross_amount,fee_amount,net_amount,paid_amount,created_at,available_at,order_id,orders(number,status),order_items(product_snapshot,quantity)",
      )
      .eq("beneficiary_organization_id", organizationId)
      .order("created_at", { ascending: false }) : emptyMany,
    needsFinance ? db
      .from("payout_requests")
      .select(
        "id,amount,status,requested_at,processed_at,payout_payment_history(receipt_text,reference,paid_at)",
      )
      .eq("organization_id", organizationId)
      .order("requested_at", { ascending: false }) : emptyMany,
    needsAccounts ? db
      .from("bank_accounts")
      .select("id,bank_name,card_number,iban,priority,status,account_holder_name")
      .eq("organization_id", organizationId)
      .order("priority") : emptyMany,
    getSellerStoreRecord(storeId),
    needsProducts ? db
      .from("seller_products")
      .select(
        "id,slug,title,status,moderation_status,price,discounted_price,sales_count,view_count,rating_average,review_count,created_at,updated_at,raw_product_id,design_id,primary_supplier_offer_id,backup_supplier_offer_id,product_images(is_primary,sort_order,file:storage_files!product_images_file_id_fkey(bucket,path)),seller_product_variants(id,status,raw_product_variant_id,supplier_offer_variants!seller_product_variants_supplier_offer_variant_id_fkey(stock_quantity,stock_status))",
      )
      .eq("store_id", storeId)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false }) : emptyMany,
    needsTutorials ? db
      .from("tutorials")
      .select(
        "id,title,summary,description,learning_outcomes,content,difficulty,duration_minutes,sort_order,thumbnail:storage_files!tutorials_thumbnail_file_id_fkey(bucket,path),video:storage_files!tutorials_video_file_id_fkey(bucket,path)",
      )
      .eq("status", "PUBLISHED")
      .order("sort_order") : emptyMany,
    needsTutorials ? db
      .from("tutorial_progress")
      .select("tutorial_id,completed,progress_percent,completed_at")
      .eq("user_id", userId) : emptyMany,
    needsFinance ? db
      .from("order_items")
      .select("id,order_id,product_snapshot,orders!inner(number,status,updated_at)")
      .eq("seller_organization_id", organizationId)
      .eq("orders.status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(50) : emptyMany,
  ]);
  for (const result of [
    balanceResult,
    earningsResult,
    payoutsResult,
    banksResult,
    storeResult,
    productsResult,
    tutorialsResult,
    progressResult,
    cancelledOrdersResult,
  ])
    if (result.error) throw new Error(result.error.message);
  if (!storeResult.data) throw new Error("Seller store not found.");
  const rawProductIds = [
    ...new Set((productsResult.data || []).map((item) => item.raw_product_id)),
  ];
  const offersResult = rawProductIds.length
    ? await db
        .from("supplier_offers")
        .select(
          "id,raw_product_id,base_cost,lead_time_days,capacity_per_day,organization:organizations(display_name)",
        )
        .in("raw_product_id", rawProductIds)
        .eq("approval_status", "APPROVED")
        .eq("status", "ACTIVE")
        .order("base_cost")
        .limit(500)
    : { data: [], error: null };
  if (offersResult.error) throw new Error(offersResult.error.message);
  const progress = new Map(
    (progressResult.data || []).map((item) => [item.tutorial_id, item]),
  );
  const earnings = earningsResult.data || [];
  const [wooConnectionResult, wooImportsResult, wooAccountResult] = needsWooCommerce
    ? await Promise.all([
        db.from("woocommerce_connections").select("id,site_url,status,webhook_id,price_divisor,last_error,last_verified_at,updated_at").eq("organization_id", organizationId).maybeSingle(),
        db.from("woocommerce_order_imports").select("id,external_order_id,external_order_number,status,customer_snapshot,shipping_address_snapshot,required_amount,funded_amount,platform_order_ids,imported_at,converted_at,woocommerce_order_import_items(id,quantity,unit_cost,item_snapshot,seller_product_variant_id)").eq("organization_id", organizationId).order("imported_at", { ascending: false }).limit(100),
        db.from("woocommerce_channel_accounts").select("balance,currency,updated_at").eq("organization_id", organizationId).maybeSingle(),
      ])
    : [{ data: null, error: null }, { data: [], error: null }, { data: null, error: null }];
  if (wooConnectionResult.error || wooImportsResult.error || wooAccountResult.error)
    throw new Error(wooConnectionResult.error?.message || wooImportsResult.error?.message || wooAccountResult.error?.message);
  return {
    woocommerce: {
      connection: wooConnectionResult.data,
      channelBalance: n(wooAccountResult.data?.balance),
      imports: (wooImportsResult.data || []).map((item) => ({
        ...item,
        required_amount: n(item.required_amount),
        funded_amount: n(item.funded_amount),
        itemCount: (item.woocommerce_order_import_items || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      })),
    },
    cancelledOrders: cancelledOrdersResult.data || [],
    balance: {
      pending: n(balanceResult.data?.pending),
      available: n(balanceResult.data?.available),
      reserved: n(balanceResult.data?.reserved),
      paid: earnings.reduce((sum, item) => sum + n(item.paid_amount), 0),
      currency: balanceResult.data?.currency || "IRR",
    },
    earnings: earnings.map((item) => ({
      ...item,
      gross_amount: n(item.gross_amount),
      fee_amount: n(item.fee_amount),
      net_amount: n(item.net_amount),
    })),
    totals: {
      gross: earnings.reduce((sum, item) => sum + n(item.gross_amount), 0),
      net: earnings.reduce((sum, item) => sum + n(item.net_amount), 0),
      last30: earnings
        .filter(
          (item) =>
            new Date(item.created_at) > new Date(Date.now() - 30 * 86400000),
        )
        .reduce((sum, item) => sum + n(item.net_amount), 0),
    },
    payouts: (payoutsResult.data || []).map((item) => ({
      ...item,
      amount: n(item.amount),
    })),
    banks: banksResult.data || [],
    store: {
      ...storeResult.data,
      logoUrl: publicFileUrl(storeResult.data.logo),
      bannerUrl: publicFileUrl(storeResult.data.banner),
      hostname:
        (storeResult.data.store_domains || []).find(
          (domain) =>
            domain.status === "ACTIVE" && domain.domain_type === "SUBDOMAIN",
        )?.hostname || null,
    },
    products: (productsResult.data || []).map((item) => {
      const images = [...(item.product_images || [])].sort(
        (a, b) =>
          Number(b.is_primary) - Number(a.is_primary) ||
          a.sort_order - b.sort_order,
      );
      return {
        ...item,
        mainImageUrl: publicFileUrl(images[0]?.file),
        price: n(item.price),
        discounted_price:
          item.discounted_price == null ? null : n(item.discounted_price),
        sales_count: n(item.sales_count),
        view_count: n(item.view_count),
        rating_average: n(item.rating_average),
      };
    }),
    supplierOffers: (offersResult.data || []).map((item) => ({
      ...item,
      base_cost: n(item.base_cost),
    })),
    tutorials: (tutorialsResult.data || []).map((item) => ({
      ...item,
      thumbnailUrl: publicUrl(item.thumbnail),
      videoUrl: publicFileUrl(item.video),
      steps: Array.isArray(item.content)
        ? item.content.flatMap((step) => {
            if (!step || typeof step !== "object" || Array.isArray(step))
              return [];
            const title = "title" in step ? String(step.title || "") : "";
            const body = "body" in step ? String(step.body || "") : "";
            return title && body ? [{ title, body }] : [];
          })
        : [],
      progress: progress.get(item.id) || {
        completed: false,
        progress_percent: 0,
      },
    })),
  };
}

export async function getSupplierDashboardData(
  organizationId: string,
  section: "orders" | "raw-products" | "financial" | "all" = "all",
) {
  const db = createSupabaseAdmin();
  const needsOrders = section === "all" || section === "orders";
  const needsRawProducts = section === "all" || section === "raw-products";
  const needsFinancial = section === "all" || section === "financial";
  const emptyMany = Promise.resolve({ data: [], error: null });
  const emptyOne = Promise.resolve({ data: null, error: null });
  const [
    fulfilmentsResult,
    itemsResult,
    ordersResult,
    orderItemsResult,
    balanceResult,
    earningsResult,
    payoutsResult,
    rawsResult,
    offersResult,
    offerVariantsResult,
    colorsResult,
    sizesResult,
    variantsResult,
    rawMediaResult,
    filesResult,
    banksResult,
  ] = await Promise.all([
    needsOrders ? db
      .from("fulfilments")
      .select(
        "id,order_id,facility_id,supplier_offer_id,status,tracking_code,due_at,created_at,sent_at,auto_complete_at,assignment_snapshot",
      )
      .eq("supplier_organization_id", organizationId)
      .order("created_at", { ascending: true })
      .limit(100) : emptyMany,
    needsOrders
      ? db.from("fulfilment_items").select("fulfilment_id,order_item_id,quantity")
      : emptyMany,
    needsOrders ? db
      .from("orders")
      .select(
        "id,number,customer_snapshot,shipping_address_snapshot,created_at,status,paid_at",
      ) : emptyMany,
    needsOrders ? db
      .from("order_items")
      .select(
        "id,order_id,seller_product_id,raw_product_variant_id,quantity,cost_snapshot,product_snapshot,design_snapshot,seller_products(product_images(is_primary,sort_order,file:storage_files!product_images_file_id_fkey(bucket,path)))",
      ) : emptyMany,
    needsFinancial ? db
      .from("balance_projections")
      .select("pending,available,reserved,currency")
      .eq("organization_id", organizationId)
      .maybeSingle() : emptyOne,
    needsFinancial ? db
      .from("earnings")
      .select(
        "id,status,gross_amount,fee_amount,net_amount,paid_amount,order_id,fulfilment_id,created_at,available_at,orders(number,status),order_items(product_snapshot,quantity)",
      )
      .eq("beneficiary_organization_id", organizationId)
      .order("created_at", { ascending: false }) : emptyMany,
    needsFinancial ? db
      .from("payout_requests")
      .select(
        "id,amount,status,requested_at,processed_at,payout_payment_history(reference,paid_at)",
      )
      .eq("organization_id", organizationId)
      .order("requested_at", { ascending: false }) : emptyMany,
    needsRawProducts || needsOrders ? db
      .from("raw_products")
      .select("id,name,description,base_cost,has_back,status,category_id")
      .eq("status", "ACTIVE")
      .order("created_at") : emptyMany,
    needsRawProducts ? db
      .from("supplier_offers")
      .select(
        "id,raw_product_id,status,approval_status,base_cost,lead_time_days,capacity_per_day",
      )
      .eq("supplier_organization_id", organizationId) : emptyMany,
    needsRawProducts ? db
      .from("supplier_offer_variants")
      .select(
        "id,supplier_offer_id,raw_product_variant_id,stock_quantity,stock_status,unit_cost",
      ) : emptyMany,
    needsRawProducts
      ? db
          .from("raw_product_colors")
          .select("id,raw_product_id,name")
          .eq("status", "ACTIVE")
      : emptyMany,
    needsRawProducts
      ? db
          .from("raw_product_sizes")
          .select("id,raw_product_id,name")
          .eq("status", "ACTIVE")
      : emptyMany,
    needsRawProducts || needsOrders ? db
      .from("raw_product_variants")
      .select("id,raw_product_id,color_id,size_id,status") : emptyMany,
    needsRawProducts || needsOrders ? db
      .from("raw_product_media")
      .select(
        "raw_product_id,is_primary,sort_order,file:storage_files!raw_product_media_file_id_fkey(bucket,path)",
      )
      .order("is_primary", { ascending: false })
      .order("sort_order") : emptyMany,
    needsOrders ? db
      .from("fulfilment_files")
      .select(
        "file_id,fulfilment_id,purpose,storage_files(bucket,path,original_name,mime_type)",
      ) : emptyMany,
    needsFinancial ? db
      .from("bank_accounts")
      .select("id,bank_name,card_number,iban,priority,status")
      .eq("organization_id", organizationId)
      .eq("status", "ACTIVE")
      .order("priority") : emptyMany,
  ]);
  for (const result of [
    fulfilmentsResult,
    itemsResult,
    ordersResult,
    orderItemsResult,
    balanceResult,
    earningsResult,
    payoutsResult,
    rawsResult,
    offersResult,
    offerVariantsResult,
    colorsResult,
    sizesResult,
    variantsResult,
    rawMediaResult,
    filesResult,
    banksResult,
  ])
    if (result.error) throw new Error(result.error.message);
  const designFileIds = new Set<string>();
  for (const row of orderItemsResult.data || []) {
    const snapshot = row.design_snapshot;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
      continue;
    for (const document of Object.values(snapshot)) {
      if (
        !document ||
        typeof document !== "object" ||
        Array.isArray(document) ||
        !("objects" in document)
      )
        continue;
      const objects = (document as { objects?: unknown }).objects;
      if (!Array.isArray(objects)) continue;
      for (const object of objects)
        if (
          object &&
          typeof object === "object" &&
          "storageFileId" in object &&
          object.storageFileId
        )
          designFileIds.add(String(object.storageFileId));
    }
  }
  const designFilesResult = designFileIds.size
    ? await db
        .from("storage_files")
        .select("id,bucket,path")
        .in("id", [...designFileIds])
    : { data: [], error: null };
  if (designFilesResult.error) throw new Error(designFilesResult.error.message);
  const resolvedDesignUrls = await signedFileUrls(
    db,
    designFilesResult.data || [],
  );
  const designUrls = new Map(
    (designFilesResult.data || []).flatMap((file) => {
      const url = fileKey(file) && resolvedDesignUrls.get(fileKey(file)!);
      return url ? [[file.id, url] as const] : [];
    }),
  );
  const fulfilmentFileUrls = await signedFileUrls(
    db,
    (filesResult.data || []).map((file) => file.storage_files),
  );
  const resolveDesignSnapshot = (snapshot: unknown) => {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
      return snapshot;
    return Object.fromEntries(
      Object.entries(snapshot).map(([side, document]) => {
        if (
          !document ||
          typeof document !== "object" ||
          Array.isArray(document) ||
          !("objects" in document)
        )
          return [side, document];
        const typed = document as { objects?: Array<Record<string, unknown>> };
        return [
          side,
          {
            ...typed,
            objects: (typed.objects || []).map((object) => ({
              ...object,
              src: object.storageFileId
                ? designUrls.get(String(object.storageFileId)) || object.src
                : object.src,
            })),
          },
        ];
      }),
    );
  };
  const fulfilmentItems = itemsResult.data || [],
    orders = new Map((ordersResult.data || []).map((item) => [item.id, item]));
  const rawMainImages = await primaryRawMediaUrls(
    db,
    rawMediaResult.data || [],
  );
  const orderItems = new Map(
    (orderItemsResult.data || []).map((item) => [item.id, item]),
  );
  const fulfilments = (fulfilmentsResult.data || [])
    .filter((item) => Boolean(orders.get(item.order_id)?.paid_at))
    .map((item) => {
      const links = fulfilmentItems.filter(
        (row) => row.fulfilment_id === item.id,
      );
      const linkedItems = links.flatMap((link) => {
        const orderItem = orderItems.get(link.order_item_id);
        if (!orderItem) return [];
      const rawProductId = (variantsResult.data || []).find(
        (variant) => variant.id === orderItem.raw_product_variant_id,
      )?.raw_product_id;
      return [
        {
          ...orderItem,
          design_snapshot: resolveDesignSnapshot(orderItem.design_snapshot),
          fulfilmentQuantity: link.quantity,
          rawProductName: (rawsResult.data || []).find(
            (raw) => raw.id === rawProductId,
          )?.name,
          mainImageUrl:
            publicFileUrl(
              [...(one(orderItem.seller_products)?.product_images || [])].sort(
                (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
              )[0]?.file,
            ) || (rawProductId ? rawMainImages.get(rawProductId) || null : null),
        },
      ];
    });
    const orderItem = linkedItems[0];
    const earningGross = linkedItems.reduce(
      (sum, linked) =>
        sum + n(linked.cost_snapshot) * Number(linked.fulfilmentQuantity || 1),
      0,
    );
    const earningFee = Math.trunc((earningGross * 7) / 100);
    return {
      ...item,
      order: orders.get(item.order_id),
      item: orderItem,
      rawProductName: orderItem?.rawProductName,
      items: linkedItems,
      files: (filesResult.data || [])
        .filter((file) => file.fulfilment_id === item.id)
        .map((file) => ({
          ...file,
          url:
            (fileKey(file.storage_files) &&
              fulfilmentFileUrls.get(fileKey(file.storage_files)!)) ||
            "",
        })),
      earningGross,
      earningFee,
      earning: item.status === "CANCELLED" ? 0 : earningGross - earningFee,
    };
  });
  const offers = new Map(
    (offersResult.data || []).map((item) => [
      item.raw_product_id,
      {
        ...item,
        variants: (offerVariantsResult.data || []).filter(
          (variant) => variant.supplier_offer_id === item.id,
        ),
      },
    ]),
  );
  const supplierEarnings = earningsResult.data || [];
  return {
    fulfilments,
    balance: {
      pending: n(balanceResult.data?.pending),
      available: n(balanceResult.data?.available),
      reserved: n(balanceResult.data?.reserved),
      paid: supplierEarnings.reduce((sum, item) => sum + n(item.paid_amount), 0),
      currency: balanceResult.data?.currency || "IRR",
    },
    earnings: supplierEarnings.map((item) => ({
      ...item,
      gross_amount: n(item.gross_amount),
      fee_amount: n(item.fee_amount),
      net_amount: n(item.net_amount),
    })),
    payouts: (payoutsResult.data || []).map((item) => ({
      ...item,
      amount: n(item.amount),
    })),
    banks: banksResult.data || [],
    rawProducts: (rawsResult.data || []).map((raw) => {
      const variants = (variantsResult.data || []).filter(
        (item) => item.raw_product_id === raw.id && item.status === "ACTIVE",
      );
      return {
        ...raw,
        base_cost: n(raw.base_cost),
        mainImageUrl: rawMainImages.get(raw.id) || null,
        offer: offers.get(raw.id),
        colors: (colorsResult.data || []).filter(
          (item) => item.raw_product_id === raw.id,
        ),
        sizes: (sizesResult.data || []).filter(
          (item) => item.raw_product_id === raw.id,
        ),
        variants,
        colorCount: new Set(variants.map((item) => item.color_id)).size,
        sizeCount: new Set(variants.map((item) => item.size_id)).size,
      };
    }),
  };
}

export async function getAdminDashboardData(
  section:
    | "dashboard"
    | "financial"
    | "raw-products"
    | "pending-products"
    | "orders"
    | "settings"
    | "all" = "all",
) {
  const db = createSupabaseAdmin();
  const needsOverview = section === "all" || section === "dashboard";
  const needsFinancial = section === "all" || section === "financial";
  const needsRawProducts = section === "all" || section === "raw-products";
  const needsModeration = section === "all" || section === "pending-products";
  const needsOrders = section === "all" || section === "orders";
  const needsSettings = section === "all" || section === "settings";
  const emptyMany = Promise.resolve({ data: [], error: null });
  const emptyOne = Promise.resolve({ data: null, error: null });
  const [
    payoutsResult,
    organizationsResult,
    banksResult,
    payoutItemsResult,
    earningsResult,
    rawsResult,
    colorsResult,
    sizesResult,
    rawViewsResult,
    rawViewFilesResult,
    rawVariantsResult,
    rawAssetsResult,
    rawMediaResult,
    pendingResult,
    productsResult,
    storesResult,
    ordersResult,
    orderItemsResult,
    reasonsResult,
    categoriesResult,
    cancellationsResult,
    returnsResult,
    disputesResult,
    fulfilmentExceptionsResult,
  ] = await Promise.all([
    needsFinancial || needsOverview ? db
      .from("payout_requests")
      .select("id,organization_id,bank_account_id,amount,status,requested_at")
      .eq("status", "REQUESTED")
      .order("requested_at") : emptyMany,
    needsFinancial || needsOverview || needsRawProducts ? db
      .from("organizations")
      .select("id,type,display_name,legal_name")
      .order("display_name") : emptyMany,
    needsFinancial ? db
      .from("bank_accounts")
      .select("id,organization_id,bank_name,card_number,iban,priority") : emptyMany,
    needsFinancial ? db
      .from("payout_request_items")
      .select("payout_request_id,earning_id,amount") : emptyMany,
    needsFinancial ? db.from("earnings").select("id,order_id,net_amount,fee_amount,status,earning_type") : emptyMany,
    needsRawProducts || needsOverview ? (async () => {
      const fields = "id,name,slug,description,base_cost,suggested_price,material,weight_grams,sku_prefix,production_notes,has_back,status,category_id,created_at";
      const result = await db.from("raw_products").select(`${fields},size_guide`).order("created_at");
      if (
        result.error?.code !== "42703" &&
        result.error?.code !== "PGRST204"
      )
        return result;
      const fallback = await db.from("raw_products").select(fields).order("created_at");
      return { ...fallback, data: fallback.data?.map((raw) => ({ ...raw, size_guide: null })) || null };
    })() : emptyMany,
    needsRawProducts ? db.from("raw_product_colors").select("raw_product_id,id,name,hex") : emptyMany,
    needsRawProducts ? db.from("raw_product_sizes").select("raw_product_id,id,name") : emptyMany,
    needsRawProducts ? db
      .from("raw_product_views")
      .select(
        "id,raw_product_id,side,print_area_x,print_area_y,print_area_width,print_area_height,background_file_id,overlay_file_id,mockup_file_id",
      ) : emptyMany,
    needsRawProducts ? db
      .from("storage_files")
      .select("id,bucket,path")
      .in("kind", ["RAW_BACKGROUND", "RAW_OVERLAY", "VARIANT_MOCKUP"]) : emptyMany,
    needsRawProducts ? db
      .from("raw_product_variants")
      .select("id,raw_product_id,color_id,size_id,status") : emptyMany,
    needsRawProducts ? db
      .from("raw_product_variant_assets")
      .select(
        "raw_product_variant_id,raw_product_view_id,background:storage_files!raw_product_variant_assets_background_file_id_fkey(bucket,path)",
      ) : emptyMany,
    needsRawProducts ? db
      .from("raw_product_media")
      .select(
        "raw_product_id,is_primary,sort_order,alt_text,file:storage_files!raw_product_media_file_id_fkey(bucket,path)",
      )
      .order("is_primary", { ascending: false })
      .order("sort_order") : emptyMany,
    needsModeration || needsOverview ? db
      .from("product_moderation_queue")
      .select(
        "id,seller_product_id,status,submitted_at,rejection_reason_id,custom_message",
      )
      .eq("status", "PENDING")
      .order("submitted_at") : emptyMany,
    needsModeration ? db
      .from("seller_products")
      .select(
        "id,store_id,raw_product_id,title,price,status,moderation_status,created_at,published_at,product_images(is_primary,sort_order,file:storage_files!product_images_file_id_fkey(bucket,path))",
      ) : emptyMany,
    needsModeration ? db.from("stores").select("id,name,organization_id") : emptyMany,
    needsOrders || needsOverview ? db
      .from("orders")
      .select(
        "id,number,buyer_user_id,status,total,created_at,updated_at,customer_snapshot",
      )
      .order("created_at", { ascending: false })
      .limit(100) : emptyMany,
    needsOrders || needsOverview ? db.from("order_items").select("order_id,id,quantity,seller_product_id,product_snapshot,seller_products(product_images(is_primary,sort_order,file:storage_files!product_images_file_id_fkey(bucket,path)))") : emptyMany,
    needsModeration || needsSettings ? db
      .from("rejection_reasons")
      .select("id,code,title,sms_template_id,sms_templates(body)")
      .eq("status", "ACTIVE")
      .order("sort_order") : emptyMany,
    needsRawProducts ? db
      .from("categories")
      .select("id,name,parent_id")
      .eq("status", "ACTIVE")
      .order("sort_order") : emptyMany,
    needsOrders ? db
      .from("order_cancellations")
      .select(
        "id,order_id,requested_by,reason,status,requested_at,orders(number),requester:profiles!order_cancellations_requested_by_fkey(first_name,last_name)",
      )
      .in("status", ["REQUESTED", "APPROVED"])
      .order("requested_at")
      .limit(100) : emptyMany,
    needsOrders ? db
      .from("return_requests")
      .select(
        "id,order_item_id,buyer_user_id,reason,description,status,requested_at,order_items(order_id,orders(number)),buyer:profiles!return_requests_buyer_user_id_fkey(first_name,last_name)",
      )
      .in("status", ["REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED"])
      .order("requested_at")
      .limit(100) : emptyMany,
    needsOrders ? db
      .from("disputes")
      .select(
        "id,order_id,order_item_id,opened_by,reason,description,status,opened_at,orders(number),opener:profiles!disputes_opened_by_fkey(first_name,last_name)",
      )
      .in("status", ["OPEN", "UNDER_REVIEW"])
      .order("opened_at")
      .limit(100) : emptyMany,
    needsOrders ? db
      .from("fulfilment_exceptions")
      .select(
        "id,fulfilment_id,supplier_organization_id,reported_by,exception_type,description,status,created_at,fulfilments(order_id,orders(number)),organizations(display_name),reporter:profiles!fulfilment_exceptions_reported_by_fkey(first_name,last_name)",
      )
      .in("status", ["OPEN", "ACKNOWLEDGED"])
      .order("created_at")
      .limit(100) : emptyMany,
  ]);
  for (const result of [
    payoutsResult,
    organizationsResult,
    banksResult,
    payoutItemsResult,
    earningsResult,
    rawsResult,
    colorsResult,
    sizesResult,
    rawViewsResult,
    rawViewFilesResult,
    rawVariantsResult,
    rawAssetsResult,
    rawMediaResult,
    pendingResult,
    productsResult,
    storesResult,
    ordersResult,
    orderItemsResult,
    reasonsResult,
    categoriesResult,
    cancellationsResult,
    returnsResult,
    disputesResult,
    fulfilmentExceptionsResult,
  ])
    if (result.error) throw new Error(result.error.message);
  const organizations = new Map(
    (organizationsResult.data || []).map((item) => [item.id, item]),
  );
  const stores = new Map(
    (storesResult.data || []).map((item) => [item.id, item]),
  );
  const products = new Map(
    (productsResult.data || []).map((item) => {
      const images = [...(item.product_images || [])].sort(
        (a, b) =>
          Number(b.is_primary) - Number(a.is_primary) ||
          a.sort_order - b.sort_order,
      );
      return [
        item.id,
        { ...item, mainImageUrl: publicFileUrl(images[0]?.file) },
      ];
    }),
  );
  const earnings = new Map(
    (earningsResult.data || []).map((item) => [item.id, item]),
  );
  const rawBackgroundUrls = new Map<string, string | null>();
  const rawViewBackgroundUrls = new Map<string, string | null>();
  const rawViewFiles = new Map(
    (rawViewFilesResult.data || []).map((file) => [file.id, file]),
  );
  const rawMainImageUrls = await primaryRawMediaUrls(
    db,
    rawMediaResult.data || [],
  );
  const rawAssetFileUrls = await signedFileUrls(db, [
    ...(rawAssetsResult.data || []).map((asset) => asset.background),
    ...(rawViewFilesResult.data || []),
  ]);
  for (const asset of rawAssetsResult.data || [])
    rawBackgroundUrls.set(
      `${asset.raw_product_variant_id}:${asset.raw_product_view_id}`,
      (fileKey(asset.background) &&
        rawAssetFileUrls.get(fileKey(asset.background)!)) ||
        null,
    );
  for (const view of rawViewsResult.data || []) {
    const file = rawViewFiles.get(view.background_file_id || "");
    rawViewBackgroundUrls.set(
      view.id,
      (fileKey(file) && rawAssetFileUrls.get(fileKey(file)!)) || null,
    );
  }
  const [
    knowledgeBaseResult,
    supportAiSettingsResult,
    graphicStylesResult,
    freeDesignsResult,
    supplierOffersResult,
    supplierOfferVariantsResult,
  ] = await Promise.all([
    needsSettings ? db
      .from("support_knowledge_base")
      .select("id,title,category,content,status,source_type,file_name,updated_at")
      .order("updated_at", { ascending: false }) : emptyMany,
    needsSettings ? db
      .from("support_ai_settings")
      .select("model,system_prompt,updated_at")
      .eq("id", "default")
      .maybeSingle() : emptyOne,
    needsSettings ? db
      .from("graphic_styles")
      .select("id,slug,name,caption,status,sort_order")
      .order("sort_order")
      .order("name") : emptyMany,
    needsSettings ? freeDesignRows(db) : emptyMany,
    needsRawProducts ? db
      .from("supplier_offers")
      .select(
        "id,supplier_organization_id,raw_product_id,base_cost,lead_time_days,capacity_per_day,approval_status,status,notes,updated_at",
      )
      .order("updated_at", { ascending: true }) : emptyMany,
    needsRawProducts ? db
      .from("supplier_offer_variants")
      .select(
        "id,supplier_offer_id,raw_product_variant_id,stock_quantity,stock_status,unit_cost",
      ) : emptyMany,
  ]);
  if (
    knowledgeBaseResult.error ||
    supportAiSettingsResult.error ||
    graphicStylesResult.error ||
    freeDesignsResult.error ||
    supplierOffersResult.error ||
    supplierOfferVariantsResult.error
  )
    throw new Error(
      knowledgeBaseResult.error?.message ||
        supportAiSettingsResult.error?.message ||
        graphicStylesResult.error?.message ||
        freeDesignsResult.error?.message ||
        supplierOffersResult.error?.message ||
        supplierOfferVariantsResult.error?.message,
    );
  const freeDesignUrls = await signedFileUrls(
    db,
    (freeDesignsResult.data || []).map((item) => item.file),
  );
  const freeDesigns = (freeDesignsResult.data || []).map((item) => ({
    ...item,
    imageUrl:
      (fileKey(item.file) && freeDesignUrls.get(fileKey(item.file)!)) || "",
  }));
  const [smsConfigsResult, smsOutboxResult] = needsSettings
    ? await Promise.all([
        db.from("sms_event_configs").select("event_type,name,recipient_role,description,pattern_id,variable_keys,enabled,is_required_event,updated_at").order("recipient_role").order("name"),
        db.from("notification_outbox").select("id,event_type,recipient_phone,status,attempts,sent_at,last_error,created_at").order("created_at", { ascending: false }).limit(30),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (smsConfigsResult.error || smsOutboxResult.error)
    throw new Error(smsConfigsResult.error?.message || smsOutboxResult.error?.message);
  let buyerRefundsResult = needsFinancial
    ? await db
        .from("refunds")
        .select("id,order_id,requested_by,amount,status,destination,destination_card_number,requested_at,processed_at,transfer_reference,orders(number),buyer:profiles!refunds_requested_by_fkey(first_name,last_name,email)")
        .eq("destination", "BANK")
        .order("requested_at", { ascending: true })
    : { data: [], error: null };
  if (
    buyerRefundsResult.error &&
    (buyerRefundsResult.error.code === "42703" ||
      /refunds\.(destination|destination_card_number|transfer_reference).*does not exist/i.test(
        buyerRefundsResult.error.message,
      ))
  ) {
    // A deployment may briefly run this application before the buyer-refund
    // migration. Legacy refunds have no bank destination, so there is no bank
    // transfer queue to display until that migration is applied.
    buyerRefundsResult = { data: [], error: null };
  }
  if (buyerRefundsResult.error) throw new Error(buyerRefundsResult.error.message);
  return {
    companyRevenue: (earningsResult.data || []).filter((item) => item.status !== "REVERSED").reduce((sum, item) => sum + n(item.fee_amount), 0),
    buyerRefunds: (buyerRefundsResult.data || []).map((item) => ({ ...item, amount: n(item.amount) })),
    payouts: (payoutsResult.data || []).map((item) => {
      const payoutItems = (payoutItemsResult.data || []).filter(
        (row) => row.payout_request_id === item.id,
      );
      return {
        ...item,
        amount: n(item.amount),
        organization: organizations.get(item.organization_id),
        bank: (banksResult.data || []).find(
          (row) => row.id === item.bank_account_id,
        ),
        orders: payoutItems.flatMap((row) => {
          const earning = earnings.get(row.earning_id);
          return earning
            ? [{ id: earning.order_id, amount: n(row.amount) }]
            : [];
        }),
      };
    }),
    rawProducts: (rawsResult.data || []).map((item) => ({
      ...item,
      base_cost: n(item.base_cost),
      mainImageUrl: rawMainImageUrls.get(item.id) || null,
      colors: (colorsResult.data || []).filter(
        (row) => row.raw_product_id === item.id,
      ),
      sizes: (sizesResult.data || []).filter(
        (row) => row.raw_product_id === item.id,
      ),
      variants: (rawVariantsResult.data || []).filter(
        (row) => row.raw_product_id === item.id && row.status === "ACTIVE",
      ),
      views: (rawViewsResult.data || [])
        .filter((row) => row.raw_product_id === item.id)
        .map((view) => {
          const variantIds = new Set(
            (rawVariantsResult.data || [])
              .filter((variant) => variant.raw_product_id === item.id)
              .map((variant) => variant.id),
          );
          const asset = (rawAssetsResult.data || []).find(
            (candidate) =>
              candidate.raw_product_view_id === view.id &&
              variantIds.has(candidate.raw_product_variant_id),
          );
          return {
            ...view,
            backgroundUrl:
              rawViewBackgroundUrls.get(view.id) ||
              (asset
                ? rawBackgroundUrls.get(
                    `${asset.raw_product_variant_id}:${asset.raw_product_view_id}`,
                  ) || null
                : null),
          };
        }),
    })),
    pending: (pendingResult.data || []).map((queue) => {
      const product = products.get(queue.seller_product_id);
      return {
        ...queue,
        product,
        store: product ? stores.get(product.store_id) : undefined,
      };
    }),
    approved: [...products.values()]
      .filter((product) => product.moderation_status === "APPROVED")
      .map((product) => ({
        ...product,
        store: stores.get(product.store_id),
      })),
    orders: (ordersResult.data || []).map((item) => {
      const items = (orderItemsResult.data || []).filter((row) => row.order_id === item.id);
      const firstProduct = items[0]?.seller_products;
      const product = Array.isArray(firstProduct) ? firstProduct[0] : firstProduct;
      const images = product?.product_images || [];
      const firstImage = [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
      return { ...item, total: n(item.total), items, firstImageUrl: publicFileUrl(firstImage?.file) };
    }),
    rejectionReasons: reasonsResult.data || [],
    smsConfigs: smsConfigsResult.data || [],
    smsOutbox: smsOutboxResult.data || [],
    knowledgeBase: (knowledgeBaseResult.data || []) as Array<{
      id: string;
      title: string;
      category: string;
      content: string;
      status: string;
      source_type: string;
      file_name: string | null;
      updated_at: string;
    }>,
    supportAiSettings: (supportAiSettingsResult.data || null) as {
      model: string;
      system_prompt: string;
      updated_at: string;
    } | null,
    graphicStyles: graphicStylesResult.data || [],
    freeDesigns,
    categories: categoriesResult.data || [],
    supplierOffers: (supplierOffersResult.data || []).map((offer) => ({
      ...offer,
      base_cost: n(offer.base_cost),
      organization: organizations.get(offer.supplier_organization_id),
      rawProduct: (rawsResult.data || []).find(
        (raw) => raw.id === offer.raw_product_id,
      ),
      variants: (supplierOfferVariantsResult.data || []).filter(
        (variant) => variant.supplier_offer_id === offer.id,
      ),
    })),
    exceptions: {
      cancellations: cancellationsResult.data || [],
      returns: returnsResult.data || [],
      disputes: disputesResult.data || [],
      fulfilments: fulfilmentExceptionsResult.data || [],
    },
    stats: {
      openOrders: (ordersResult.data || []).length,
      pendingProducts: (pendingResult.data || []).length,
      payoutCount: (payoutsResult.data || []).length,
      payoutAmount: (payoutsResult.data || []).reduce(
        (sum, item) => sum + n(item.amount),
        0,
      ),
      sellers: (organizationsResult.data || []).filter(
        (item) => item.type === "SELLER",
      ).length,
      suppliers: (organizationsResult.data || []).filter(
        (item) => item.type === "SUPPLIER",
      ).length,
      rawProducts: (rawsResult.data || []).length,
    },
  };
}

export async function getSmsPreferenceData(userId: string, roles: Array<"BUYER" | "SELLER" | "SUPPLIER">) {
  const db = createSupabaseAdmin();
  const [{ data: configs, error: configError }, { data: preferences, error: preferenceError }, { data: profile, error: profileError }] = await Promise.all([
    db.from("sms_event_configs").select("event_type,name,description,recipient_role").in("recipient_role", roles).order("name"),
    db.from("notification_preferences").select("event_type,enabled").eq("user_id", userId).eq("channel", "SMS"),
    db.from("profiles").select("phone").eq("id", userId).maybeSingle(),
  ]);
  if (configError || preferenceError || profileError)
    throw new Error(configError?.message || preferenceError?.message || profileError?.message);
  const selected = new Map((preferences || []).map((item) => [item.event_type, item.enabled]));
  return {
    phone: profile?.phone || null,
    items: (configs || []).map((item) => ({ ...item, enabled: selected.get(item.event_type) !== false })),
  };
}

type AdminDashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;
type AdminOverviewPayload = {
  openOrders?: number;
  pendingProducts?: number;
  payoutCount?: number;
  payoutAmount?: number | string;
  rawProducts?: number;
  sellers?: number;
  suppliers?: number;
  orders?: Array<{
    id: string;
    number: string;
    buyer_user_id: string | null;
    status: string;
    total: number | string;
    created_at: string;
    updated_at?: string;
    customer_snapshot: unknown;
    items?: Array<{
      order_id: string;
      id: string;
      quantity: number;
      seller_product_id: string;
    }>;
  }>;
};

/** Loads the admin landing page in one network round trip. */
export async function getAdminOverviewData(): Promise<AdminDashboardData> {
  const { data, error } = await createSupabaseAdmin().rpc(
    "service_admin_overview",
  );
  if (error) throw new Error(error.message);
  const overview = (data || {}) as AdminOverviewPayload;
  return {
    companyRevenue: 0,
    buyerRefunds: [],
    payouts: [],
    rawProducts: [],
    pending: [],
    approved: [],
    orders: (overview.orders || []).map((order) => ({
      ...order,
      total: n(order.total),
      updated_at: order.updated_at || order.created_at,
      customer_snapshot:
        order.customer_snapshot as AdminDashboardData["orders"][number]["customer_snapshot"],
      items: (order.items || []).map((item) => ({
        ...item,
        seller_product_id: item.seller_product_id || null,
        product_snapshot: null,
        seller_products: null,
      })),
      firstImageUrl: null,
    })),
    rejectionReasons: [],
    smsConfigs: [],
    smsOutbox: [],
    knowledgeBase: [],
    supportAiSettings: null,
    graphicStyles: [],
    freeDesigns: [],
    categories: [],
    supplierOffers: [],
    exceptions: {
      cancellations: [],
      returns: [],
      disputes: [],
      fulfilments: [],
    },
    stats: {
      openOrders: n(overview.openOrders),
      pendingProducts: n(overview.pendingProducts),
      payoutCount: n(overview.payoutCount),
      payoutAmount: n(overview.payoutAmount),
      sellers: n(overview.sellers),
      suppliers: n(overview.suppliers),
      rawProducts: n(overview.rawProducts),
    },
  } as AdminDashboardData;
}

export async function getTicketsData(input: {
  organizationId?: string;
  buyerUserId?: string;
  admin?: boolean;
}) {
  const db = createSupabaseAdmin();
  let query = db
    .from("tickets")
    .select(
      "id,organization_id,opened_by_user_id,subject,category,priority,status,reference_type,reference_id,assignee_id,last_message_at,created_at",
    )
    .order(input.admin ? "created_at" : "last_message_at", {
      ascending: Boolean(input.admin),
    });
  if (input.organizationId)
    query = query.eq("organization_id", input.organizationId);
  if (input.buyerUserId)
    query = query.eq("opened_by_user_id", input.buyerUserId);
  const { data: tickets, error } = await query;
  if (error) throw new Error(error.message);
  const ids = (tickets || []).map((item) => item.id);
  if (!ids.length) return { tickets: [] };
  const [messagesResult, attachmentsResult, profilesResult, draftsResult] = await Promise.all(
    [
      db
        .from("ticket_messages")
        .select("id,ticket_id,sender_id,sender_role,body,visibility,created_at")
        .in("ticket_id", ids)
        .order("created_at"),
      db
        .from("ticket_attachments")
        .select(
          "id,ticket_id,message_id,file_name,mime_type,size_bytes,scan_status,storage_files(bucket,path)",
        )
        .in("ticket_id", ids),
      db.from("profiles").select("id,first_name,last_name,primary_role"),
      input.admin
        ? db
            .from("ticket_ai_drafts")
            .select("ticket_id,draft,source_message_at,updated_at")
            .in("ticket_id", ids)
        : Promise.resolve({ data: [], error: null }),
    ],
  );
  if (messagesResult.error || attachmentsResult.error || profilesResult.error || draftsResult.error)
    throw new Error(
      messagesResult.error?.message ||
        attachmentsResult.error?.message ||
        profilesResult.error?.message ||
        draftsResult.error?.message,
    );
  const profiles = new Map(
    (profilesResult.data || []).map((item) => [item.id, item]),
  );
  const orderedTickets = [...(tickets || [])].sort((a, b) => {
    if (!input.admin) return 0;
    const aClosed = ["RESOLVED", "CLOSED"].includes(a.status);
    const bClosed = ["RESOLVED", "CLOSED"].includes(b.status);
    if (aClosed !== bClosed) return Number(aClosed) - Number(bClosed);
    return aClosed
      ? new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return {
    tickets: orderedTickets.map((item) => ({
      ...item,
      ai_draft:
        (draftsResult.data || []).find(
          (draft: { ticket_id: string }) => draft.ticket_id === item.id,
        )?.draft || "",
      messages: (messagesResult.data || [])
        .filter(
          (message) =>
            message.ticket_id === item.id &&
            (input.admin || message.visibility !== "INTERNAL"),
        )
        .map((message) => ({
          ...message,
          sender: message.sender_id
            ? profiles.get(message.sender_id)
            : undefined,
        })),
      attachments: (attachmentsResult.data || [])
        .filter((file) => file.ticket_id === item.id)
        .map((file) => ({ ...file, url: publicUrl(file.storage_files) })),
    })),
  };
}

export async function getBuyerSupportData(userId: string) {
  const db = createSupabaseAdmin();
  const [tickets, orders] = await Promise.all([
    getTicketsData({ buyerUserId: userId }),
    db.from("orders").select("id,number,status,created_at").eq("buyer_user_id", userId).order("created_at", { ascending: false }),
  ]);
  if (orders.error) throw new Error(orders.error.message);
  return { ...tickets, orders: orders.data || [] };
}

export async function getProductCreationData(rawProductId: string) {
  const db = createSupabaseAdmin();
  const mockupsQuery = async () => {
    const fields = "id,raw_product_id,name,side,status,needs_alignment";
    const result = await db
      .from("raw_product_mockups")
      .select(`${fields},color_id,gender`)
      .eq("raw_product_id", rawProductId)
      .eq("status", "ACTIVE")
      .order("created_at");
    const missingAttributes =
      result.error?.code === "42703" ||
      result.error?.code === "PGRST204" ||
      Boolean(result.error?.message?.includes("color_id"));
    if (!missingAttributes) return result;
    const fallback = await db
      .from("raw_product_mockups")
      .select(fields)
      .eq("raw_product_id", rawProductId)
      .eq("status", "ACTIVE")
      .order("created_at");
    return {
      ...fallback,
      data:
        fallback.data?.map((mockup) => ({
          ...mockup,
          color_id: null,
          gender: "UNISEX",
        })) || null,
    };
  };
  const [
    categoriesResult,
    rawsResult,
    colorsResult,
    sizesResult,
    variantsResult,
    viewsResult,
    viewFilesResult,
    assetsResult,
    mediaResult,
    offersResult,
    offerVariantsResult,
    organizationsResult,
    mockupsResult,
    mockupViewsResult,
    graphicStylesResult,
  ] = await Promise.all([
    db
      .from("categories")
      .select("id,parent_id,slug,name,image:storage_files!categories_image_file_id_fkey(bucket,path)")
      .eq("status", "ACTIVE")
      .order("sort_order"),
    db
      .from("raw_products")
      .select(
        "id,category_id,name,slug,description,base_cost,suggested_price,material,weight_grams,production_notes,has_back,status",
      )
      .eq("id", rawProductId)
      .eq("status", "ACTIVE")
      .order("name"),
    db
      .from("raw_product_colors")
      .select("id,raw_product_id,name,hex")
      .eq("raw_product_id", rawProductId)
      .eq("status", "ACTIVE"),
    db
      .from("raw_product_sizes")
      .select("id,raw_product_id,name")
      .eq("raw_product_id", rawProductId)
      .eq("status", "ACTIVE"),
    db
      .from("raw_product_variants")
      .select("id,raw_product_id,color_id,size_id,sku")
      .eq("raw_product_id", rawProductId)
      .eq("status", "ACTIVE"),
    db
      .from("raw_product_views")
      .select(
        "id,raw_product_id,side,print_area_x,print_area_y,print_area_width,print_area_height,background_file_id,overlay_file_id,mockup_file_id",
      )
      .eq("raw_product_id", rawProductId),
    db
      .from("storage_files")
      .select("id,bucket,path")
      .in("kind", ["RAW_BACKGROUND", "RAW_OVERLAY", "VARIANT_MOCKUP"]),
    db
      .from("raw_product_variant_assets")
      .select(
        "raw_product_variant_id,raw_product_view_id,background_file_id,overlay_file_id,mockup_file_id,background:storage_files!raw_product_variant_assets_background_file_id_fkey(bucket,path),overlay:storage_files!raw_product_variant_assets_overlay_file_id_fkey(bucket,path),mockup:storage_files!raw_product_variant_assets_mockup_file_id_fkey(bucket,path)",
      ),
    db
      .from("raw_product_media")
      .select(
        "raw_product_id,is_primary,sort_order,file:storage_files!raw_product_media_file_id_fkey(bucket,path)",
      )
      .eq("raw_product_id", rawProductId)
      .order("is_primary", { ascending: false })
      .order("sort_order"),
    db
      .from("supplier_offers")
      .select(
        "id,supplier_organization_id,raw_product_id,base_cost,lead_time_days,capacity_per_day,approval_status,status",
      )
      .eq("raw_product_id", rawProductId)
      .eq("approval_status", "APPROVED")
      .eq("status", "ACTIVE"),
    db
      .from("supplier_offer_variants")
      .select(
        "id,supplier_offer_id,raw_product_variant_id,unit_cost,stock_status,stock_quantity",
      )
      .in("stock_status", ["AVAILABLE", "LOW_STOCK"]),
    db
      .from("organizations")
      .select("id,display_name,slug")
      .eq("type", "SUPPLIER")
      .eq("status", "ACTIVE"),
    mockupsQuery(),
    db
      .from("raw_product_mockup_views")
      .select(
        "id,mockup_id,side,background_file_id,area_x,area_y,area_width,area_height,rotation_degrees,perspective_points,artwork_clip",
      ),
    db
      .from("graphic_styles")
      .select("id,slug,name,caption,image:storage_files!graphic_styles_image_file_id_fkey(bucket,path)")
      .eq("status", "ACTIVE")
      .order("sort_order")
      .order("name"),
  ]);
  for (const result of [
    categoriesResult,
    rawsResult,
    colorsResult,
    sizesResult,
    variantsResult,
    viewsResult,
    viewFilesResult,
    assetsResult,
    mediaResult,
    offersResult,
    offerVariantsResult,
    organizationsResult,
    mockupsResult,
    mockupViewsResult,
    graphicStylesResult,
  ])
    if (result.error) throw new Error(result.error.message);
  const raws = (rawsResult.data || []).filter(
    (item) => !rawProductId || item.id === rawProductId,
  );
  const mainImages = await primaryRawMediaUrls(db, mediaResult.data || []);
  const editorViews = new Map<
    string,
    {
      backgroundUrl: string | null;
      overlayUrl: string | null;
      mockupUrl: string | null;
    }
  >();
  const viewFiles = new Map(
    (viewFilesResult.data || []).map((file) => [file.id, file]),
  );
  const editorFileUrls = await signedFileUrls(db, [
    ...(assetsResult.data || []).flatMap((asset) => [
      asset.background,
      asset.overlay,
      asset.mockup,
    ]),
    ...(viewFilesResult.data || []),
  ]);
  const resolvedEditorFile = (file: unknown) =>
    (fileKey(file) && editorFileUrls.get(fileKey(file)!)) || null;
  const editorAssets = (assetsResult.data || []).map((asset) => ({
    ...asset,
    backgroundUrl:
      resolvedEditorFile(asset.background) || "/images/product-placeholder.png",
    overlayUrl: resolvedEditorFile(asset.overlay),
    mockupUrl: resolvedEditorFile(asset.mockup),
  }));
  for (const view of viewsResult.data || [])
    editorViews.set(view.id, {
      backgroundUrl: resolvedEditorFile(
        viewFiles.get(view.background_file_id || ""),
      ),
      overlayUrl: resolvedEditorFile(
        viewFiles.get(view.overlay_file_id || ""),
      ),
      mockupUrl: resolvedEditorFile(
        viewFiles.get(view.mockup_file_id || ""),
      ),
    });
  const supplierStatsResult = await db.rpc("service_supplier_catalog_stats");
  if (supplierStatsResult.error)
    throw new Error(supplierStatsResult.error.message);
  const supplierStats = new Map(
    (supplierStatsResult.data || []).map((row) => [
      row.supplier_organization_id,
      row,
    ]),
  );
  return {
    categories: (categoriesResult.data || []).map((item) => ({ ...item, imageUrl: publicFileUrl(item.image) })),
    rawProducts: raws.map((raw) => ({
      ...raw,
      base_cost: n(raw.base_cost),
      suggested_price: n(raw.suggested_price),
      mainImageUrl: mainImages.get(raw.id) || null,
      colors: (colorsResult.data || []).filter(
        (item) => item.raw_product_id === raw.id,
      ),
      sizes: (sizesResult.data || []).filter(
        (item) => item.raw_product_id === raw.id,
      ),
      variants: (variantsResult.data || []).filter(
        (item) => item.raw_product_id === raw.id,
      ),
      colorCount: new Set(
        (variantsResult.data || [])
          .filter((item) => item.raw_product_id === raw.id)
          .map((item) => item.color_id),
      ).size,
      sizeCount: new Set(
        (variantsResult.data || [])
          .filter((item) => item.raw_product_id === raw.id)
          .map((item) => item.size_id),
      ).size,
      views: (viewsResult.data || [])
        .filter((item) => item.raw_product_id === raw.id)
        .map((item) => ({ ...item, ...editorViews.get(item.id) })),
    })),
    assets: editorAssets,
    suppliers: (offersResult.data || [])
      .map((offer) => {
        const stats = supplierStats.get(offer.supplier_organization_id);
        const productCount = stats?.product_count || 0;
        const reviewCount = stats?.review_count || 0;
        const ratingAverage = stats?.rating_average || 0;
        return {
          ...offer,
          base_cost: n(offer.base_cost),
          organization: (organizationsResult.data || []).find(
            (org) => org.id === offer.supplier_organization_id,
          ),
          variants: (offerVariantsResult.data || []).filter(
            (item) =>
              item.supplier_offer_id === offer.id && item.stock_quantity > 0,
          ),
          productCount,
          reviewCount,
          ratingAverage,
          score: productCount * 10 + reviewCount * 5 + ratingAverage,
        };
      })
      .sort((a, b) => b.score - a.score),
    graphicStyles: (graphicStylesResult.data || []).map((item) => ({ ...item, imageUrl: publicFileUrl(item.image) })),
    mockups: await Promise.all(
      (mockupsResult.data || []).map(async (mockup) => ({
        ...mockup,
        views: await Promise.all(
          (mockupViewsResult.data || [])
            .filter((view) => view.mockup_id === mockup.id)
            .map(async (view) => ({
              ...view,
              backgroundUrl:
                publicFileUrl(viewFiles.get(view.background_file_id)) || "",
            })),
        ),
      })),
    ),
  };
}

export async function getAdminMockupData() {
  const db = createSupabaseAdmin();
  const rawProductsQuery = async () => {
    const rows = [] as Array<{
      id: string;
      name: string;
      has_back: boolean;
      status: string;
      colors: Array<{ id: string; name: string; status: string }>;
    }>;
    for (let from = 0; from < 10_000; from += 10) {
      const page = await db
        .from("raw_products")
        .select("id,name,has_back,status,colors:raw_product_colors(id,name,status)")
        .eq("status", "ACTIVE")
        .order("name")
        .range(from, from + 9);
      if (page.error) return page;
      rows.push(...(page.data || []));
      if ((page.data?.length || 0) < 10) return { ...page, data: rows };
    }
    return { data: rows, error: null };
  };
  const mockupsQuery = async () => {
    const fields = "id,raw_product_id,name,side,status,needs_alignment,created_at";
    return db.from("raw_product_mockups").select(`${fields},color_id,gender`).order("created_at", { ascending: false });
  };
  const [raws, rawViews, mockups, views, files] = await Promise.all([
    rawProductsQuery(),
    db
      .from("raw_product_views")
      .select("raw_product_id,side,print_area_width,print_area_height"),
    mockupsQuery(),
    db
      .from("raw_product_mockup_views")
      .select(
        "id,mockup_id,side,background_file_id,area_x,area_y,area_width,area_height,rotation_degrees,perspective_points,artwork_clip",
      ),
    db
      .from("storage_files")
      .select("id,bucket,path")
      .eq("kind", "VARIANT_MOCKUP"),
  ]);
  for (const result of [raws, rawViews, mockups, views, files])
    if (result.error) throw new Error(result.error.message);
  const fileMap = new Map((files.data || []).map((file) => [file.id, file]));
  const rawProducts = (raws.data || []).map((raw) => ({
    ...raw,
    views: (rawViews.data || []).filter(
      (view) => view.raw_product_id === raw.id,
    ),
  }));
  const activeRawIds = new Set(rawProducts.map((raw) => raw.id));
  return {
    rawProducts,
    mockups: (mockups.data || [])
      .filter((mockup) => activeRawIds.has(mockup.raw_product_id))
      .map((mockup) => ({
        ...mockup,
        views: (views.data || [])
          .filter((view) => view.mockup_id === mockup.id)
          .map((view) => ({
            ...view,
            backgroundUrl:
              publicFileUrl(fileMap.get(view.background_file_id)) || "",
          })),
      })),
  };
}

export async function getAdminTutorialData() {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("tutorials")
    .select(
      "id,title,summary,description,learning_outcomes,content,difficulty,duration_minutes,sort_order,status,thumbnail_file_id,thumbnail:storage_files!tutorials_thumbnail_file_id_fkey(bucket,path)",
    )
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((tutorial) => ({
    ...tutorial,
    thumbnailUrl: publicFileUrl(tutorial.thumbnail),
  }));
}

export async function getProductStartData() {
  const db = createSupabaseAdmin();
  const [
    categoriesResult,
    rawsResult,
    colorsResult,
    sizesResult,
    variantsResult,
    offersResult,
    mediaResult,
  ] = await Promise.all([
    db
      .from("categories")
      .select("id,parent_id,slug,name,image:storage_files!categories_image_file_id_fkey(bucket,path)")
      .eq("status", "ACTIVE")
      .order("sort_order"),
    db
      .from("raw_products")
      .select(
        "id,category_id,name,description,base_cost,suggested_price,has_back,status",
      )
      .eq("status", "ACTIVE")
      .order("name"),
    db
      .from("raw_product_colors")
      .select("id,raw_product_id,name,hex")
      .eq("status", "ACTIVE"),
    db
      .from("raw_product_sizes")
      .select("id,raw_product_id,name")
      .eq("status", "ACTIVE"),
    db
      .from("raw_product_variants")
      .select("id,raw_product_id,color_id,size_id")
      .eq("status", "ACTIVE"),
    db
      .from("supplier_offers")
      .select("id,raw_product_id")
      .eq("approval_status", "APPROVED")
      .eq("status", "ACTIVE"),
    db
      .from("raw_product_media")
      .select(
        "raw_product_id,is_primary,sort_order,file:storage_files!raw_product_media_file_id_fkey(bucket,path)",
      )
      .order("is_primary", { ascending: false })
      .order("sort_order"),
  ]);
  for (const result of [
    categoriesResult,
    rawsResult,
    colorsResult,
    sizesResult,
    variantsResult,
    offersResult,
    mediaResult,
  ])
    if (result.error) throw new Error(result.error.message);
  const mainImages = await primaryRawMediaUrls(db, mediaResult.data || []);
  return {
    categories: (categoriesResult.data || []).map((item) => ({ ...item, imageUrl: publicFileUrl(item.image) })),
    rawProducts: (rawsResult.data || []).map((raw) => {
      const variants = (variantsResult.data || []).filter(
        (item) => item.raw_product_id === raw.id,
      );
      return {
        ...raw,
        base_cost: n(raw.base_cost),
        suggested_price: n(raw.suggested_price),
        mainImageUrl: mainImages.get(raw.id) || null,
        colors: (colorsResult.data || []).filter(
          (item) => item.raw_product_id === raw.id,
        ),
        sizes: (sizesResult.data || []).filter(
          (item) => item.raw_product_id === raw.id,
        ),
        variants,
        colorCount: new Set(variants.map((item) => item.color_id)).size,
        sizeCount: new Set(variants.map((item) => item.size_id)).size,
        views: [],
        supplierCount: (offersResult.data || []).filter(
          (item) => item.raw_product_id === raw.id,
        ).length,
      };
    }),
    assets: [],
    suppliers: [],
  };
}

export async function getDesignEditorData(
  rawProductId: string,
  designId?: string,
  userId?: string,
  includeEditorLibrary = true,
) {
  const db = createSupabaseAdmin();
  const [creation, freeDesignRowsResult] = await Promise.all([
    getProductCreationData(rawProductId),
    includeEditorLibrary
      ? freeDesignRows(db, true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (freeDesignRowsResult.error)
    throw new Error(freeDesignRowsResult.error.message);
  let design: null | {
    id: string;
    name: string;
    raw_product_id: string;
    views: { raw_product_view_id: string; canvas_document: unknown }[];
    variantIds: string[];
  } = null;
  let uploads: { id: string; name: string; url: string }[] = [];
  let selectedMockupIds: string[] = [];
  let designStoreId: string | null = null;
  let productDraft: null | {
    id: string;
    title: string;
    slug: string;
    subtitle: string | null;
    description: string | null;
    price: number;
    discounted_price: number | null;
    gender: string;
    primary_supplier_offer_id: string | null;
    backup_supplier_offer_id: string | null;
    details: { title: string; value: string; sort_order: number }[];
    graphicStyleIds: string[];
    variantPrices: { rawProductVariantId: string; price: number }[];
  } = null;
  const freeDesignUrls = await signedFileUrls(
    db,
    (freeDesignRowsResult.data || []).map((item) => item.file),
  );
  const freeDesigns = (freeDesignRowsResult.data || []).map((item) => ({
    ...item,
    style_name:
      creation.graphicStyles.find(
        (style) => style.id === item.graphic_style_id,
      )?.name || "",
    url:
      (fileKey(item.file) && freeDesignUrls.get(fileKey(item.file)!)) || "",
  }));
  if (userId && includeEditorLibrary) {
    const { data: files, error: filesError } = await db
      .from("storage_files")
      .select("id,original_name,bucket,path,created_at")
      .eq("owner_user_id", userId)
      .eq("kind", "DESIGN_SOURCE")
      .eq("state", "READY")
      .order("created_at", { ascending: false })
      .limit(50);
    if (filesError) throw new Error(filesError.message);
    const uploadUrls = await signedFileUrls(db, files || []);
    uploads = (files || [])
      .map((file) => ({
        id: file.id,
        name: file.original_name || "تصویر طراحی",
        url: (fileKey(file) && uploadUrls.get(fileKey(file)!)) || "",
      }))
      .filter((file) => file.url);
  }
  if (designId) {
    let query = db
      .from("designs")
      .select("id,name,raw_product_id,store_id")
      .eq("id", designId);
    if (userId) query = query.eq("owner_user_id", userId);
    const { data: record, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (record) {
      designStoreId = record.store_id;
      const [views, variants] = await Promise.all([
        db
          .from("design_views")
          .select("raw_product_view_id,canvas_document")
          .eq("design_id", record.id),
        db
          .from("design_variants")
          .select("raw_product_variant_id")
          .eq("design_id", record.id),
      ]);
      if (views.error || variants.error)
        throw new Error(views.error?.message || variants.error?.message);
      design = {
        ...record,
        views: views.data || [],
        variantIds: (variants.data || []).map(
          (item) => item.raw_product_variant_id,
        ),
      };
      const { data: selections, error: selectionError } = await db
        .from("design_mockup_selections")
        .select("mockup_id")
        .eq("design_id", record.id)
        .order("sort_order");
      if (selectionError) throw new Error(selectionError.message);
      selectedMockupIds = (selections || []).map((item) => item.mockup_id);
      const { data: drafts, error: draftError } = await db
        .from("seller_products")
        .select(
          "id,title,slug,subtitle,description,price,discounted_price,gender,primary_supplier_offer_id,backup_supplier_offer_id,product_details(title,value,sort_order),product_graphic_styles(graphic_style_id),seller_product_variants(raw_product_variant_id,price)",
        )
        .eq("store_id", record.store_id)
        .eq("design_id", record.id)
        .in("status", ["DRAFT", "PENDING", "PUBLISHED"])
        .order("updated_at", { ascending: false })
        .limit(1);
      if (draftError) throw new Error(draftError.message);
      const draft = drafts?.[0];
      if (draft)
        productDraft = {
          id: draft.id,
          title: draft.title,
          slug: draft.slug,
          subtitle: draft.subtitle,
          description: draft.description,
          price: n(draft.price),
          discounted_price:
            draft.discounted_price === null ? null : n(draft.discounted_price),
          gender: draft.gender,
          primary_supplier_offer_id: draft.primary_supplier_offer_id,
          backup_supplier_offer_id: draft.backup_supplier_offer_id,
          details: [...(draft.product_details || [])].sort(
            (a, b) => a.sort_order - b.sort_order,
          ),
          graphicStyleIds: (draft.product_graphic_styles || []).map(
            (item) => item.graphic_style_id,
          ),
          variantPrices: (draft.seller_product_variants || []).map((item) => ({
            rawProductVariantId: item.raw_product_variant_id,
            price: n(item.price),
          })),
        };
    }
  }
  const { data: wooConnection } = designStoreId
    ? await db.from("woocommerce_connections").select("status").eq("store_id", designStoreId).eq("status", "CONNECTED").maybeSingle()
    : { data: null };
  return {
    ...creation,
    design,
    uploads,
    freeDesigns,
    selectedMockupIds,
    productDraft,
    woocommerceConnected: Boolean(wooConnection),
  };
}
