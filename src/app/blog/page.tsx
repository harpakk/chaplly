import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, BookOpen, Clock3 } from "lucide-react";
import { getPublishedArticles } from "@/lib/article-data";

export const metadata: Metadata = { title: "مجله چاپلی | راهنمای استایل، طراحی و خرید", description: "مقاله‌ها و راهنماهای کاربردی چاپلی درباره استایل، طراحی، چاپ و انتخاب محصولات خاص ایرانی.", alternates: { canonical: "/blog" } };
export default async function BlogPage() {
  const articles = await getPublishedArticles();
  return <main className="blog-page"><header className="blog-hero"><span><BookOpen /> مجله چاپلی</span><h1>ایده‌ها، راهنماها و قصه‌های طراحی</h1><p>محتوای کاربردی برای انتخاب بهتر، ساخت استایل شخصی و شناخت دنیای چاپ و طراحی مستقل.</p></header><section className="blog-grid">{articles.map((article, index) => <article className={index === 0 ? "featured" : ""} key={article.id}><Link className="blog-card-image" href={`/blog/${article.slug}`}>{article.heroUrl && <Image src={article.heroUrl} alt={article.title} width={1000} height={700} unoptimized />}</Link><div><span><Clock3 /> {article.reading_minutes.toLocaleString("fa-IR")} دقیقه مطالعه</span><h2><Link href={`/blog/${article.slug}`}>{article.title}</Link></h2><p>{article.excerpt}</p><Link className="blog-read" href={`/blog/${article.slug}`}>مطالعه مقاله <ArrowLeft /></Link></div></article>)}{!articles.length && <div className="blog-empty"><BookOpen /><h2>مقاله‌ها به‌زودی منتشر می‌شوند</h2></div>}</section></main>;
}
