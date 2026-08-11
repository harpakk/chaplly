"use client";

import { useEffect } from "react";

const excludedRefPaths = /^\/(api|admin|account|checkout|payment|order-success|orders|seller\/dashboard|supplier\/dashboard)(\/|$)/;

export function AttributionTracker() {
  useEffect(() => {
    const url = new URL(location.href);
    if (excludedRefPaths.test(url.pathname)) return;
    const rawRef = (url.searchParams.get("ref") || "").trim();
    const sessionKey = rawRef
      ? `chapli-attribution-ref-${rawRef.slice(0, 80).toLowerCase()}`
      : "chapli-attribution-visit";
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    let source: "DIRECT" | "GOOGLE" | "REFERRAL" | "OTHER" = rawRef
      ? "REFERRAL"
      : "DIRECT";
    if (!rawRef && document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.hostname !== location.hostname)
          source = /(^|\.)google\./i.test(referrer.hostname) ? "GOOGLE" : "OTHER";
      } catch {}
    }
    const body = JSON.stringify({
      ref: rawRef || null,
      source,
      landing: url.pathname.slice(0, 500),
    });
    void fetch("/api/analytics/attribution", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  }, []);
  return null;
}
