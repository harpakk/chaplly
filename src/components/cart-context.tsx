"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  productId: string;
  variantId: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  compareAtPrice?: number;
  color: string;
  size: string;
  quantity: number;
};

export type AppliedCoupon = { code: string; discountAmount: number };

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  coupon: AppliedCoupon | null;
  setCoupon: (coupon: AppliedCoupon | null) => void;
  addItem: (item: CartItem) => void;
  updateQuantity: (index: number, quantity: number) => void;
  removeItem: (index: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [coupon, setCouponState] = useState<AppliedCoupon | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("chapli_cart");
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        const validItems = Array.isArray(parsed)
          ? parsed.filter(
              (item): item is CartItem =>
                Boolean(item) &&
                typeof item === "object" &&
                "variantId" in item &&
                typeof item.variantId === "string" &&
                /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(item.variantId) &&
                "quantity" in item &&
                Number.isInteger(Number(item.quantity)) &&
                Number(item.quantity) >= 1 &&
                Number(item.quantity) <= 99,
            )
          : [];
        setItems(validItems);
        window.localStorage.setItem("chapli_cart", JSON.stringify(validItems));
      } catch {
        window.localStorage.removeItem("chapli_cart");
      }
    }
    const storedCoupon = window.localStorage.getItem("chapli_coupon");
    if (storedCoupon) {
      try {
        const parsed = JSON.parse(storedCoupon) as AppliedCoupon;
        if (/^\d{1,6}$/.test(parsed.code) && Number(parsed.discountAmount) > 0)
          setCouponState(parsed);
      } catch {
        window.localStorage.removeItem("chapli_coupon");
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    fetch("/api/cart", {
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (result) => {
        if (!result.ok) return null;
        return (await result.json()) as { items?: CartItem[] };
      })
      .then((result) => {
        if (!result) return;
        setCloudEnabled(true);
        setItems((local) => {
          const merged = new Map(local.map((item) => [item.variantId, item]));
          for (const remote of result.items || []) {
            const existing = merged.get(remote.variantId);
            merged.set(
              remote.variantId,
              existing
                ? { ...remote, quantity: Math.max(existing.quantity, remote.quantity) }
                : remote,
            );
          }
          return [...merged.values()];
        });
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem("chapli_cart", JSON.stringify(items));
  }, [items, ready]);

  useEffect(() => {
    if (!ready) return;
    if (coupon) window.localStorage.setItem("chapli_coupon", JSON.stringify(coupon));
    else window.localStorage.removeItem("chapli_coupon");
  }, [coupon, ready]);

  useEffect(() => {
    if (!ready || !cloudEnabled) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/cart", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [items, ready, cloudEnabled]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      coupon,
      setCoupon: setCouponState,
      addItem: (item) =>
        setItems((current) => {
          setCouponState(null);
          const match = current.findIndex(
            (entry) =>
              entry.productId === item.productId &&
              entry.variantId === item.variantId &&
              entry.color === item.color &&
              entry.size === item.size,
          );
          if (match === -1) return [...current, item];
          return current.map((entry, index) =>
            index === match ? { ...entry, quantity: entry.quantity + item.quantity } : entry,
          );
        }),
      updateQuantity: (index, quantity) =>
        setItems((current) =>
          (setCouponState(null),
          quantity <= 0
            ? current.filter((_, itemIndex) => itemIndex !== index)
            : current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, quantity: Math.min(99, quantity) } : item,
              )),
        ),
      removeItem: (index) =>
        setItems((current) => (setCouponState(null), current.filter((_, itemIndex) => itemIndex !== index))),
      clear: () => { setItems([]); setCouponState(null); },
    }),
    [items, coupon],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
