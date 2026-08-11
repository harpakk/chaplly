const orderTransitions: Record<string, readonly string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PRODUCTION", "CANCELLED", "DISPUTED"],
  IN_PRODUCTION: ["READY_TO_SHIP", "CANCELLED", "DISPUTED"],
  READY_TO_SHIP: ["SENT", "CANCELLED", "DISPUTED"],
  SENT: ["DONE", "RETURNED", "DISPUTED"],
  DONE: ["RETURNED", "DISPUTED"],
  DISPUTED: ["IN_PRODUCTION", "SENT", "DONE", "RETURNED", "CANCELLED"],
  RETURNED: [],
  CANCELLED: [],
};

export function canTransitionOrder(from: string, to: string) {
  return from === to || (orderTransitions[from] || []).includes(to);
}

export function calculateOrderEconomics(input: {
  unitPrice: number;
  supplierCost: number;
  quantity: number;
  platformFeeRate: number;
}) {
  const { unitPrice, supplierCost, quantity, platformFeeRate } = input;
  if (
    !Number.isInteger(unitPrice) ||
    !Number.isInteger(supplierCost) ||
    !Number.isInteger(quantity) ||
    unitPrice < 0 ||
    supplierCost < 0 ||
    quantity < 1 ||
    platformFeeRate < 0 ||
    platformFeeRate > 1
  )
    throw new Error("INVALID_ORDER_ECONOMICS");
  const gross = unitPrice * quantity;
  const supplier = supplierCost * quantity;
  const creatorMargin = Math.max(0, gross - supplier);
  const platformFee = Math.round(creatorMargin * platformFeeRate);
  return {
    gross,
    supplier,
    platformFee,
    sellerNet: creatorMargin - platformFee,
  };
}

export function scoreSupplierOffer(input: {
  active: boolean;
  variantAvailable: boolean;
  unitCost: number;
  leadTimeDays: number;
  dailyCapacity: number;
}) {
  if (!input.active || !input.variantAvailable) return Number.NEGATIVE_INFINITY;
  const costPenalty = Math.max(0, input.unitCost) / 100_000;
  const leadPenalty = Math.max(0, input.leadTimeDays) * 20;
  const capacityBonus = Math.min(Math.max(0, input.dailyCapacity), 500);
  return capacityBonus - costPenalty - leadPenalty;
}

export function normalizeStoreSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  const reserved = new Set([
    "www",
    "app",
    "admin",
    "api",
    "seller",
    "supplier",
    "support",
    "static",
  ]);
  if (slug.length < 3 || slug.length > 48 || reserved.has(slug))
    throw new Error("INVALID_OR_RESERVED_STORE_SLUG");
  return slug;
}

export function canPublishVariant(input: {
  hasDesign: boolean;
  hasSupplier: boolean;
}) {
  return input.hasDesign && input.hasSupplier;
}

export function maskFinancialIdentifier(value: string, visible = 4) {
  const normalized = value.replace(/\s+/g, "");
  if (normalized.length <= visible) return normalized;
  return `${"•".repeat(normalized.length - visible)}${normalized.slice(-visible)}`;
}
