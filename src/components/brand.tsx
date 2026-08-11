import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/seller" aria-label="چاپلی، صفحه اصلی فروشندگان">
      <span className="brand-mark" aria-hidden="true">
        چ
      </span>
      {!compact && <span>چاپلی</span>}
    </Link>
  );
}
