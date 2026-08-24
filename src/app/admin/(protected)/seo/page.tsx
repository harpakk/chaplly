import Link from "next/link";
import Image from "next/image";
import { FileText, Plus, SearchCheck } from "lucide-react";
import { getAdminArticles } from "@/lib/article-data";

export default async function AdminSeoPage() {
  const articles = await getAdminArticles();
  return <div className="admin-page admin-seo-page"><header className="admin-seo-hero"><div><SearchCheck /><span><b>مرکز بهینه‌سازی SEO</b><small>محتوای ماندگار برای ورودی ارگانیک</small></span></div><Link href="/admin/seo/new"><Plus /> ساخت مقاله جدید</Link></header><section className="admin-card"><header><div><h1>مقاله‌ها</h1><p>پیش‌نویس‌ها و مقاله‌های منتشرشده را از اینجا مدیریت کنید.</p></div><span>{articles.length.toLocaleString("fa-IR")} مقاله</span></header><div className="admin-article-list">{articles.map((article) => <article key={article.id}>{article.heroUrl ? <Image src={article.heroUrl} alt="" width={280} height={192} unoptimized /> : <span><FileText /></span>}<div><small data-status={article.status}>{article.status === "PUBLISHED" ? "منتشرشده" : "پیش‌نویس"}</small><h2>{article.title}</h2><p>{article.excerpt}</p><time>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(article.updated_at))}</time></div>{article.status === "PUBLISHED" && <Link href={`/blog/${article.slug}`}>مشاهده مقاله</Link>}</article>)}{!articles.length && <div className="admin-articles-empty"><FileText /><h2>هنوز مقاله‌ای ساخته نشده</h2><p>اولین مقالهٔ بهینه‌شده را با ویرایشگر بلوکی بسازید.</p><Link href="/admin/seo/new">ساخت اولین مقاله</Link></div>}</div></section></div>;
}
