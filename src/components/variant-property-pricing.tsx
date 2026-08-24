"use client";

import { useEffect, useState } from "react";
import { formatRial } from "@/lib/catalog";

export type PricingVariant = { rawProductVariantId: string; colorId: string; colorName: string; sizeId: string; sizeName: string; supplierCost: number; markupPercentage?: number };
export type PropertyPrices = { colors: Record<string, number>; sizes: Record<string, number>; touched: Record<string, boolean> };
export type SavedPropertyMarkup = { dimension: "COLOR" | "SIZE"; propertyId: string; markupPercentage: number };
type Dimension = "colors" | "sizes";
const DEFAULT_MARKUP = 30;
const roundRial = (value: number) => Math.ceil(Math.max(0, value) / 1000) * 1000;

function properties(variants: PricingVariant[], dimension: Dimension) {
  const idKey = dimension === "colors" ? "colorId" : "sizeId";
  const nameKey = dimension === "colors" ? "colorName" : "sizeName";
  return [...new Map(variants.map((variant) => [variant[idKey], { id: variant[idKey], name: variant[nameKey], variants: variants.filter((item) => item[idKey] === variant[idKey]) }])).values()];
}

const highestSupplierCost = (variants: PricingVariant[]) => Math.max(1, ...variants.map((variant) => Number(variant.supplierCost || 0)));
const priceFromMarkup = (cost: number, markup: number) => roundRial(cost * (1 + Math.max(0, markup) / 100));
const markupFromPrice = (cost: number, price: number) => Math.round(Math.max(0, (price / cost - 1) * 100) * 10_000) / 10_000;
const formattedPrice = (value: number) => Math.max(0, Math.floor(value)).toLocaleString("en-US");
const parsedPrice = (value: string) => Number(value.replace(/[٬,\s]/g, "")) || 0;

function PriceInput({ label, minimum, value, onChange }: { label: string; minimum: number; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(formattedPrice(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(formattedPrice(value));
  }, [focused, value]);
  const commit = (nextDraft: string) => {
    const nextValue = roundRial(Math.max(minimum, parsedPrice(nextDraft)));
    onChange(nextValue);
    return nextValue;
  };
  return <input dir="ltr" inputMode="numeric" aria-label={label} type="text" required value={draft} onFocus={() => setFocused(true)} onChange={(event) => {
    const raw = event.target.value.replace(/[٬,\s]/g, "").replace(/\D/g, "");
    setDraft(raw ? formattedPrice(Number(raw)) : "");
    if (raw) onChange(Number(raw));
  }} onBlur={() => {
    setFocused(false);
    setDraft(formattedPrice(commit(draft)));
  }} />;
}

export function createPropertyPrices(variants: PricingVariant[], saved: SavedPropertyMarkup[] = []): PropertyPrices {
  const savedMap = new Map(saved.map((item) => [`${item.dimension}:${item.propertyId}`, item.markupPercentage]));
  const create = (dimension: Dimension) => Object.fromEntries(properties(variants, dimension).map((item) => {
    const key = `${dimension === "colors" ? "COLOR" : "SIZE"}:${item.id}`;
    const fallbackMarkup = Math.max(0, ...item.variants.map((variant) => Number(variant.markupPercentage ?? DEFAULT_MARKUP)));
    return [item.id, priceFromMarkup(highestSupplierCost(item.variants), Number(savedMap.get(key) ?? fallbackMarkup))];
  }));
  return { colors: create("colors"), sizes: create("sizes"), touched: {} };
}

export function expandPropertyPrices(variants: PricingVariant[], prices: PropertyPrices) {
  return variants.map((variant) => {
    const defaultPrice = priceFromMarkup(variant.supplierCost, variant.markupPercentage ?? DEFAULT_MARKUP);
    const consumerPrice = Math.max(variant.supplierCost, Number(prices.colors[variant.colorId] || defaultPrice), Number(prices.sizes[variant.sizeId] || defaultPrice));
    return { rawProductVariantId: variant.rawProductVariantId, consumerPrice: roundRial(consumerPrice) };
  });
}

export function serializePropertyPrices(variants: PricingVariant[], prices: PropertyPrices) {
  return (["colors", "sizes"] as Dimension[]).flatMap((dimension) => properties(variants, dimension).map((item) => {
    const cost = highestSupplierCost(item.variants);
    const consumerPrice = Math.max(cost, Number(prices[dimension][item.id] || cost));
    const roundedPrice = roundRial(consumerPrice);
    return { dimension: dimension === "colors" ? "COLOR" as const : "SIZE" as const, propertyId: item.id, consumerPrice: roundedPrice, markupPercentage: markupFromPrice(cost, roundedPrice) };
  }));
}

export function VariantPropertyPricing({ variants, value, onChange }: { variants: PricingVariant[]; value: PropertyPrices; onChange: (value: PropertyPrices) => void }) {
  const effective = (dimension: Dimension, id: string, related: PricingVariant[]) => Math.max(highestSupplierCost(related), Number(value[dimension][id] || 0));
  const update = (dimension: Dimension, id: string, price: number, related: PricingVariant[]) => onChange({ ...value, [dimension]: { ...value[dimension], [id]: Math.max(highestSupplierCost(related), Math.floor(price || 0)) }, touched: { ...value.touched, [`${dimension === "colors" ? "COLOR" : "SIZE"}:${id}`]: true } });
  const adjustAll = (factor: number) => {
    const adjust = (dimension: Dimension) => Object.fromEntries(properties(variants, dimension).map((item) => {
      const minimum = highestSupplierCost(item.variants);
      return [item.id, roundRial(Math.max(minimum, effective(dimension, item.id, item.variants) * factor))];
    }));
    onChange({ colors: adjust("colors"), sizes: adjust("sizes"), touched: Object.fromEntries((["colors", "sizes"] as Dimension[]).flatMap((dimension) => properties(variants, dimension).map((item) => [`${dimension === "colors" ? "COLOR" : "SIZE"}:${item.id}`, true]))) });
  };
  const group = (dimension: Dimension, title: string) => <section className="property-price-group"><h4>{title}</h4><div className="variant-price-grid">{properties(variants, dimension).map((item) => {
    const supplierCost = highestSupplierCost(item.variants);
    const consumerPrice = effective(dimension, item.id, item.variants);
    return <label key={item.id}><span className="property-price-name">{dimension === "colors" ? "🎨" : "📐"} {item.name}</span><div className="markup-input"><PriceInput label={`قیمت فروش ${item.name}`} minimum={supplierCost} value={consumerPrice} onChange={(price) => update(dimension, item.id, price, item.variants)}/><b>ریال</b></div><small className="property-price-facts"><span>🛡️ حداقل {formatRial(supplierCost)}</span><span>✨ سود {formatRial(consumerPrice - supplierCost)}</span></small></label>;
  })}</div></section>;
  return <><div className="variant-price-heading"><div><h3>قیمت فروش به مشتری برای رنگ‌ها و سایزها</h3><small>قیمت نهایی را وارد کنید. درصد سود پشت‌صحنه محاسبه و ذخیره می‌شود؛ قیمت هیچ تنوعی نمی‌تواند از هزینه تأمین آن کمتر باشد.</small></div><div className="variant-price-bulk-actions"><button type="button" onClick={() => adjustAll(0.9)}>۱۰٪ کاهش همه قیمت‌ها</button><button type="button" onClick={() => adjustAll(1.1)}>۱۰٪ افزایش همه قیمت‌ها</button></div></div><div className="property-price-layout">{group("colors", "قیمت بر اساس رنگ")}{group("sizes", "قیمت بر اساس سایز")}</div></>;
}
