"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import {
  BarChart3,
  Bot,
  BookOpen,
  Boxes,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  Headphones,
  Images,
  Tags,
  LogOut,
  Menu,
  MessageSquareText,
  PackageSearch,
  Settings,
  ShoppingCart,
  X,
  BadgePercent,
} from "lucide-react";
import { adminLogoutAction } from "@/app/admin/actions";
const links = [
  ["/admin/analytics", "آنالیتیکس", BarChart3],
  ["/admin", "داشبورد", BarChart3],
  ["/admin/financial", "مالی", CircleDollarSign],
  ["/admin/raw-products", "محصولات خام", Boxes],
  ["/admin/mockups", "موکاپ‌ها", Images],
  ["/admin/catalog", "دسته‌بندی و سبک‌ها", Tags],
  ["/admin/tutorials", "آموزش‌ها", BookOpen],
  ["/admin/pending-products", "محصولات در انتظار", ClipboardCheck],
  ["/admin/reviews", "بررسی دیدگاه‌ها", MessageSquareText],
  ["/admin/orders", "سفارش‌ها", ShoppingCart],
  ["/admin/coupons", "کدهای تخفیف", BadgePercent],
  ["/admin/tickets", "پشتیبانی", Headphones],
  ["/admin/ai-assistant", "دستیار هوشمند", Bot],
  ["/admin/settings", "تنظیمات", Settings],
] as const;
export function AdminShell({
  children,
  pendingProductCount,
}: {
  children: ReactNode;
  pendingProductCount: number;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false);
  return (
    <main className="admin-shell" dir="rtl">
      <button className="admin-menu" onClick={() => setOpen(true)}>
        <Menu />
      </button>
      {open && (
        <button className="admin-backdrop" onClick={() => setOpen(false)} />
      )}
      <aside className={open ? "open" : ""}>
        <div className="admin-brand">
          <span>چ</span>
          <div>
            <b>چاپلی</b>
            <small>مرکز مدیریت</small>
          </div>
          <button onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <nav>
          {links.map(([href, label, Icon]) => (
            <Link
              className={path === href ? "active" : ""}
              href={href}
              prefetch={false}
              onClick={() => setOpen(false)}
              key={href}
            >
              <Icon />
              <span>{label}</span>
              {label === "محصولات در انتظار" && pendingProductCount > 0 && (
                <b>{pendingProductCount.toLocaleString("fa-IR")}</b>
              )}
              <ChevronLeft />
            </Link>
          ))}
        </nav>
        <div className="admin-system">
          <i />
          <div>
            <b>همه‌چیز روبه‌راهه</b>
            <small>آخرین همگام‌سازی: همین الان</small>
          </div>
        </div>
        <form action={adminLogoutAction}>
          <button>
            <LogOut /> خروج امن
          </button>
        </form>
      </aside>
      <section className="admin-main">
        <header>
          <div>
            <PackageSearch />
            <span>جست‌وجوی سفارش، فروشنده یا محصول...</span>
          </div>
          <div>
            <small>مدیر سیستم</small>
            <b>ا</b>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
