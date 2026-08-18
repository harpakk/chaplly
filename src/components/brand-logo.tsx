import Image from "next/image";
import Link from "next/link";
import { brandConfig } from "@/lib/brand-config";

export function BrandLogo({
  variant = "orange",
  href = "/",
  subtitle,
  compact = false,
  className = "",
  priority = false,
}: {
  variant?: "orange" | "white";
  href?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link
      className={`chapli-brand chapli-brand--${variant} ${className}`.trim()}
      href={href}
      aria-label={`${brandConfig.name}${subtitle ? `، ${subtitle}` : ""}`}
    >
      <Image
        className="chapli-brand-mark"
        src={brandConfig.logos[variant]}
        alt=""
        width={512}
        height={512}
        sizes="48px"
        priority={priority}
      />
      {!compact && (
        <span className="chapli-brand-copy">
          <b>{brandConfig.name}</b>
          {subtitle && <small>{subtitle}</small>}
        </span>
      )}
    </Link>
  );
}
