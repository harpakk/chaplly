import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOrderEconomics,
  canPublishVariant,
  canTransitionOrder,
  maskFinancialIdentifier,
  normalizeStoreSlug,
  scoreSupplierOffer,
} from "../../src/lib/domain-rules";

test("order transitions reject terminal-state mutations", () => {
  assert.equal(canTransitionOrder("SENT", "DONE"), true);
  assert.equal(canTransitionOrder("DONE", "CONFIRMED"), false);
  assert.equal(canTransitionOrder("CANCELLED", "IN_PRODUCTION"), false);
});

test("order economics reconcile exactly in integer rial", () => {
  assert.deepEqual(
    calculateOrderEconomics({
      unitPrice: 12_900_000,
      supplierCost: 8_060_000,
      quantity: 2,
      platformFeeRate: 0.1,
    }),
    {
      gross: 25_800_000,
      supplier: 16_120_000,
      platformFee: 968_000,
      sellerNet: 8_712_000,
    },
  );
  assert.throws(() =>
    calculateOrderEconomics({
      unitPrice: -1,
      supplierCost: 1,
      quantity: 1,
      platformFeeRate: 0.1,
    }),
  );
});

test("supplier routing excludes unavailable offers", () => {
  assert.equal(
    scoreSupplierOffer({
      active: true,
      variantAvailable: false,
      unitCost: 1,
      leadTimeDays: 1,
      dailyCapacity: 100,
    }),
    Number.NEGATIVE_INFINITY,
  );
  assert.ok(
    scoreSupplierOffer({
      active: true,
      variantAvailable: true,
      unitCost: 5_000_000,
      leadTimeDays: 2,
      dailyCapacity: 200,
    }) >
      scoreSupplierOffer({
        active: true,
        variantAvailable: true,
        unitCost: 8_000_000,
        leadTimeDays: 5,
        dailyCapacity: 40,
      }),
  );
});

test("store slugs are normalized and reserved values are rejected", () => {
  assert.equal(normalizeStoreSlug("  My Cool Store  "), "my-cool-store");
  assert.throws(() => normalizeStoreSlug("admin"));
});

test("an unassigned seller variant remains unavailable", () => {
  assert.equal(canPublishVariant({ hasDesign: true, hasSupplier: false }), false);
  assert.equal(canPublishVariant({ hasDesign: true, hasSupplier: true }), true);
});

test("financial identifiers are masked", () => {
  assert.equal(maskFinancialIdentifier("6104 3378 1234 4210"), "••••••••••••4210");
});
