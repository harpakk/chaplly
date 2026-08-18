"use client";

import { formatRial } from "@/lib/catalog";

export type PricingVariant = { rawProductVariantId: string; colorId: string; colorName: string; sizeId: string; sizeName: string; supplierCost: number; markupPercentage?: number };
export type PropertyMarkups = { colors: Record<string, number>; sizes: Record<string, number>; touched: Record<string, boolean> };
export type SavedPropertyMarkup = { dimension: "COLOR" | "SIZE"; propertyId: string; markupPercentage: number };
type Dimension = "colors" | "sizes";
const MINIMUM_MARKUP = 10;

function properties(variants: PricingVariant[], dimension: Dimension) {
  const idKey = dimension === "colors" ? "colorId" : "sizeId";
  const nameKey = dimension === "colors" ? "colorName" : "sizeName";
  return [...new Map(variants.map((variant) => [variant[idKey], { id: variant[idKey], name: variant[nameKey], variants: variants.filter((item) => item[idKey] === variant[idKey]) }])).values()];
}

export function createPropertyMarkups(variants: PricingVariant[], saved: SavedPropertyMarkup[] = []): PropertyMarkups {
  const savedMap = new Map(saved.map((item) => [`${item.dimension}:${item.propertyId}`, item.markupPercentage]));
  const create = (dimension: Dimension) => Object.fromEntries(properties(variants, dimension).map((item) => {
    const key = `${dimension === "colors" ? "COLOR" : "SIZE"}:${item.id}`;
    const fallback = Math.max(MINIMUM_MARKUP, ...item.variants.map((variant) => Number(variant.markupPercentage || 30)));
    return [item.id, Math.max(MINIMUM_MARKUP, Number(savedMap.get(key) ?? fallback))];
  }));
  return { colors: create("colors"), sizes: create("sizes"), touched: {} };
}

export function expandPropertyMarkups(variants: PricingVariant[], markups: PropertyMarkups) {
  return variants.map((variant) => {
    const changed = markups.touched[`COLOR:${variant.colorId}`] || markups.touched[`SIZE:${variant.sizeId}`];
    const markupPercentage = changed
      ? Math.max(Number(markups.colors[variant.colorId] || MINIMUM_MARKUP), Number(markups.sizes[variant.sizeId] || MINIMUM_MARKUP))
      : Math.max(MINIMUM_MARKUP, Number(variant.markupPercentage || 30));
    return { rawProductVariantId: variant.rawProductVariantId, markupPercentage, price: Math.ceil(variant.supplierCost * (1 + markupPercentage / 100)) };
  });
}

export function serializePropertyMarkups(variants: PricingVariant[], markups: PropertyMarkups): SavedPropertyMarkup[] {
  return (["colors", "sizes"] as Dimension[]).flatMap((dimension) => properties(variants, dimension).map((item) => ({
    dimension: dimension === "colors" ? "COLOR" as const : "SIZE" as const,
    propertyId: item.id,
    markupPercentage: Number(markups[dimension][item.id] || MINIMUM_MARKUP),
  })));
}

export function VariantPropertyPricing({ variants, value, onChange }: { variants: PricingVariant[]; value: PropertyMarkups; onChange: (value: PropertyMarkups) => void }) {
  const effective = (dimension: Dimension, id: string) => Math.max(MINIMUM_MARKUP, Number(value[dimension][id] || 0));
  const update = (dimension: Dimension, id: string, markup: number) => onChange({ ...value, [dimension]: { ...value[dimension], [id]: Math.max(MINIMUM_MARKUP, markup) }, touched: { ...value.touched, [`${dimension === "colors" ? "COLOR" : "SIZE"}:${id}`]: true } });
  const adjustAll = (points: number) => {
    const adjust = (dimension: Dimension) => Object.fromEntries(properties(variants, dimension).map((item) => [item.id, Math.max(MINIMUM_MARKUP, effective(dimension, item.id) + points)]));
    onChange({ colors: adjust("colors"), sizes: adjust("sizes"), touched: Object.fromEntries((["colors", "sizes"] as Dimension[]).flatMap((dimension) => properties(variants, dimension).map((item) => [`${dimension === "colors" ? "COLOR" : "SIZE"}:${item.id}`, true]))) });
  };
  const group = (dimension: Dimension, title: string) => <section className="property-price-group"><h4>{title}</h4><div className="variant-price-grid">{properties(variants, dimension).map((item) => {
    const markup = effective(dimension, item.id);
    const highestCost = Math.max(0, ...item.variants.map((variant) => variant.supplierCost));
    return <label key={item.id}><span>{item.name}</span><div className="markup-input"><input type="number" min={MINIMUM_MARKUP} max={10000} step="1" required value={markup} onChange={(event) => update(dimension, item.id, Number(event.target.value))}/><b>٪</b></div><small>نمونه قیمت با بیشترین هزینه مرتبط: {formatRial(Math.ceil(highestCost * (1 + markup / 100)))}</small></label>;
  })}</div></section>;
  return <><div className="variant-price-heading"><div><h3>درصد افزایش قیمت رنگ‌ها و سایزها</h3><small>قیمت هر تنوع همیشه از هزینه روز تأمین‌کننده × درصد گران‌ترِ رنگ یا سایز محاسبه می‌شود.</small></div><div className="variant-price-bulk-actions"><button type="button" onClick={() => adjustAll(-10)}>−۱۰ واحد درصد همه</button><button type="button" onClick={() => adjustAll(10)}>+۱۰ واحد درصد همه</button></div></div><div className="property-price-layout">{group("colors", "درصد بر اساس رنگ")}{group("sizes", "درصد بر اساس سایز")}</div></>;
}
