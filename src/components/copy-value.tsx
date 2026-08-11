"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="tracking-copy"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      <strong dir="ltr">{value}</strong>
      {copied ? <><Check /> کپی شد</> : <><Copy /> کپی کد</>}
    </button>
  );
}
