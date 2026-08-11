"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart-context";

export function PaymentSuccessCleanup() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
    window.localStorage.removeItem("chaplly_pending_payment");
  }, [clear]);
  return null;
}
