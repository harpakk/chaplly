import Link from "next/link";
import Image from "next/image";
import type { ArticleBlock } from "@/lib/article-data";

export function ArticleContent({ blocks, imageUrls }: { blocks: ArticleBlock[]; imageUrls: Record<string, string> }) {
  const safeHref = (value: string) => /^(?:\/|https?:\/\/)/i.test(value) ? value : "/search";
  return <div className="article-content">{blocks.map((block) => {
    const text = (key: string) => String(block.data[key] || "");
    if (block.type === "heading") return Number(block.data.level) === 3 ? <h3 id={block.id} key={block.id}>{text("text")}</h3> : <h2 id={block.id} key={block.id}>{text("text")}</h2>;
    if (block.type === "paragraph") return <p key={block.id}>{text("text")}</p>;
    if (block.type === "image") return <figure key={block.id}>{imageUrls[block.id] && <Image src={imageUrls[block.id]} alt={text("alt")} width={1400} height={900} unoptimized />} {text("caption") && <figcaption>{text("caption")}</figcaption>}</figure>;
    if (block.type === "imageText") return <section className={`article-image-text ${block.data.imageLeft ? "image-left" : ""}`} key={block.id}>{imageUrls[block.id] && <Image src={imageUrls[block.id]} alt={text("alt")} width={800} height={700} unoptimized />}<div><h2>{text("title")}</h2><p>{text("text")}</p></div></section>;
    if (block.type === "quote") return <blockquote key={block.id}><p>{text("text")}</p>{text("source") && <cite>{text("source")}</cite>}</blockquote>;
    if (block.type === "list") return <section className="article-list-block" key={block.id}>{text("title") && <h2>{text("title")}</h2>}<ul>{(block.data.items as string[] || []).filter(Boolean).map((item, index) => <li key={index}>{item}</li>)}</ul></section>;
    if (block.type === "callout") return <aside className="article-callout" key={block.id}><b>{text("title")}</b><p>{text("text")}</p></aside>;
    if (block.type === "faq") return <details className="article-faq" key={block.id}><summary>{text("question")}</summary><p>{text("answer")}</p></details>;
    if (block.type === "table") return <div className="article-table-wrap" key={block.id}><table><thead><tr>{(block.data.headers as string[] || []).map((item, index) => <th key={index}>{item}</th>)}</tr></thead><tbody>{(block.data.rows as string[][] || []).map((row, rowIndex) => <tr key={rowIndex}>{row.map((item, index) => <td key={index}>{item}</td>)}</tr>)}</tbody></table></div>;
    if (block.type === "divider") return <hr key={block.id} />;
    if (block.type === "cta") return <aside className="article-cta" key={block.id}><div><h2>{text("title")}</h2><p>{text("text")}</p></div><Link href={safeHref(text("href"))}>{text("label") || "بیشتر بدانید"}</Link></aside>;
    return null;
  })}</div>;
}
