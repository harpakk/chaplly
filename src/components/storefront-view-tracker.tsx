"use client";

import { useEffect } from "react";

export function StorefrontViewTracker({ storeId }: { storeId: string }) {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const visitKey = `chapli-store-view:${storeId}:${today}`;
    if (localStorage.getItem(visitKey)) return;
    const visitorKey = "chapli-analytics-visitor";
    const visitorId =
      localStorage.getItem(visitorKey) || crypto.randomUUID();
    localStorage.setItem(visitorKey, visitorId);
    localStorage.setItem(visitKey, "1");
    const body = JSON.stringify({ storeId, visitorId });
    if (
      !navigator.sendBeacon?.(
        "/api/analytics/storefront-view",
        new Blob([body], { type: "application/json" }),
      )
    )
      void fetch("/api/analytics/storefront-view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      });
  }, [storeId]);
  return null;
}
