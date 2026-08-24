"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, HelpCircle, X } from "lucide-react";
import { updateSellerTourAction } from "@/app/actions/seller-tour";
import {
  shouldAutoShowSellerTour,
  type SellerTourName,
  type SellerTourState,
} from "@/lib/seller-tour-shared";

export type SellerTourStep = {
  target?: string;
  emoji: string;
  title: string;
  body: string;
  hint?: string;
};

type TargetBox = { top: number; left: number; width: number; height: number };

export function SellerOnboardingTour({
  tour,
  state,
  steps,
}: {
  tour: SellerTourName;
  state: SellerTourState;
  steps: SellerTourStep[];
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(Math.min(state.steps[tour], Math.max(0, steps.length - 1)));
  const [target, setTarget] = useState<TargetBox | null>(null);
  const [, startTransition] = useTransition();
  const current = steps[step];

  const persist = useCallback((event: "shown" | "progress" | "completed" | "skipped" | "dont_show", nextStep = step) => {
    startTransition(() => void updateSellerTourAction({ tour, event, step: nextStep }));
  }, [step, tour]);

  const open = useCallback((fromStart = false) => {
    const next = fromStart ? 0 : Math.min(state.steps[tour], Math.max(0, steps.length - 1));
    setStep(next);
    setVisible(true);
    persist("shown", next);
  }, [persist, state.steps, steps.length, tour]);

  useEffect(() => {
    setMounted(true);
    if (shouldAutoShowSellerTour(state, tour)) open(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ tour?: SellerTourName }>).detail;
      if (!detail?.tour || detail.tour === tour) open(true);
    };
    window.addEventListener("chapli:tour:start", listener);
    return () => window.removeEventListener("chapli:tour:start", listener);
  }, [open, tour]);

  const measure = useCallback(() => {
    if (!visible || !current?.target) return setTarget(null);
    const element = document.querySelector<HTMLElement>(current.target);
    if (!element || element.offsetParent === null) return setTarget(null);
    const rect = element.getBoundingClientRect();
    setTarget({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [current?.target, visible]);

  useEffect(() => {
    if (!visible) return;
    const element = current?.target
      ? document.querySelector<HTMLElement>(current.target)
      : null;
    element?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const timer = window.setTimeout(measure, 240);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current?.target, measure, visible]);

  useEffect(() => {
    if (!visible) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        persist("skipped");
        setVisible(false);
      }
      if (event.key === "ArrowLeft" && step < steps.length - 1) {
        const next = step + 1;
        setStep(next);
        persist("progress", next);
      }
      if (event.key === "ArrowRight" && step > 0) setStep(step - 1);
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [persist, step, steps.length, visible]);

  const position = useMemo(() => {
    if (!target) return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
    const width = Math.min(390, window.innerWidth - 28);
    const fitsOnLeft = target.left - width - 18 >= 14;
    const fitsOnRight = target.left + target.width + width + 18 <= window.innerWidth - 14;
    if (fitsOnLeft || fitsOnRight) {
      const left = fitsOnLeft ? target.left - width - 18 : target.left + target.width + 18;
      const top = Math.max(14, Math.min(window.innerHeight - 520, target.top + target.height / 2 - 230));
      return { top, left, width, transform: "none" };
    }
    const below = target.top + target.height + 18;
    const top = below + 330 < window.innerHeight ? below : Math.max(14, target.top - 338);
    const left = Math.max(14, Math.min(window.innerWidth - width - 14, target.left + target.width / 2 - width / 2));
    return { top, left, width, transform: "none" };
  }, [target]);

  if (!mounted || !visible || !current) return null;
  const remaining = steps.length - step - 1;
  const finish = () => {
    persist("completed", steps.length);
    setVisible(false);
  };
  return createPortal(
    <div className="seller-tour-layer" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="seller-tour-title">
      {!target && <div className="seller-tour-dim" />}
      {target && (
        <div
          className="seller-tour-spotlight"
          style={{
            top: Math.max(6, target.top - 7),
            left: Math.max(6, target.left - 7),
            width: target.width + 14,
            height: target.height + 14,
          }}
        />
      )}
      <section className="seller-tour-card" style={position}>
        <div className="seller-tour-confetti" aria-hidden="true"><i>✦</i><i>●</i><i>★</i></div>
        <header>
          <span className="seller-tour-emoji" aria-hidden="true">{current.emoji}</span>
          <div>
            <small>راهنمای ساخت اولین محصول</small>
            <b>{(step + 1).toLocaleString("fa-IR")} از {steps.length.toLocaleString("fa-IR")}</b>
          </div>
          <button type="button" onClick={() => { persist("skipped"); setVisible(false); }} aria-label="بستن راهنما"><X /></button>
        </header>
        <div className="seller-tour-progress" aria-label={`${remaining} مرحله باقی مانده`}>
          <i style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <span className="seller-tour-remaining">
          {remaining ? `${remaining.toLocaleString("fa-IR")} قدم کوچولو مونده` : "رسیدیم به آخرش! 🎉"}
        </span>
        <h2 id="seller-tour-title">{current.title}</h2>
        <p>{current.body}</p>
        {current.hint && <aside>💡 {current.hint}</aside>}
        <footer>
          <button className="seller-tour-never" type="button" onClick={() => { persist("dont_show"); setVisible(false); }}>دیگه نشونم نده</button>
          <div>
            {step > 0 && <button type="button" onClick={() => setStep((value) => value - 1)}><ChevronRight /> قبلی</button>}
            <button className="seller-tour-next" type="button" onClick={() => {
              if (step === steps.length - 1) return finish();
              const next = step + 1;
              setStep(next);
              persist("progress", next);
            }}>
              {step === steps.length - 1 ? "بزن بریم!" : "بعدی"} <ChevronLeft />
            </button>
          </div>
        </footer>
        <button className="seller-tour-skip" type="button" onClick={() => { persist("skipped"); setVisible(false); }}>
          فعلاً ردش کن
        </button>
      </section>
    </div>,
    document.body,
  );
}

export function SellerTourReplayButton({ tour, label = "راهنمای شروع" }: { tour: SellerTourName; label?: string }) {
  return (
    <button
      type="button"
      className="seller-tour-replay"
      onClick={() => window.dispatchEvent(new CustomEvent("chapli:tour:start", { detail: { tour } }))}
    >
      <HelpCircle /> <span>{label}</span>
    </button>
  );
}
