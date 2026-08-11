"use client";

import { useEffect } from "react";

export function SiteViewTracker({ kind }: { kind: "index" | "product" }) {
  useEffect(() => {
    const key = `chapli-view-${kind}-${location.pathname}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const body = JSON.stringify({ kind });
    if (!navigator.sendBeacon?.("/api/analytics/view", new Blob([body], { type: "application/json" })))
      void fetch("/api/analytics/view", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  }, [kind]);
  return null;
}

