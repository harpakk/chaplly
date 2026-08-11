export type ProductVariant = {
  id: string;
  color: string;
  colorHex?: string;
  size: string;
  price: number;
  compareAtPrice?: number;
  inventory: number;
};

export type ProductDetail = { title: string; value: string };

export type Product = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  seller: string;
  sellerDescription?: string;
  sellerSocialUrl?: string;
  category: string;
  categorySlug: string;
  subcategory: string;
  subcategorySlug: string;
  rawProduct: string;
  graphicStyle: string;
  graphicStyleSlug: string;
  graphicStyles: Array<{ name: string; slug: string }>;
  shopSlug: string;
  tags: string[];
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviewCount: number;
  salesCount: number;
  viewCount: number;
  image: string;
  images: string[];
  badge?: string;
  colors: string[];
  sizes: string[];
  variants: ProductVariant[];
  details: ProductDetail[];
  description: string;
  delivery: string;
  productionDays: string;
  videos?: string[];
  gender: "MALE" | "FEMALE" | "UNISEX";
};

export type MarketplaceBanner = {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  cta: string;
  href: string;
  tone: string;
  image?: string;
};
export type MarketplaceShop = {
  id: string;
  slug: string;
  name: string;
  handle: string;
  bio: string;
  followers: number;
  logo?: string;
  banner?: string;
};
export type GraphicStyle = {
  id: string;
  slug: string;
  name: string;
  caption: string;
  image?: string;
};
export type Reel = {
  id: string;
  shopSlug: string;
  shopName: string;
  handle: string;
  productSlug: string;
  caption: string;
  media: string;
  likes: number;
  saves: number;
};
export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  detail: string;
  image?: string;
  parentId?: string;
};

export const formatPrice = (amount: number) =>
  new Intl.NumberFormat("fa-IR").format(Math.round(amount / 10)) + " تومان";
export const formatRial = (amount: number) =>
  new Intl.NumberFormat("fa-IR").format(amount) + " ریال";
