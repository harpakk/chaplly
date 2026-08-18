"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

export function SavingOverlay({
  visible,
  text = "در حال ذخیره اطلاعات…",
}: {
  visible: boolean;
  text?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const submitterRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;
    const rememberSubmitter = (event: SubmitEvent) => {
      const submitter = event.submitter;
      submitterRef.current = submitter instanceof HTMLButtonElement ? submitter : null;
    };
    form.addEventListener("submit", rememberSubmitter);
    return () => form.removeEventListener("submit", rememberSubmitter);
  }, []);
  useEffect(() => {
    const button = submitterRef.current;
    if (visible) button?.setAttribute("data-action-waiting", "true");
    else {
      button?.removeAttribute("data-action-waiting");
      submitterRef.current = null;
    }
    return () => button?.removeAttribute("data-action-waiting");
  }, [visible]);
  return (
    <>
      <span ref={anchorRef} className="saving-feedback-anchor" aria-hidden="true" />
      {mounted && visible && createPortal(
        <div
          className="saving-overlay"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="saving-orbit" aria-hidden="true"><i /></div>
          <div>
            <strong>{text}</strong>
            <small>لطفاً کمی منتظر بمانید…</small>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
