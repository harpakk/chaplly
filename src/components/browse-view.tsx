"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Sparkles, X } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type {
  CategorySummary,
  GraphicStyle,
  MarketplaceShop,
  Product,
} from "@/lib/catalog";

type Params = Record<string, string | string[] | undefined>;

const value = (params: Params, key: string) => {
  const entry = params[key];
  return Array.isArray(entry) ? entry[0] : entry;
};

function filterHref(params: Params, key: string, nextValue?: string) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([paramKey, paramValue]) => {
    const normalized = Array.isArray(paramValue) ? paramValue[0] : paramValue;
    if (
      normalized &&
      paramKey !== key &&
      (!(key === "category" || key === "raw") || paramKey !== "size") &&
      (key === "page" || paramKey !== "page")
    )
      search.set(paramKey, normalized);
  });
  if (nextValue) search.set(key, nextValue);
  const query = search.toString();
  return query ? `?${query}` : "?";
}

export function BrowseView({
  params,
  products,
  shops,
  graphicStyles,
  categories,
  subcategories,
  rawProducts,
  colors,
  sizes,
  title = "همه محصولات",
  intro = "بین کلی انتخاب خاص بگرد؛ فیلترها کمک می‌کنن دقیقاً به مود خودت برسی.",
  fixed,
  likedProductIds = [],
}: {
  params: Params;
  products: Product[];
  shops: MarketplaceShop[];
  graphicStyles: GraphicStyle[];
  categories: CategorySummary[];
  subcategories: Array<{ slug: string; name: string }>;
  rawProducts: string[];
  colors: string[];
  sizes: string[];
  title?: string;
  intro?: string;
  fixed?: { category?: string; subcategory?: string; shop?: string };
  likedProductIds?: string[];
}) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = value(params, "q")?.trim().toLowerCase();
  const category = fixed?.category ?? value(params, "category");
  const subcategory = fixed?.subcategory ?? value(params, "subcategory");
  const rawProduct = value(params, "raw");
  const shop = fixed?.shop ?? value(params, "shop");
  const graphic = value(params, "graphic");
  const color = value(params, "color");
  const size = value(params, "size");
  const gender = value(params, "gender");
  const rating = Number(value(params, "rating") || 0);
  const discount = value(params, "discount");
  const sort = value(params, "sort") || "popular";
  const requestedPage = Math.max(1, Number(value(params, "page") || 1) || 1);
  const relevantSizes = category || rawProduct
    ? sizes.filter((candidate) =>
        products.some(
          (product) =>
            (!category || product.categorySlug === category) &&
            (!rawProduct || product.rawProduct === rawProduct) &&
            product.sizes.includes(candidate),
        ),
      )
    : [];

  let result = products.filter((product) => {
    const searchable = [
      product.title,
      product.seller,
      product.category,
      product.subcategory,
      product.rawProduct,
      ...product.graphicStyles.map((item) => item.name),
      ...product.tags,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (!category || product.categorySlug === category) &&
      (!subcategory || product.subcategorySlug === subcategory) &&
      (!rawProduct || product.rawProduct === rawProduct) &&
      (!shop || product.shopSlug === shop) &&
      (!graphic ||
        product.graphicStyles.some((item) => item.slug === graphic)) &&
      (!color || product.colors.includes(color)) &&
      (!size || product.sizes.includes(size)) &&
      (!gender || product.gender === gender) &&
      (!rating || product.rating >= rating) &&
      (!discount || Boolean(product.compareAtPrice))
    );
  });
  result = [...result].sort((a, b) =>
    sort === "price-low"
      ? a.price - b.price
      : sort === "price-high"
        ? b.price - a.price
        : sort === "rating"
          ? b.rating - a.rating
          : b.salesCount - a.salesCount ||
            b.viewCount - a.viewCount ||
            b.reviewCount - a.reviewCount,
  );
  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(result.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const visibleProducts = result.slice((page - 1) * pageSize, page * pageSize);

  const active = [
    ["category", category],
    ["subcategory", subcategory],
    ["raw", rawProduct],
    ["shop", shop],
    ["graphic", graphic],
    ["color", color],
    ["size", size],
    ["gender", gender],
    ["rating", rating ? `${rating}+` : ""],
    ["discount", discount],
  ] as const;

  return (
    <main className="browse-page">
      <section className="browse-hero">
        <div className="shop-container">
          <span>
            <Sparkles size={15} /> کشفِ چیزهای غیرتکراری
          </span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
      </section>
      <div className="shop-container browse-toolbar">
        <div>
          <button
            className="mobile-filter"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={17} /> فیلترها
          </button>
          <strong>{result.length.toLocaleString("fa-IR")} محصول</strong>
        </div>
        <label>
          مرتب‌سازی
          <select
            value={sort}
            onChange={(event) =>
              router.push(filterHref(params, "sort", event.target.value))
            }
          >
            <option value="popular">محبوب‌ترین</option>
            <option value="rating">بالاترین امتیاز</option>
            <option value="price-low">ارزان‌ترین</option>
            <option value="price-high">گران‌ترین</option>
          </select>
        </label>
      </div>
      <div className="shop-container active-filters">
        {active
          .filter(([, activeValue]) => activeValue)
          .map(([key, activeValue]) => (
            <Link href={filterHref(params, key)} key={key}>
              {activeValue}
              <X size={13} />
            </Link>
          ))}
      </div>
      <div className="shop-container browse-layout">
        {filtersOpen && (
          <button
            className="filter-mobile-backdrop"
            onClick={() => setFiltersOpen(false)}
            aria-label="بستن فیلترها"
          />
        )}
        <aside className={`filter-sidebar ${filtersOpen ? "mobile-open" : ""}`}>
          <button
            className="filter-mobile-close"
            onClick={() => setFiltersOpen(false)}
          >
            <X /> بستن
          </button>
          <Filter
            title="دسته‌بندی"
            items={categories.map((item) => [item.name, item.slug])}
            current={category}
            params={params}
            field="category"
          />
          <Filter
            title="نوع محصول"
            items={subcategories.map((item) => [item.name, item.slug])}
            current={subcategory}
            params={params}
            field="subcategory"
          />
          <Filter
            title="محصول خام"
            items={rawProducts.map((item) => [item, item])}
            current={rawProduct}
            params={params}
            field="raw"
          />
          <Filter
            title="سبک گرافیک"
            items={graphicStyles.map((item) => [item.name, item.slug])}
            current={graphic}
            params={params}
            field="graphic"
          />
          <Filter
            title="فروشگاه"
            items={shops.map((item) => [item.name, item.slug])}
            current={shop}
            params={params}
            field="shop"
          />
          <Filter
            title="رنگ"
            items={colors.map((item) => [item, item])}
            current={color}
            params={params}
            field="color"
          />
          {relevantSizes.length > 0 && (
            <Filter
              title="اندازه"
              items={relevantSizes.map((item) => [item, item])}
              current={size}
              params={params}
              field="size"
            />
          )}
          <Filter
            title="جنسیت"
            items={[["مردانه", "MALE"], ["زنانه", "FEMALE"], ["یونیسکس", "UNISEX"]]}
            current={gender}
            params={params}
            field="gender"
          />
          <Filter
            title="امتیاز"
            items={[
              ["۴.۸ به بالا", "4.8"],
              ["۴.۷ به بالا", "4.7"],
              ["۴.۵ به بالا", "4.5"],
            ]}
            current={rating ? String(rating) : undefined}
            params={params}
            field="rating"
          />
          <Filter
            title="پیشنهادها"
            items={[["فقط تخفیف‌دارها", "yes"]]}
            current={discount}
            params={params}
            field="discount"
          />
        </aside>
        <section>
          {result.length ? (
            <>
              <div className="product-grid browse-grid">
                {visibleProducts.map((product) => (
                  <ProductCard product={product} liked={likedProductIds.includes(product.id)} key={product.id} />
                ))}
              </div>
              {totalPages > 1 && (
                <nav
                  className="browse-pagination"
                  aria-label="صفحه‌بندی محصولات"
                >
                  <Link
                    aria-disabled={page === 1}
                    href={filterHref(
                      params,
                      "page",
                      String(Math.max(1, page - 1)),
                    )}
                  >
                    قبلی
                  </Link>
                  <span>
                    صفحه {page.toLocaleString("fa-IR")} از{" "}
                    {totalPages.toLocaleString("fa-IR")}
                  </span>
                  <Link
                    aria-disabled={page === totalPages}
                    href={filterHref(
                      params,
                      "page",
                      String(Math.min(totalPages, page + 1)),
                    )}
                  >
                    بعدی
                  </Link>
                </nav>
              )}
            </>
          ) : (
            <div className="no-results">
              <Sparkles />
              <h2>این ترکیب هنوز محصولی ندارد</h2>
              <p>یک فیلتر را بردار یا بین سبک‌های نزدیک بچرخ.</p>
              <Link href="?">پاک‌کردن همه فیلترها</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Filter({
  title,
  items,
  current,
  params,
  field,
}: {
  title: string;
  items: string[][];
  current?: string;
  params: Params;
  field: string;
}) {
  return (
    <details open>
      <summary>{title}</summary>
      <div>
        {items.map(([label, itemValue]) => (
          <Link
            className={current === itemValue ? "active" : ""}
            href={filterHref(
              params,
              field,
              current === itemValue ? undefined : itemValue,
            )}
            key={itemValue}
          >
            <i />
            {label}
          </Link>
        ))}
      </div>
    </details>
  );
}
