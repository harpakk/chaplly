"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions/dashboard";
import { SavingOverlay } from "@/components/saving-overlay";

const initial: ActionResult = { ok: false, message: "" };

export function ActionForm({
  action,
  children,
  className,
  onSuccessText,
  confirmMessage,
  refreshAfterSuccess = true,
  onSuccess,
  savingText,
  onSubmit,
  backgroundConcurrent = false,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  onSuccessText?: string;
  confirmMessage?: string;
  refreshAfterSuccess?: boolean;
  onSuccess?: (state: ActionResult) => void;
  savingText?: string;
  onSubmit?: () => void;
  backgroundConcurrent?: boolean;
}) {
  const router = useRouter();
  const [contextText, setContextText] = useState(
    savingText || "در حال ذخیره اطلاعات…",
  );
  const [state, formAction, pending] = useActionState(action, initial);
  const [backgroundState, setBackgroundState] = useState(initial);
  const [backgroundPending, setBackgroundPending] = useState(0);
  const currentState = backgroundConcurrent ? backgroundState : state;
  const isPending = backgroundConcurrent ? backgroundPending > 0 : pending;
  const handled = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (!currentState.ok || handled.current === currentState) return;
    handled.current = currentState;
    onSuccess?.(currentState);
    if (refreshAfterSuccess) requestAnimationFrame(() => router.refresh());
  }, [currentState, onSuccess, refreshAfterSuccess, router]);
  return (
    <form
      action={backgroundConcurrent ? undefined : formAction}
      className={className}
      aria-busy={isPending}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        const submitter = (event.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null;
        const label = submitter?.textContent?.replace(/\s+/g, " ").trim();
        setContextText(
          savingText ||
            (label ? `در حال انجام «${label}»…` : "در حال ذخیره اطلاعات…"),
        );
        if (backgroundConcurrent) {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          onSubmit?.();
          setBackgroundPending((value) => value + 1);
          void action(initial, formData)
            .then(setBackgroundState)
            .catch((error) =>
              setBackgroundState({
                ok: false,
                message:
                  error instanceof Error ? error.message : "ذخیره ناموفق بود.",
              }),
            )
            .finally(() =>
              setBackgroundPending((value) => Math.max(0, value - 1)),
            );
        } else {
          onSubmit?.();
        }
      }}
    >
      {children}
      <SavingOverlay visible={isPending} text={contextText} />
      {currentState.message && (
        <p className={`action-note ${currentState.ok ? "success" : "error"}`}>
          {currentState.ok
            ? onSuccessText || currentState.message
            : currentState.message}
        </p>
      )}
    </form>
  );
}
