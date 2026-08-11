import Link from "next/link";
import { History, LayoutDashboard, MapPin, MessageCircle, Package, Star, WalletCards } from "lucide-react";

const links = [
  ["/account", "نمای کلی", LayoutDashboard],
  ["/account/orders", "سفارش‌ها", Package],
  ["/account/wallet", "کیف پول و بازپرداخت", WalletCards],
  ["/account/recent", "دیده‌شده‌های اخیر", History],
  ["/account/addresses", "نشانی‌ها", MapPin],
  ["/account/reviews", "دیدگاه‌ها", Star],
  ["/account/support", "پشتیبانی", MessageCircle],
] as const;

export function AccountShell({ active, children, name = "دوست چاپلی" }: { active: string; children: React.ReactNode; name?: string }) {
  return <main className="account-page"><div className="shop-container account-layout"><aside className="account-sidebar"><div className="account-person"><span>{name.slice(0,1)}</span><div><b>سلام، {name}</b><small>خوش برگشتی :)</small></div></div><nav>{links.map(([href,label,Icon]) => <Link className={active === href ? "active" : ""} href={href} key={href}><Icon />{label}</Link>)}</nav></aside><section className="account-content">{children}</section></div></main>;
}
