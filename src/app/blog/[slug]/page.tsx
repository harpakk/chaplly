import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, Clock3 } from "lucide-react";
import { ArticleContent } from "@/components/article-content";
import { getPublishedArticle } from "@/lib/article-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = await getPublishedArticle((await params).slug);
  if (!article) return {};
  return { title: article.seo_title, description: article.seo_description, keywords: article.keywords, alternates: { canonical: `/blog/${article.slug}` }, openGraph: { type: "article", title: article.seo_title, description: article.seo_description, publishedTime: article.published_at || undefined, modifiedTime: article.updated_at, images: article.heroUrl ? [{ url: article.heroUrl, alt: article.title }] : [] } };
}
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = await getPublishedArticle((await params).slug); if (!article) notFound();
  const faq = article.content.filter((block) => block.type === "faq");
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://chaplly.ir";
  const schemas = [{ "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.seo_description, image: article.heroUrl ? [article.heroUrl] : [], datePublished: article.published_at, dateModified: article.updated_at, mainEntityOfPage: `${base}/blog/${article.slug}`, publisher: { "@type": "Organization", name: "چاپلی", url: base } }, ...(faq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((block) => ({ "@type": "Question", name: String(block.data.question || ""), acceptedAnswer: { "@type": "Answer", text: String(block.data.answer || "") } })) }] : [])];
  return <main className="article-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas).replace(/</g, "\\u003c") }} /><nav className="article-breadcrumb" aria-label="مسیر صفحه"><Link href="/">خانه</Link><span>/</span><Link href="/blog">مجله</Link><span>/</span><b>{article.title}</b></nav><article><header className="article-hero"><Link href="/blog"><ArrowRight /> بازگشت به مجله</Link><h1>{article.title}</h1><p>{article.excerpt}</p><div><time dateTime={article.published_at || article.created_at}>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(new Date(article.published_at || article.created_at))}</time><span><Clock3 /> {article.reading_minutes.toLocaleString("fa-IR")} دقیقه مطالعه</span></div>{article.heroUrl && <Image src={article.heroUrl} alt={article.title} width={1800} height={1100} priority unoptimized />}</header><ArticleContent blocks={article.content} imageUrls={article.imageUrls} /></article></main>;
}
