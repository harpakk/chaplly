"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bot,
  BookOpen,
  Headphones,
  Landmark,
  Menu,
  Package,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Video,
  Store,
  ShoppingCart,
  BellRing,
  BadgePercent,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { SupportAiChat } from "./support-ai-chat";
import { SellerOnboardingTour, SellerTourReplayButton, type SellerTourStep } from "./seller-onboarding-tour";
import { shouldAutoShowSellerTour, type SellerTourState } from "@/lib/seller-tour-shared";

const items = [
  ["finance", "مالی", BarChart3],
  ["accounts", "حساب‌ها", Landmark],
  ["store", "فروشگاه", Store],
  ["products", "محصولات", Package],
  ["designs", "طرح‌های من", Palette],
  ["woocommerce", "ووکامرس", ShoppingCart],
  ["tutorials", "آموزش", BookOpen],
] as const;

const sidebarTourSteps: SellerTourStep[] = [
  { target: '[data-tour="seller-home"]', emoji: "👋", title: "سلام، آماده‌ای اولین محصولت را بسازی؟", body: "این پنل فرمان فروشگاه توست؛ فعلاً فقط یک مقصد مهم داریم و بقیه گزینه‌ها می‌تونن منتظر بمونن." },
  { target: '[data-tour="create-product"]', emoji: "🚀", title: "از همین‌جا شروع کن", body: "روی «ساخت محصول جدید» بزن تا محصول خام، طرح و موکاپ را قدم‌به‌قدم آماده کنیم.", hint: "هیچ‌چیز تا تأیید نهایی تو منتشر نمی‌شه." },
  { target: '[data-tour="seller-nav"]', emoji: "🧭", title: "این منو برای بعد است", body: "محصولات، فروشگاه، امور مالی و ابزارهای فروش همیشه اینجا هستند؛ برای شروع لازم نیست همه را یاد بگیری." },
  { target: '[data-tour="seller-help"]', emoji: "💬", title: "اگر گیر کردی، تنها نیستی", body: "آموزش و پشتیبانی همیشه در دسترس‌اند. حالا وقتشه اولین محصولت رو بسازی!" },
];

export function SellerDashboardShell({
  children,
  storeName,
  logoUrl,
  tourState,
}: {
  children: ReactNode;
  storeName: string;
  logoUrl: string | null;
  tourState: SellerTourState;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLauncherDismissed, setAiLauncherDismissed] = useState(false);
  const pathname = usePathname();
  const isDesignStudio = pathname === "/seller/dashboard/products/new/design";
  const params = useSearchParams();
  const [section, setSection] = useState(params.get("section") || "finance");

  useEffect(
    () => setCollapsed(localStorage.getItem("chapli-sidebar") === "collapsed"),
    [],
  );
  useEffect(() => {
    if (pathname !== "/seller/dashboard" || !shouldAutoShowSellerTour(tourState, "sidebar")) return;
    setCollapsed(false);
    localStorage.setItem("chapli-sidebar", "open");
    if (window.innerWidth <= 900) setMobile(true);
  }, [pathname, tourState]);
  useEffect(() => {
    const next = params.get("section") || "finance";
    setSection(next);
    if (pathname === "/seller/dashboard")
      window.dispatchEvent(
        new CustomEvent("chapli:seller-section", { detail: next }),
      );
  }, [params, pathname]);

  const toggle = () =>
    setCollapsed((value) => {
      localStorage.setItem("chapli-sidebar", !value ? "collapsed" : "open");
      return !value;
    });
  return (
    <main
      className={`sd-shell ${collapsed ? "is-collapsed" : ""} ${isDesignStudio ? "is-design-studio" : ""}`}
    >
      <button
        className="sd-mobile-menu"
        onClick={() => setMobile(true)}
        aria-label="باز کردن منو"
      >
        <Menu />
      </button>
      {mobile && (
        <button
          className="sd-backdrop"
          onClick={() => setMobile(false)}
          aria-label="بستن منو"
        />
      )}
      {!isDesignStudio && (
        <aside className={`sd-sidebar ${mobile ? "is-open" : ""}`}>
          <div className="sd-side-brand">
            <Brand />
            <button
              className="sd-mobile-close"
              onClick={() => setMobile(false)}
            >
              <X />
            </button>
          </div>
          <div className="sd-store-chip" data-tour="seller-home">
            <span
              className={logoUrl ? "has-logo" : ""}
              style={
                logoUrl ? { backgroundImage: `url("${logoUrl}")` } : undefined
              }
            >
              {logoUrl ? "" : storeName.slice(0, 1)}
            </span>
            <div>
              <b>{storeName}</b>
              <small>پنل فروشنده چاپلی</small>
            </div>
          </div>
          <Link
            className="sd-sidebar-create"
            data-tour="create-product"
            href="/seller/dashboard/products/new"
            prefetch={false}
            onClick={() => setMobile(false)}
          >
            <Plus />
            <span>ساخت محصول جدید</span>
          </Link>
          <nav data-tour="seller-nav">
            {items.map(([key, label, Icon]) => (
              <Link
                href={`/seller/dashboard?section=${key}`}
                prefetch={false}
                key={key}
                aria-current={
                  pathname === "/seller/dashboard" && section === key
                    ? "page"
                    : undefined
                }
                className={
                  pathname === "/seller/dashboard" && section === key
                    ? "active"
                    : ""
                }
                onClick={() => setMobile(false)}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            ))}
            <Link className={pathname.includes("/coupons") ? "active" : ""} href="/seller/dashboard/coupons" prefetch={false} onClick={() => setMobile(false)}>
              <BadgePercent />
              <span>کدهای تخفیف</span>
            </Link>
            <Link
              className={pathname.includes("/notifications") ? "active" : ""}
              href="/seller/dashboard/notifications"
              prefetch={false}
              onClick={() => setMobile(false)}
            >
              <BellRing />
              <span>تنظیمات پیامک</span>
            </Link>
            <Link
              className={pathname.includes("/reels") ? "active" : ""}
              href="/seller/dashboard/reels"
              prefetch={false}
              onClick={() => setMobile(false)}
            >
              <Video />
              <span>آپلود ریلز</span>
            </Link>
            <Link
              data-tour="seller-help"
              className={pathname.includes("/support") ? "active" : ""}
              href="/seller/dashboard/support"
              prefetch={false}
              onClick={() => setMobile(false)}
            >
              <Headphones />
              <span>پشتیبانی</span>
            </Link>
          </nav>
          <SellerTourReplayButton tour="sidebar" />
          <button className="sd-collapse" onClick={toggle}>
            {collapsed ? <PanelRightOpen /> : <PanelRightClose />}
            <span>جمع‌کردن منو</span>
          </button>
        </aside>
      )}
      <section className="sd-main">{children}</section>
      {!isDesignStudio && !aiLauncherDismissed && (
        <div className="sd-ai-chat-launcher">
          <button className="sd-ai-chat-button" onClick={() => setAiOpen(true)}>
            <Bot /> <span>گفت‌وگو</span>
          </button>
          <button
            className="sd-ai-chat-dismiss"
            type="button"
            aria-label="بستن دکمه گفت‌وگو تا بارگذاری بعدی"
            onClick={() => setAiLauncherDismissed(true)}
          ><X /></button>
        </div>
      )}
      <SupportAiChat
        role="seller"
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onEscalate={() => {
          setAiOpen(false);
          window.location.assign("/seller/dashboard/support?new=1");
        }}
      />
      {pathname === "/seller/dashboard" && (
        <SellerOnboardingTour tour="sidebar" state={tourState} steps={sidebarTourSteps} />
      )}
    </main>
  );
}
