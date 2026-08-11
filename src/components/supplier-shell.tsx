"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Boxes,
  Building2,
  Headphones,
  LogOut,
  Menu,
  Settings,
  ShoppingBag,
  X,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { supplierLogoutAction } from "@/app/actions/supplier-auth";

const links = [
  ["/supplier/dashboard", "سفارش‌ها", ShoppingBag],
  ["/supplier/dashboard/financial", "مالی", Banknote],
  ["/supplier/dashboard/raw-products", "محصولات خام", Boxes],
  ["/supplier/dashboard/support", "پشتیبانی", Headphones],
  ["/supplier/dashboard/settings", "پروفایل مجموعه", Settings],
] as const;

export function SupplierShell({
  children,
  companyName,
  city,
  capacity,
  logoUrl,
  bannerUrl,
}: {
  children: ReactNode;
  companyName: string;
  city: string;
  capacity: number;
  logoUrl: string | null;
  bannerUrl: string | null;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false);
  return (
    <main className="supplier-shell" dir="rtl">
      <button className="supplier-menu" onClick={() => setOpen(true)}>
        <Menu />
      </button>
      {open && (
        <button className="supplier-backdrop" onClick={() => setOpen(false)} />
      )}
      <aside className={open ? "open" : ""}>
        <div className="supplier-brand">
          <span>چ</span>
          <div>
            <b>چاپلی</b>
            <small>پنل تأمین‌کننده</small>
          </div>
          <button onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <div
          className={`supplier-company ${bannerUrl ? "has-banner" : ""}`}
          style={
            bannerUrl
              ? {
                  backgroundImage: `linear-gradient(#16131db8,#16131de8),url("${bannerUrl}")`,
                }
              : undefined
          }
        >
          <i
            className={logoUrl ? "has-image" : ""}
            style={
              logoUrl ? { backgroundImage: `url("${logoUrl}")` } : undefined
            }
          >
            {!logoUrl && <Building2 />}
          </i>
          <div>
            <b>{companyName}</b>
            <span>مجموعه تأییدشده</span>
          </div>
        </div>
        <nav>
          {links.map(([href, label, Icon]) => (
            <Link
              aria-current={path === href ? "page" : undefined}
              className={path === href ? "active" : ""}
              href={href}
              prefetch={false}
              onClick={() => setOpen(false)}
              key={href}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="supplier-capacity">
          <span>ظرفیت ثبت‌شده روزانه</span>
          <strong>{capacity.toLocaleString("fa-IR")}</strong>
          <small>{city ? `مرکز تولید ${city}` : "مرکز تولید"}</small>
        </div>
        <form action={supplierLogoutAction}>
          <button className="supplier-logout">
            <LogOut /> خروج
          </button>
        </form>
      </aside>
      <section className="supplier-main">
        <header>
          <div>
            <span>{city ? `مرکز تولید ${city}` : "مرکز تولید"}</span>
            <b>{companyName}</b>
          </div>
          <div>
            <small>پنل عملیات</small>
            {logoUrl ? (
              <i
                className="supplier-header-logo"
                style={{ backgroundImage: `url("${logoUrl}")` }}
              />
            ) : (
              <i>{companyName.slice(0, 1)}</i>
            )}
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
