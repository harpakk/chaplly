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
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Video,
  Store,
  ShoppingCart,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { SupportAiChat } from "./support-ai-chat";

const items = [
  ["finance", "مالی", BarChart3],
  ["accounts", "حساب‌ها", Landmark],
  ["store", "فروشگاه", Store],
  ["products", "محصولات", Package],
  ["woocommerce", "ووکامرس", ShoppingCart],
  ["tutorials", "آموزش", BookOpen],
] as const;

export function SellerDashboardShell({
  children,
  storeName,
  logoUrl,
}: {
  children: ReactNode;
  storeName: string;
  logoUrl: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const pathname = usePathname();
  const isDesignStudio = pathname === "/seller/dashboard/products/new/design";
  const params = useSearchParams();
  const [section, setSection] = useState(params.get("section") || "finance");

  useEffect(
    () => setCollapsed(localStorage.getItem("chapli-sidebar") === "collapsed"),
    [],
  );
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
          <div className="sd-store-chip">
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
            href="/seller/dashboard/products/new"
            prefetch={false}
            onClick={() => setMobile(false)}
          >
            <Plus />
            <span>ساخت محصول جدید</span>
          </Link>
          <nav>
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
              className={pathname.includes("/support") ? "active" : ""}
              href="/seller/dashboard/support"
              prefetch={false}
              onClick={() => setMobile(false)}
            >
              <Headphones />
              <span>پشتیبانی</span>
            </Link>
          </nav>
          <button className="sd-collapse" onClick={toggle}>
            {collapsed ? <PanelRightOpen /> : <PanelRightClose />}
            <span>جمع‌کردن منو</span>
          </button>
        </aside>
      )}
      <section className="sd-main">{children}</section>
      {!isDesignStudio && (
        <button className="sd-ai-chat-button" onClick={() => setAiOpen(true)}>
          <Bot /> <span>گفت‌وگوی آنلاین</span>
        </button>
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
    </main>
  );
}
