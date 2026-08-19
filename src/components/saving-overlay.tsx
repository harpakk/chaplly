"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

export function SavingOverlay({
  visible,
  text = "در حال ذخیره اطلاعات…",
  steps,
}: {
  visible: boolean;
  text?: string;
  steps?: string[];
}) {
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(8);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const submitterRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => setMounted(true), []);
  const stepSignature = steps?.join("|") || "";
  useEffect(() => {
    if (!visible || !steps?.length) {
      setProgress(8);
      return;
    }
    setProgress(8);
    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(94, value + Math.max(1, Math.round((94 - value) * 0.08))));
    }, 700);
    return () => window.clearInterval(timer);
  }, [visible, stepSignature]); // eslint-disable-line react-hooks/exhaustive-deps
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
            {steps?.length ? (
              <div className="saving-progress">
                <span><b>{Math.round(progress).toLocaleString("fa-IR")}٪</b>مرحله تقریبی: {steps[Math.min(steps.length - 1, Math.floor(progress / (95 / steps.length)))]}</span>
                <i><b style={{ width: `${progress}%` }} /></i>
              </div>
            ) : <small>لطفاً کمی منتظر بمانید…</small>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
