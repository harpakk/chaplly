import type { Metadata } from "next";
import { Suspense } from "react";
import { BuyerHeader } from "@/components/buyer-header";
import { BuyerFooter } from "@/components/buyer-footer";
import { CartProvider } from "@/components/cart-context";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { AttributionTracker } from "@/components/attribution-tracker";
import { brandConfig } from "@/lib/brand-config";
import "./globals.css";

// Liara injects application secrets at runtime rather than while building the
// image. Every route depends on Supabase-backed navigation or user data, so it
// must be rendered when a request arrives instead of during `next build`.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  icons: {
    icon: brandConfig.logos.orange,
    apple: brandConfig.logos.orange,
  },
  title: {
    default: "چاپلی | محصولات خاص از طراحان مستقل",
    template: "%s | چاپلی",
  },
  description:
    "خرید محصولات خاص و چاپی از طراحان مستقل ایرانی با تضمین کیفیت و ارسال قابل پیگیری.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <AttributionTracker />
        <Suspense fallback={null}>
          <NavigationFeedback />
        </Suspense>
        <CartProvider>
          <BuyerHeader />
          {children}
          <BuyerFooter />
        </CartProvider>
      </body>
    </html>
  );
}
