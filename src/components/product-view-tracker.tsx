"use client";

import { useEffect } from "react";
import { recordProductViewAction } from "@/app/actions/dashboard";
import { SiteViewTracker } from "@/components/site-view-tracker";

export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    void recordProductViewAction(productId);
  }, [productId]);
  return <SiteViewTracker kind="product" />;
}
