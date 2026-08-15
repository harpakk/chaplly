import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabasePublic } from "@/lib/supabase/public";
import type {
  CategorySummary,
  GraphicStyle,
  MarketplaceBanner,
  MarketplaceShop,
  Product,
  ProductVariant,
  Reel,
} from "@/lib/catalog";
import { normalizeStorefrontConfig } from "@/lib/storefront";

const fallback = "/images/product-placeholder.png";
function publicFileUrl(file: unknown) {
  const row = file as { bucket?: string; path?: string } | null;
  if (!row?.bucket || !row.path) return fallback;
  if (!["product-images", "variant-mockups", "catalog-assets", "reel-videos"].includes(row.bucket))
    return fallback;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${encodeURIComponent(row.bucket)}/${row.path.split("/").map(encodeURIComponent).join("/")}`;
}
const one = <T>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : (value ?? undefined);

async function getProductsFromSeparateQueries(): Promise<Product[]> {
  const db = createSupabasePublic();
  const productResult = await db
    .from("seller_products")
    .select(
      "id,store_id,raw_product_id,slug,title,subtitle,description,price,discounted_price,rating_average,review_count,sales_count,view_count,is_featured,published_at",
    )
    .eq("status", "PUBLISHED")
    .eq("moderation_status", "APPROVED")
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(240);
  if (productResult.error)
    throw new Error(`Catalog query failed: ${productResult.error.message}`);
  const productIds = (productResult.data || []).map((row) => row.id);
  if (!productIds.length) return [];
  const [
    storeResult,
    rawResult,
    categoryResult,
    imageResult,
    detailResult,
    tagResult,
    styleResult,
    videoResult,
    variantResult,
  ] = await Promise.all([
    db
      .from("stores")
      .select(
        "id,name,slug,follower_count,description,social_url,logo_file_id,banner_file_id",
      )
      .eq("status", "ACTIVE")
      .limit(200),
    db.from("raw_products").select("id,category_id,name").limit(500),
    db
      .from("categories")
      .select("id,parent_id,slug,name,description")
      .eq("status", "ACTIVE")
      .limit(200),
    db
      .from("product_images")
      .select(
        "seller_product_id,alt_text,is_primary,sort_order,storage_files(bucket,path,state)",
      )
      .in("seller_product_id", productIds)
      .order("is_primary", { ascending: false })
      .order("sort_order")
      .limit(1440),
    db
      .from("product_details")
      .select("seller_product_id,title,value,sort_order")
      .in("seller_product_id", productIds)
      .order("sort_order")
      .limit(2400),
    db
      .from("product_tags")
      .select("seller_product_id,tags(slug,name)")
      .in("seller_product_id", productIds)
      .limit(2400),
    db
      .from("product_graphic_styles")
      .select("seller_product_id,graphic_styles(id,slug,name,caption)")
      .in("seller_product_id", productIds)
      .limit(960),
    db
      .from("product_videos")
      .select("seller_product_id,storage_files(bucket,path,state)")
      .in("seller_product_id", productIds)
      .order("sort_order")
      .limit(720),
    db
      .from("seller_product_variants")
      .select(
        "id,seller_product_id,price,compare_at_price,status,stock:supplier_offer_variants!seller_product_variants_supplier_offer_variant_id_fkey(stock_quantity),raw_product_variants(id,raw_product_colors(name,hex),raw_product_sizes(name))",
      )
      .in("seller_product_id", productIds)
      .eq("status", "ACTIVE")
      .limit(4800),
  ]);
  for (const result of [
    productResult,
    storeResult,
    rawResult,
    categoryResult,
    imageResult,
    detailResult,
    tagResult,
    styleResult,
    videoResult,
    variantResult,
  ]) {
    if (result.error)
      throw new Error(`Catalog query failed: ${result.error.message}`);
  }
  const stores = new Map((storeResult.data || []).map((row) => [row.id, row]));
  const raws = new Map((rawResult.data || []).map((row) => [row.id, row]));
  const categories = new Map(
    (categoryResult.data || []).map((row) => [row.id, row]),
  );
  return (productResult.data || []).map((row) => {
    const store = stores.get(row.store_id);
    const raw = raws.get(row.raw_product_id);
    const subcategory = raw ? categories.get(raw.category_id) : undefined;
    const category = subcategory?.parent_id
      ? categories.get(subcategory.parent_id)
      : subcategory;
    const images = (imageResult.data || []).filter(
      (item) => item.seller_product_id === row.id,
    );
    const styles = (styleResult.data || [])
      .filter((item) => item.seller_product_id === row.id)
      .map((item) => one(item.graphic_styles))
      .filter(Boolean);
    const style = styles[0] as
      | { id: string; slug: string; name: string; caption: string | null }
      | undefined;
    const variants: ProductVariant[] = (variantResult.data || [])
      .filter((item) => item.seller_product_id === row.id)
      .map((item) => {
        const rawVariant = one(item.raw_product_variants) as
          | { raw_product_colors: unknown; raw_product_sizes: unknown }
          | undefined;
        const color = one(rawVariant?.raw_product_colors as never) as
          { name: string; hex: string | null } | undefined;
        const size = one(rawVariant?.raw_product_sizes as never) as
          { name: string } | undefined;
        const supplierVariant = one(item.stock) as
          { stock_quantity: number } | undefined;
        return {
          id: item.id,
          color: color?.name || "استاندارد",
          colorHex: color?.hex || undefined,
          size: size?.name || "استاندارد",
          price: Number(item.price),
          compareAtPrice:
            item.compare_at_price == null
              ? undefined
              : Number(item.compare_at_price),
          inventory: Number(supplierVariant?.stock_quantity || 0),
        };
      });
    const tags = (tagResult.data || [])
      .filter((item) => item.seller_product_id === row.id)
      .map((item) => one(item.tags) as { name?: string } | undefined)
      .flatMap((item) => (item?.name ? [item.name] : []));
    const videos = (videoResult.data || [])
      .filter((item) => item.seller_product_id === row.id)
      .map((item) => publicFileUrl(one(item.storage_files)));
    const lowestVariant = variants.reduce<ProductVariant | undefined>(
      (lowest, variant) =>
        !lowest || variant.price < lowest.price ? variant : lowest,
      undefined,
    );
    const effectivePrice =
      lowestVariant?.price ?? Number(row.discounted_price ?? row.price);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle || "",
      seller: store?.name || "فروشگاه چاپلی",
      sellerDescription: store?.description || undefined,
      sellerSocialUrl: store?.social_url || undefined,
      category: category?.name || subcategory?.name || "محصولات",
      categorySlug: category?.slug || subcategory?.slug || "all",
      subcategory: subcategory?.name || raw?.name || "محصول",
      subcategorySlug: subcategory?.slug || "all",
      rawProduct: raw?.name || "محصول",
      graphicStyle: style?.name || "طراحی مستقل",
      graphicStyleSlug: style?.slug || "independent",
      graphicStyles: styles
        .map((item) => ({
          name: String(item?.name || ""),
          slug: String(item?.slug || ""),
        }))
        .filter((item) => item.slug),
      shopSlug: store?.slug || "",
      tags,
      price: effectivePrice,
      compareAtPrice:
        lowestVariant?.compareAtPrice ??
        (row.discounted_price == null ? undefined : Number(row.price)),
      rating: Number(row.rating_average),
      reviewCount: Number(row.review_count),
      salesCount: Number(row.sales_count),
      viewCount: Number(row.view_count),
      image: publicFileUrl(one(images[0]?.storage_files)),
      images: images
        .map((item) => publicFileUrl(one(item.storage_files)))
        .filter((url, index, array) => array.indexOf(url) === index),
      badge: row.is_featured
        ? "انتخاب ویژه"
        : row.sales_count > 200
          ? "پرفروش"
          : undefined,
      colors: [...new Set(variants.map((item) => item.color))],
      sizes: [...new Set(variants.map((item) => item.size))],
      variants,
      details: (detailResult.data || [])
        .filter((item) => item.seller_product_id === row.id)
        .map((item) => ({ title: item.title, value: item.value })),
      description: row.description || "",
      delivery: "ارسال حداکثر تا ۷۲ ساعت",
      productionDays: "ارسال حداکثر تا ۷۲ ساعت",
      videos: videos.length ? videos : undefined,
      gender: "UNISEX" as Product["gender"],
    } satisfies Product;
  });
}

type CatalogFile = { bucket: string; path: string; state?: string };
type CatalogProductRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  price: number | string;
  discounted_price: number | string | null;
  rating_average: number | string;
  review_count: number;
  sales_count: number;
  view_count: number;
  is_featured: boolean;
  store: {
    name: string;
    slug: string;
  } | null;
  rawProduct: {
    name: string;
    subcategory: { name: string | null; slug: string | null };
    category: { name: string | null; slug: string | null };
  } | null;
  images: Array<{
    alt_text: string | null;
    is_primary: boolean;
    sort_order: number;
    file: CatalogFile;
  }>;
  details: Array<{ title: string; value: string; sort_order: number }>;
  tags: Array<{ slug: string; name: string }>;
  styles: Array<{
    id: string;
    slug: string;
    name: string;
    caption: string | null;
  }>;
  videos: CatalogFile[];
  variants: Array<{
    id: string;
    price: number | string;
    compare_at_price: number | string | null;
    status: string;
    color: { name: string; hex: string | null };
    size: { name: string };
    stock: { stock_quantity: number | null; stock_status: string | null };
  }>;
};

// Retained only as a readable reference while the single-call catalog RPC is
// rolled out. It must never be used on a request path again.
void getProductsFromSeparateQueries;

async function getProductsOnce(): Promise<Product[]> {
  const { data, error } = await createSupabasePublic().rpc(
    "service_catalog_products",
  );
  if (error) throw new Error(`Catalog query failed: ${error.message}`);
  const rows = (Array.isArray(data) ? data : []) as CatalogProductRow[];
  return rows.map((row) => {
    const store = row.store;
    const raw = row.rawProduct;
    const subcategory = raw?.subcategory;
    const category = raw?.category;
    const styles = row.styles || [];
    const style = styles[0];
    const variants: ProductVariant[] = (row.variants || []).map((variant) => ({
      id: variant.id,
      color: variant.color?.name || "استاندارد",
      colorHex: variant.color?.hex || undefined,
      size: variant.size?.name || "استاندارد",
      price: Number(variant.price),
      compareAtPrice:
        variant.compare_at_price == null
          ? undefined
          : Number(variant.compare_at_price),
      inventory:
        variant.stock?.stock_status !== "OUT_OF_STOCK" &&
        variant.stock?.stock_status !== "PAUSED"
          ? Number(variant.stock?.stock_quantity || 0)
          : 0,
    }));
    const images = (row.images || []).map((image) =>
      publicFileUrl(image.file),
    );
    const videos = (row.videos || []).map(publicFileUrl);
    const lowestVariant = variants.reduce<ProductVariant | undefined>(
      (lowest, variant) =>
        !lowest || variant.price < lowest.price ? variant : lowest,
      undefined,
    );
    const effectivePrice =
      lowestVariant?.price ?? Number(row.discounted_price ?? row.price);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle || "",
      seller: store?.name || "فروشگاه چاپلی",
      category: category?.name || subcategory?.name || "محصولات",
      categorySlug: category?.slug || subcategory?.slug || "all",
      subcategory: subcategory?.name || raw?.name || "محصول",
      subcategorySlug: subcategory?.slug || "all",
      rawProduct: raw?.name || "محصول",
      graphicStyle: style?.name || "طراحی مستقل",
      graphicStyleSlug: style?.slug || "independent",
      graphicStyles: styles.map((item) => ({
        name: item.name,
        slug: item.slug,
      })),
      shopSlug: store?.slug || "",
      tags: (row.tags || []).map((item) => item.name),
      price: effectivePrice,
      compareAtPrice:
        lowestVariant?.compareAtPrice ??
        (row.discounted_price == null ? undefined : Number(row.price)),
      rating: Number(row.rating_average),
      reviewCount: Number(row.review_count),
      salesCount: Number(row.sales_count),
      viewCount: Number(row.view_count),
      image: images[0] || fallback,
      images: images.filter((url, index) => images.indexOf(url) === index),
      badge: row.is_featured
        ? "انتخاب ویژه"
        : Number(row.sales_count) > 200
          ? "پرفروش"
          : undefined,
      colors: [...new Set(variants.map((item) => item.color))],
      sizes: [...new Set(variants.map((item) => item.size))],
      variants,
      details: (row.details || []).map((item) => ({
        title: item.title,
        value: item.value,
      })),
      description: row.description || "",
      delivery: "ارسال حداکثر تا ۷۲ ساعت",
      productionDays: "ارسال حداکثر تا ۷۲ ساعت",
      videos: videos.length ? videos : undefined,
      gender: "UNISEX" as Product["gender"],
    } satisfies Product;
  });
}

const getProductsCached = unstable_cache(
  () => getProductsOnce(),
  ["chapli-marketplace-products-v2-gender"],
  { revalidate: 60, tags: ["catalog", "products"] },
);
let productsMemory: { expiresAt: number; data: Promise<Product[]> } | undefined;
export async function getProducts(): Promise<Product[]> {
  const now = Date.now();
  if (productsMemory && productsMemory.expiresAt > now)
    return productsMemory.data;
  const data = getProductsCached();
  productsMemory = { expiresAt: now + 300_000, data };
  try {
    return await data;
  } catch (error) {
    productsMemory = undefined;
    throw error;
  }
}

export async function findProduct(slug: string) {
  return (await getProducts()).find((product) => product.slug === slug);
}

export async function getLiveProductInventory(productId: string) {
  // Supplier inventory is not anonymous-readable by design. This function is
  // server-only, so read it with the service client and return only the public
  // per-variant quantity to the product page.
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("seller_product_variants")
    .select(
      "id,status,stock:supplier_offer_variants!seller_product_variants_supplier_offer_variant_id_fkey(stock_quantity,stock_status)",
    )
    .eq("seller_product_id", productId);
  if (error) throw new Error(`Inventory query failed: ${error.message}`);
  return new Map(
    (data || []).map((variant) => {
      const stock = one(variant.stock);
      return [
        variant.id,
        variant.status === "ACTIVE" &&
        stock?.stock_status !== "OUT_OF_STOCK" &&
        stock?.stock_status !== "PAUSED"
          ? Number(stock?.stock_quantity || 0)
          : 0,
      ];
    }),
  );
}

export type ProductSizeGuide = { columns: string[]; rows: string[][] };

export async function getProductSizeGuide(productId: string): Promise<ProductSizeGuide | null> {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("seller_products")
    .select("rawProduct:raw_products(size_guide)")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(`Size guide query failed: ${error.message}`);
  const raw = Array.isArray(data?.rawProduct) ? data.rawProduct[0] : data?.rawProduct;
  const guide = raw?.size_guide as { columns?: unknown; rows?: unknown } | null | undefined;
  if (!guide || !Array.isArray(guide.columns) || !Array.isArray(guide.rows)) return null;
  const columns = guide.columns.map(String);
  const rows = guide.rows.filter(Array.isArray).map((row) => row.map(String));
  return columns.length && rows.length ? { columns, rows } : null;
}

async function getMarketplaceDataFromSeparateQueries() {
  const db = createSupabasePublic();
  const [
    products,
    bannersResult,
    storesResult,
    stylesResult,
    categoriesResult,
    reelsResult,
  ] = await Promise.all([
    getProducts(),
    db
      .from("homepage_banners")
      .select(
        "id,eyebrow,title,body,cta_label,cta_url,tone,desktop_file_id,storage_files!homepage_banners_desktop_file_id_fkey(bucket,path)",
      )
      .eq("status", "ACTIVE")
      .order("sort_order")
      .limit(12),
    db
      .from("stores")
      .select(
        "id,name,slug,description,social_url,follower_count,logo:storage_files!stores_logo_file_id_fkey(bucket,path),banner:storage_files!stores_banner_file_id_fkey(bucket,path)",
      )
      .eq("status", "ACTIVE")
      .order("follower_count", { ascending: false })
      .limit(24),
    db
      .from("graphic_styles")
      .select("id,slug,name,caption,image:storage_files!graphic_styles_image_file_id_fkey(bucket,path)")
      .eq("status", "ACTIVE")
      .order("sort_order")
      .limit(24),
    db
      .from("categories")
      .select("id,parent_id,slug,name,description,image:storage_files!categories_image_file_id_fkey(bucket,path)")
      .eq("status", "ACTIVE")
      .is("parent_id", null)
      .order("sort_order")
      .limit(24),
    db
      .from("reel_posts")
      .select(
        "id,store_id,seller_product_id,caption,like_count,save_count,video_file_id,published_at,stores(name,slug,social_url),seller_products(slug),storage_files(bucket,path)",
      )
      .eq("status", "PUBLISHED")
      .order("published_at", { ascending: false })
      .limit(30),
  ]);
  for (const result of [
    bannersResult,
    storesResult,
    stylesResult,
    categoriesResult,
    reelsResult,
  ])
    if (result.error) throw new Error(result.error.message);
  const banners: MarketplaceBanner[] = (bannersResult.data || []).map(
    (row) => ({
      id: row.id,
      eyebrow: row.eyebrow || "",
      title: row.title,
      copy: row.body || "",
      cta: row.cta_label,
      href: row.cta_url,
      tone: row.tone,
      image: publicFileUrl(one(row.storage_files)),
    }),
  );
  const shops: MarketplaceShop[] = (storesResult.data || []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    handle: row.social_url ? `@${row.slug}` : "@chapli",
    bio: row.description || "",
    followers: row.follower_count,
    logo: publicFileUrl(one(row.logo)),
    banner: publicFileUrl(one(row.banner)),
  }));
  const graphicStyles: GraphicStyle[] = (stylesResult.data || []).map(
    (row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      caption: row.caption || "",
      image: publicFileUrl(one(row.image)),
    }),
  );
  const categories: CategorySummary[] = (categoriesResult.data || []).map(
    (row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      detail: row.description || "",
      image: publicFileUrl(one(row.image)),
      parentId: row.parent_id || undefined,
    }),
  );
  const reels: Reel[] = (reelsResult.data || []).map((row) => {
    const store = one(row.stores) as
      { name: string; slug: string; social_url: string | null } | undefined;
    const product = one(row.seller_products) as { slug: string } | undefined;
    return {
      id: row.id,
      shopSlug: store?.slug || "",
      shopName: store?.name || "چاپلی",
      handle: `@${store?.slug || "chapli"}`,
      productSlug: product?.slug || "",
      products: product?.slug ? [{ id: "", title: "محصول", slug: product.slug }] : [],
      caption: row.caption,
      tags: [],
      media: publicFileUrl(one(row.storage_files)),
      likes: row.like_count,
      saves: row.save_count,
      views: 0,
    };
  });
  return { products, banners, shops, graphicStyles, categories, reels };
}

type MarketplaceContextPayload = {
  banners?: Array<{
    id: string;
    eyebrow: string | null;
    title: string;
    body: string | null;
    cta_label: string;
    cta_url: string;
    tone: string;
    file: CatalogFile | null;
  }>;
  stores?: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    social_url: string | null;
    follower_count: number;
    logo: CatalogFile | null;
    banner: CatalogFile | null;
  }>;
  styles?: Array<{
    id: string;
    slug: string;
    name: string;
    caption: string | null;
    file: CatalogFile | null;
  }>;
  categories?: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    parent_id: string | null;
    file: CatalogFile | null;
  }>;
  reels?: Array<{
    id: string;
    caption: string;
    like_count: number;
    save_count: number;
    store: { name: string; slug: string; social_url: string | null } | null;
    product: { slug: string } | null;
    products?: Array<{ id: string; title: string; slug: string }>;
    tags?: string[];
    social_url?: string | null;
    view_count?: number;
    file: CatalogFile | null;
  }>;
};

void getMarketplaceDataFromSeparateQueries;

async function getMarketplaceDataOnce() {
  const db = createSupabasePublic();
  const [products, contextResult, topReelsResult] = await Promise.all([
    getProducts(),
    db.rpc("service_marketplace_context"),
    db.rpc("public_top_reels", { p_days: 10, p_limit: 12 }),
  ]);
  if (contextResult.error) throw new Error(contextResult.error.message);
  const context = (contextResult.data || {}) as MarketplaceContextPayload;
  const banners: MarketplaceBanner[] = (context.banners || []).map((row) => ({
    id: row.id,
    eyebrow: row.eyebrow || "",
    title: row.title,
    copy: row.body || "",
    cta: row.cta_label,
    href: row.cta_url,
    tone: row.tone,
    image: publicFileUrl(row.file),
  }));
  const shops: MarketplaceShop[] = [
    ...new Map(
      (context.stores || []).map((row) => [
        row.id,
        {
          id: row.id,
          slug: row.slug,
          name: row.name,
          handle: row.social_url ? `@${row.slug}` : "@chapli",
          bio: row.description || "",
          followers: row.follower_count,
          logo: publicFileUrl(row.logo),
          banner: publicFileUrl(row.banner),
        },
      ]),
    ).values(),
  ];
  const graphicStyles: GraphicStyle[] = (context.styles || []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    caption: row.caption || "",
    image: publicFileUrl(row.file),
  }));
  const categories: CategorySummary[] = (context.categories || []).map(
    (row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      detail: row.description || "",
      image: publicFileUrl(row.file),
      parentId: row.parent_id || undefined,
    }),
  );
  const topReels = !topReelsResult.error && Array.isArray(topReelsResult.data) ? topReelsResult.data as unknown as MarketplaceContextPayload["reels"] : context.reels;
  const reels: Reel[] = (topReels || []).map((row) => ({
    id: row.id,
    shopSlug: row.store?.slug || "",
    shopName: row.store?.name || "چاپلی",
    handle: `@${row.store?.slug || "chapli"}`,
    productSlug: row.product?.slug || "",
    products: row.products || (row.product?.slug ? [{ id: "", title: "محصول", slug: row.product.slug }] : []),
    caption: row.caption,
    tags: row.tags || [],
    socialUrl: row.social_url || undefined,
    media: publicFileUrl(row.file),
    likes: row.like_count,
    saves: row.save_count,
    views: Number(row.view_count || 0),
  }));
  return { products, banners, shops, graphicStyles, categories, reels };
}

const getMarketplaceDataCached = unstable_cache(
  () => getMarketplaceDataOnce(),
  ["chapli-marketplace-home-v1"],
  { revalidate: 60, tags: ["catalog", "marketplace-home"] },
);
type MarketplaceData = Awaited<ReturnType<typeof getMarketplaceDataOnce>>;
let marketplaceMemory:
  { expiresAt: number; data: Promise<MarketplaceData> } | undefined;
export function clearMarketplaceMemoryCache() {
  marketplaceMemory = undefined;
}
export async function getMarketplaceData() {
  const now = Date.now();
  if (marketplaceMemory && marketplaceMemory.expiresAt > now)
    return marketplaceMemory.data;
  const data = getMarketplaceDataCached();
  marketplaceMemory = { expiresAt: now + 300_000, data };
  try {
    return await data;
  } catch (error) {
    marketplaceMemory = undefined;
    throw error;
  }
}

export async function getBrowseData() {
  const { products, shops } = await getMarketplaceData();
  const db = createSupabaseAdmin();
  const [allCategoriesResult, allStylesResult, allColorsResult, allSizesResult] =
    await Promise.all([
      db
        .from("categories")
        .select("id,parent_id,slug,name,description,image:storage_files!categories_image_file_id_fkey(bucket,path)")
        .eq("status", "ACTIVE")
        .order("sort_order"),
      db
        .from("graphic_styles")
        .select("id,slug,name,caption,image:storage_files!graphic_styles_image_file_id_fkey(bucket,path)")
        .eq("status", "ACTIVE")
        .order("sort_order"),
      db
        .from("raw_product_colors")
        .select("name")
        .eq("status", "ACTIVE")
        .order("name"),
      db
        .from("raw_product_sizes")
        .select("name")
        .eq("status", "ACTIVE")
        .order("sort_order"),
    ]);
  for (const result of [
    allCategoriesResult,
    allStylesResult,
    allColorsResult,
    allSizesResult,
  ])
    if (result.error) throw new Error(result.error.message);
  const popularity = (field: (product: Product) => string) => {
    const counts = new Map<string, number>();
    products.forEach((product) => {
      const key = field(product);
      counts.set(
        key,
        (counts.get(key) || 0) +
          product.salesCount * 100 +
          product.viewCount +
          product.reviewCount * 10 +
          1,
      );
    });
    return counts;
  };
  const categoryPopularity = popularity((product) => product.categorySlug);
  const subcategoryPopularity = popularity(
    (product) => product.subcategorySlug,
  );
  const graphicPopularity = new Map<string, number>();
  products.forEach((product) =>
    product.graphicStyles.forEach((style) =>
      graphicPopularity.set(
        style.slug,
        (graphicPopularity.get(style.slug) || 0) +
          product.salesCount * 100 +
          product.viewCount +
          product.reviewCount * 10 +
          1,
      ),
    ),
  );
  const shopPopularity = popularity((product) => product.shopSlug);
  const completeCategories: CategorySummary[] = (allCategoriesResult.data || [])
    .filter((item) => !item.parent_id)
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      detail: item.description || "",
      image: publicFileUrl(item.image),
    }));
  const completeGraphicStyles: GraphicStyle[] = (allStylesResult.data || []).map(
    (item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      caption: item.caption || "",
      image: publicFileUrl(item.image),
    }),
  );
  const availableCategories = completeCategories
    .sort(
      (a, b) =>
        (categoryPopularity.get(b.slug) || 0) -
        (categoryPopularity.get(a.slug) || 0),
    );
  const availableGraphicStyles = completeGraphicStyles
    .sort(
      (a, b) =>
        (graphicPopularity.get(b.slug) || 0) -
        (graphicPopularity.get(a.slug) || 0),
    );
  const availableShops = shops
    .filter((item) => shopPopularity.has(item.slug))
    .sort(
      (a, b) =>
        (shopPopularity.get(b.slug) || 0) - (shopPopularity.get(a.slug) || 0),
    );
  const subcategories = (allCategoriesResult.data || [])
    .filter((item) => Boolean(item.parent_id))
    .map((item) => ({ slug: item.slug, name: item.name }))
    .sort(
    (a, b) =>
      (subcategoryPopularity.get(b.slug) || 0) -
      (subcategoryPopularity.get(a.slug) || 0),
  );
  const colors = [...new Set((allColorsResult.data || []).map((item) => item.name))];
  const sizes = [...new Set((allSizesResult.data || []).map((item) => item.name))];
  const rawProducts = [...new Set(products.map((product) => product.rawProduct))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "fa"));
  return {
    products,
    shops: availableShops,
    graphicStyles: availableGraphicStyles,
    categories: availableCategories,
    subcategories,
    rawProducts,
    colors,
    sizes,
  };
}

export async function getStorefrontData(slug: string) {
  const db = createSupabasePublic();
  let storeResult = await db
    .from("stores")
    .select(
      "id,name,slug,description,support_phone,social_url,brand_color,accent_color,brand_tone,follower_count,is_verified,storefront_config,logo:storage_files!stores_logo_file_id_fkey(bucket,path),banner:storage_files!stores_banner_file_id_fkey(bucket,path)",
    )
    .eq("slug", slug)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (
    storeResult.error?.code === "42703" &&
    storeResult.error.message.includes("storefront_config")
  ) {
    const fallback = await db
      .from("stores")
      .select(
        "id,name,slug,description,support_phone,social_url,brand_color,accent_color,brand_tone,follower_count,is_verified,logo:storage_files!stores_logo_file_id_fkey(bucket,path),banner:storage_files!stores_banner_file_id_fkey(bucket,path)",
      )
      .eq("slug", slug)
      .eq("status", "ACTIVE")
      .maybeSingle();
    storeResult = {
      ...fallback,
      data: fallback.data
        ? { ...fallback.data, storefront_config: null }
        : null,
    } as typeof storeResult;
  }
  const { data: store, error } = storeResult;
  if (error) throw new Error(error.message);
  if (!store) return null;
  const [browse, reelsResult] = await Promise.all([
    getBrowseData(),
    db.from("reel_posts")
      .select("id,caption,tags,social_url,like_count,save_count,view_count,storage_files(bucket,path)")
      .eq("store_id", store.id)
      .eq("status", "PUBLISHED")
      .order("view_count", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(6),
  ]);
  if (reelsResult.error) throw new Error(reelsResult.error.message);
  const reelIds = (reelsResult.data || []).map((reel) => reel.id);
  const linksResult = reelIds.length
    ? await db.from("reel_products")
        .select("reel_id,sort_order,seller_products(id,title,slug)")
        .in("reel_id", reelIds)
        .order("sort_order")
    : { data: [], error: null };
  if (linksResult.error) throw new Error(linksResult.error.message);
  const logo = one(store.logo) as
    { bucket?: string; path?: string } | undefined;
  const banner = one(store.banner) as
    { bucket?: string; path?: string } | undefined;
  const fileUrl = (file?: { bucket?: string; path?: string }) =>
    file?.bucket && file.path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(file.bucket)}/${file.path.split("/").map(encodeURIComponent).join("/")}`
      : fallback;
  return {
    ...browse,
    store: {
      ...store,
      storefront: normalizeStorefrontConfig(store.storefront_config),
      logoUrl: fileUrl(logo),
      bannerUrl: fileUrl(banner),
    },
    reels: (reelsResult.data || []).map((reel) => ({
      id: reel.id,
      shopSlug: store.slug,
      shopName: store.name,
      handle: `@${store.slug}`,
      productSlug: "",
      products: (linksResult.data || []).filter((link) => link.reel_id === reel.id).flatMap((link) => {
        const product = one(link.seller_products) as { id: string; title: string; slug: string } | undefined;
        return product ? [product] : [];
      }),
      caption: reel.caption,
      tags: reel.tags || [],
      socialUrl: reel.social_url || undefined,
      media: publicFileUrl(one(reel.storage_files)),
      likes: Number(reel.like_count),
      saves: Number(reel.save_count),
      views: Number(reel.view_count),
    })),
  };
}
