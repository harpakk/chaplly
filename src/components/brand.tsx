import { BrandLogo } from "@/components/brand-logo";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <BrandLogo className="brand" variant="white" href="/seller" compact={compact} />;
}
