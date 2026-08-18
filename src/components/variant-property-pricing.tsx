"use client";

import { formatRial } from "@/lib/catalog";

export type PricingVariant = {
  rawProductVariantId: string;
  colorId: string;
  colorName: string;
  sizeId: string;
  sizeName: string;
  minimumPrice: number;
  price: number;
  isSavedPrice?: boolean;
};

export type PropertyPrices = {
  colors: Record<string, number>;
  sizes: Record<string, number>;
};

type Dimension = "colors" | "sizes";

function properties(variants: PricingVariant[], dimension: Dimension) {
  const idKey = dimension === "colors" ? "colorId" : "sizeId";
  const nameKey = dimension === "colors" ? "colorName" : "sizeName";
  return [...new Map(variants.map((variant) => [variant[idKey], {
    id: variant[idKey],
    name: variant[nameKey],
    variants: variants.filter((item) => item[idKey] === variant[idKey]),
  }])).values()];
}

function propertyMinimum(item: { variants: PricingVariant[] }) {
  return Math.max(1, ...item.variants.map((variant) => variant.minimumPrice));
}

export function createPropertyPrices(variants: PricingVariant[]): PropertyPrices {
  const create = (dimension: Dimension) => Object.fromEntries(
    properties(variants, dimension).map((item) => {
      const saved = item.variants
        .filter((variant) => variant.isSavedPrice)
        .map((variant) => variant.price)
        .filter((price) => price > 0);
      const defaults = item.variants.map((variant) => variant.price).filter((price) => price > 0);
      return [item.id, Math.max(1, saved.length ? Math.min(...saved) : Math.max(1, ...defaults))];
    }),
  );
  return { colors: create("colors"), sizes: create("sizes") };
}

export function expandPropertyPrices(
  variants: PricingVariant[],
  prices: PropertyPrices,
) {
  return variants.map((variant) => ({
    rawProductVariantId: variant.rawProductVariantId,
    price: Math.max(
      Number(prices.colors[variant.colorId] || 0),
      Number(prices.sizes[variant.sizeId] || 0),
    ),
  }));
}

export function VariantPropertyPricing({
  variants,
  value,
  onChange,
}: {
  variants: PricingVariant[];
  value: PropertyPrices;
  onChange: (value: PropertyPrices) => void;
}) {
  const effective = (dimension: Dimension, id: string) =>
    Math.max(1, Number(value[dimension][id] || 0));
  const update = (dimension: Dimension, id: string, price: number) =>
    onChange({
      ...value,
      [dimension]: { ...value[dimension], [id]: Math.max(1, price) },
    });
  const adjustAll = (factor: number) => {
    const adjust = (dimension: Dimension) => Object.fromEntries(
      properties(variants, dimension).map((item) => {
        return [item.id, Math.max(1, Math.round(effective(dimension, item.id) * factor))];
      }),
    );
    onChange({ colors: adjust("colors"), sizes: adjust("sizes") });
  };
  const group = (dimension: Dimension, title: string) => (
    <section className="property-price-group">
      <h4>{title}</h4>
      <div className="variant-price-grid">
        {properties(variants, dimension).map((item) => {
          const minimum = propertyMinimum(item);
          const price = effective(dimension, item.id);
          return (
            <label key={item.id}>
              <span>{item.name}</span>
              <input
                type="number"
                min={1}
                required
                value={price}
                onChange={(event) => update(dimension, item.id, Number(event.target.value))}
              />
              <small>بالاترین حداقلِ ترکیب مرتبط: {formatRial(minimum)}</small>
            </label>
          );
        })}
      </div>
    </section>
  );
  return (
    <>
      <div className="variant-price-heading">
        <div>
          <h3>قیمت رنگ‌ها و سایزها</h3>
          <small>قیمت هر ترکیب به‌صورت خودکار از عدد گران‌ترِ رنگ یا سایز محاسبه می‌شود.</small>
        </div>
        <div className="variant-price-bulk-actions">
          <button type="button" onClick={() => adjustAll(0.9)}>−۱۰٪ همه</button>
          <button type="button" onClick={() => adjustAll(1.1)}>+۱۰٪ همه</button>
        </div>
      </div>
      <div className="property-price-layout">
        {group("colors", "قیمت بر اساس رنگ")}
        {group("sizes", "قیمت بر اساس سایز")}
      </div>
    </>
  );
}
