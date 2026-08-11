import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { formatPrice, type Product } from "@/lib/catalog";
import { WishlistButton } from "@/components/wishlist-button";

export function ProductCard({ product, liked = false }: { product: Product; liked?: boolean }) {
  return (
    <article className="product-card">
      <WishlistButton productId={product.id} title={product.title} initialLiked={liked} />
      <Link className="product-image-wrap" href={`/products/${product.slug}`} prefetch>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <Image src={product.image} alt={product.title} fill sizes="(max-width: 700px) 50vw, 25vw" />
      </Link>
      <div className="product-card-body">
        <span className="product-seller">{product.seller}</span>
        <Link href={`/products/${product.slug}`} prefetch><h3>{product.title}</h3></Link>
        <div className="rating"><Star size={14} fill="currentColor" /> {product.rating.toLocaleString("fa-IR")} <span>({product.reviewCount.toLocaleString("fa-IR")})</span></div>
        <div className="price-row">
          <strong>{formatPrice(product.price)}</strong>
          {product.compareAtPrice && <del>{formatPrice(product.compareAtPrice)}</del>}
        </div>
      </div>
    </article>
  );
}
