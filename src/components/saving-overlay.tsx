"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export function SavingOverlay({
  visible,
  text = "در حال ذخیره اطلاعات…",
}: {
  visible: boolean;
  text?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !visible) return null;
  return createPortal(
    <div
      className="saving-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="saving-orbit" aria-hidden="true">
        <i />
        <i />
        <span>چ</span>
      </div>
      <strong>{text}</strong>
      <small>فقط چند لحظه؛ صفحه را نبند.</small>
    </div>,
    document.body,
  );
}
