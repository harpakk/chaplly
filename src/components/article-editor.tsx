"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Columns2, GripVertical, Heading2, HelpCircle, Image as ImageIcon, List, Megaphone, Minus, MousePointerClick, Quote, Sparkles, Table2, Text, Trash2 } from "lucide-react";
import { saveArticleAction, type ArticleActionState } from "@/app/admin/seo-actions";
import type { ArticleBlock } from "@/lib/article-data";

const initial: ArticleActionState = { ok: false, message: "" };
const blockOptions = [
  ["heading", "عنوان میانی", Heading2, "ساختار H2/H3 برای موتور جست‌وجو"],
  ["paragraph", "پاراگراف", Text, "متن اصلی خوانا و قابل جست‌وجو"],
  ["image", "تصویر", ImageIcon, "تصویر با alt و کپشن"],
  ["imageText", "تصویر + متن", Columns2, "چیدمان دو ستونه توضیحی"],
  ["quote", "نقل‌قول", Quote, "جمله برجسته با منبع"],
  ["list", "فهرست", List, "لیست نکات یا مراحل"],
  ["callout", "نکته مهم", Sparkles, "باکس خلاصه یا هشدار"],
  ["faq", "پرسش متداول", HelpCircle, "FAQ مناسب rich result"],
  ["table", "جدول", Table2, "مقایسه داده‌های ساختاریافته"],
  ["divider", "جداکننده", Minus, "تفکیک معنایی بخش‌ها"],
  ["cta", "دعوت به اقدام", Megaphone, "لینک داخلی و اقدام بعدی"],
] as const;
type BlockType = (typeof blockOptions)[number][0];
const uid = () => crypto.randomUUID();
const defaults = (type: BlockType): ArticleBlock => ({ id: uid(), type, data: type === "heading" ? { text: "عنوان بخش", level: 2 } : type === "paragraph" ? { text: "متن پاراگراف را اینجا بنویسید." } : type === "image" ? { alt: "", caption: "" } : type === "imageText" ? { title: "عنوان", text: "توضیحات", alt: "", imageLeft: true } : type === "quote" ? { text: "نقل‌قول", source: "" } : type === "list" ? { title: "", items: ["نکته اول", "نکته دوم"] } : type === "callout" ? { title: "نکته مهم", text: "" } : type === "faq" ? { question: "", answer: "" } : type === "table" ? { headers: ["ستون اول", "ستون دوم"], rows: [["مقدار اول", "مقدار دوم"]] } : type === "cta" ? { title: "", text: "", label: "بیشتر بدانید", href: "/search" } : {} });

function Field({ value, onChange, placeholder, area = false }: { value: string; onChange: (value: string) => void; placeholder?: string; area?: boolean }) {
  return area ? <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

export function ArticleEditor() {
  const [state, action, pending] = useActionState(saveArticleAction, initial);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([]);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [bulk, setBulk] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const imageBlocks = useMemo(() => blocks.filter((block) => block.type === "image" || block.type === "imageText"), [blocks]);
  const add = (type: BlockType, index = blocks.length) => setBlocks((current) => [...current.slice(0, index), defaults(type), ...current.slice(index)]);
  const patch = (id: string, key: string, value: ArticleBlock["data"][string]) => setBlocks((current) => current.map((block) => block.id === id ? { ...block, data: { ...block.data, [key]: value } } : block));
  const move = (from: string, to: string) => setBlocks((current) => { const next = [...current]; const fromIndex = next.findIndex((item) => item.id === from); const toIndex = next.findIndex((item) => item.id === to); if (fromIndex < 0 || toIndex < 0) return current; const [item] = next.splice(fromIndex, 1); next.splice(toIndex, 0, item); return next; });
  const parseBulk = () => {
    const lines = bulk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return;
    const first = lines[0].replace(/^#+\s*/, "");
    if (!title) { setTitle(first); setSeoTitle(first); }
    const generated = lines.slice(1).map((line) => /^#{2,3}\s+/.test(line) || (line.length < 70 && !/[.!؟]$/.test(line)) ? ({ id: uid(), type: "heading", data: { text: line.replace(/^#+\s*/, ""), level: 2 } } as ArticleBlock) : ({ id: uid(), type: "paragraph", data: { text: line } } as ArticleBlock));
    setBlocks(generated.length ? generated : [{ id: uid(), type: "paragraph", data: { text: first } }]);
    if (!excerpt) { const summary = lines.slice(1).join(" ").slice(0, 220); setExcerpt(summary); setSeoDescription(summary.slice(0, 170)); }
  };
  return <form action={action} className="article-editor">
    <input type="hidden" name="content" value={JSON.stringify(blocks)} />
    <header className="article-editor-top"><div><span>SEO Studio</span><h1>ساخت مقاله جدید</h1><p>محتوا را با بلوک‌های معنایی بسازید؛ خروجی نهایی خودکار به HTML مناسب موتور جست‌وجو تبدیل می‌شود.</p></div><div><button name="intent" value="draft" disabled={pending}>ذخیره پیش‌نویس</button><button className="publish" name="intent" value="publish" disabled={pending}>{pending ? "در حال ذخیره…" : "انتشار مقاله"}</button></div></header>
    {state.message && <p className="article-editor-error" role="alert">{state.message}</p>}
    <section className="article-bulk-import"><div><Sparkles /><span><b>متن کامل مقاله را یکجا وارد کنید</b><small>عنوان‌ها و پاراگراف‌ها به‌صورت خودکار تشخیص داده می‌شوند.</small></span></div><textarea value={bulk} onChange={(event) => setBulk(event.target.value)} placeholder="عنوان مقاله در خط اول، سپس متن کامل…" /><button type="button" onClick={parseBulk}>تبدیل هوشمند به بلوک‌ها</button></section>
    <div className="article-editor-layout">
      <aside className="article-block-palette"><h2>المان‌ها</h2><p>کلیک کنید یا روی بوم بکشید.</p>{blockOptions.map(([type, label, Icon, hint]) => <button type="button" draggable onDragStart={(event) => event.dataTransfer.setData("article/block-type", type)} onClick={() => add(type)} key={type}><Icon /><span><b>{label}</b><small>{hint}</small></span></button>)}</aside>
      <main className="article-canvas" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const type = event.dataTransfer.getData("article/block-type") as BlockType; if (type) add(type); }}>
        {!blocks.length && <div className="article-canvas-empty"><MousePointerClick /><h2>اولین بخش را اضافه کنید</h2><p>یک المان را اینجا رها کنید یا از ستون کناری روی آن بزنید.</p></div>}
        {blocks.map((block, index) => <article className="article-block-editor" draggable onDragStart={() => setDragging(block.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragging && dragging !== block.id) move(dragging, block.id); setDragging(null); }} key={block.id}>
          <header><GripVertical /><b>{blockOptions.find(([type]) => type === block.type)?.[1]}</b><span>{index + 1}</span><button type="button" disabled={index === 0} onClick={() => move(block.id, blocks[index - 1]?.id)}><ArrowUp /></button><button type="button" disabled={index === blocks.length - 1} onClick={() => move(block.id, blocks[index + 1]?.id)}><ArrowDown /></button><button type="button" onClick={() => setBlocks((current) => current.filter((item) => item.id !== block.id))}><Trash2 /></button></header>
          <div>{block.type === "heading" && <><select value={Number(block.data.level || 2)} onChange={(event) => patch(block.id, "level", Number(event.target.value))}><option value="2">H2</option><option value="3">H3</option></select><Field value={String(block.data.text || "")} onChange={(value) => patch(block.id, "text", value)} /></>}
          {block.type === "paragraph" && <Field area value={String(block.data.text || "")} onChange={(value) => patch(block.id, "text", value)} />}
          {(block.type === "image" || block.type === "imageText") && <><label className="article-image-drop"><ImageIcon />انتخاب یا رهاکردن تصویر<input type="file" name={`blockImage:${block.id}`} accept="image/*" /></label><Field value={String(block.data.alt || "")} onChange={(value) => patch(block.id, "alt", value)} placeholder="متن جایگزین دقیق تصویر (alt)" /></>}
          {block.type === "image" && <Field value={String(block.data.caption || "")} onChange={(value) => patch(block.id, "caption", value)} placeholder="کپشن تصویر" />}
          {block.type === "imageText" && <><Field value={String(block.data.title || "")} onChange={(value) => patch(block.id, "title", value)} /><Field area value={String(block.data.text || "")} onChange={(value) => patch(block.id, "text", value)} /><label><input type="checkbox" checked={Boolean(block.data.imageLeft)} onChange={(event) => patch(block.id, "imageLeft", event.target.checked)} /> تصویر سمت چپ باشد</label></>}
          {block.type === "quote" && <><Field area value={String(block.data.text || "")} onChange={(value) => patch(block.id, "text", value)} /><Field value={String(block.data.source || "")} onChange={(value) => patch(block.id, "source", value)} placeholder="منبع نقل‌قول" /></>}
          {block.type === "list" && <><Field value={String(block.data.title || "")} onChange={(value) => patch(block.id, "title", value)} placeholder="عنوان فهرست" /><Field area value={(block.data.items as string[] || []).join("\n")} onChange={(value) => patch(block.id, "items", value.split("\n"))} placeholder="هر مورد در یک خط" /></>}
          {block.type === "callout" && <><Field value={String(block.data.title || "")} onChange={(value) => patch(block.id, "title", value)} /><Field area value={String(block.data.text || "")} onChange={(value) => patch(block.id, "text", value)} /></>}
          {block.type === "faq" && <><Field value={String(block.data.question || "")} onChange={(value) => patch(block.id, "question", value)} placeholder="سؤال" /><Field area value={String(block.data.answer || "")} onChange={(value) => patch(block.id, "answer", value)} placeholder="پاسخ کامل" /></>}
          {block.type === "table" && <><Field value={(block.data.headers as string[] || []).join(" | ")} onChange={(value) => patch(block.id, "headers", value.split("|").map((item) => item.trim()))} placeholder="عنوان ستون‌ها با |" /><Field area value={(block.data.rows as string[][] || []).map((row) => row.join(" | ")).join("\n")} onChange={(value) => patch(block.id, "rows", value.split("\n").map((row) => row.split("|").map((item) => item.trim())))} placeholder="هر ردیف یک خط؛ ستون‌ها با |" /></>}
          {block.type === "divider" && <p className="article-divider-preview">جداکنندهٔ بخش</p>}
          {block.type === "cta" && <><Field value={String(block.data.title || "")} onChange={(value) => patch(block.id, "title", value)} placeholder="عنوان دعوت" /><Field area value={String(block.data.text || "")} onChange={(value) => patch(block.id, "text", value)} /><Field value={String(block.data.label || "")} onChange={(value) => patch(block.id, "label", value)} placeholder="متن دکمه" /><Field value={String(block.data.href || "")} onChange={(value) => patch(block.id, "href", value)} placeholder="/search" /></>}
          </div>
        </article>)}
      </main>
      <aside className="article-seo-panel"><h2>انتشار و SEO</h2><label>عنوان مقاله<input name="title" required value={title} onChange={(event) => { setTitle(event.target.value); if (!seoTitle || seoTitle === title) setSeoTitle(event.target.value); }} /></label><label>آدرس مقاله<input name="slug" dir="ltr" placeholder="راهنمای-انتخاب-تیشرت" /></label><label>خلاصه<textarea name="excerpt" required value={excerpt} onChange={(event) => { setExcerpt(event.target.value); if (!seoDescription || seoDescription === excerpt) setSeoDescription(event.target.value.slice(0, 170)); }} /></label><label>عنوان SEO<input name="seoTitle" maxLength={70} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} /></label><label>توضیحات SEO<textarea name="seoDescription" minLength={50} maxLength={170} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} /></label><label>کلمات کلیدی<input name="keywords" placeholder="تیشرت، چاپ، استایل" /></label><label className="article-hero-upload">تصویر اصلی<input name="heroImage" type="file" accept="image/*" /></label>{imageBlocks.length > 0 && <label>یا تصویر اصلی از مقاله<select name="heroBlockId" defaultValue=""><option value="">انتخاب کنید</option>{imageBlocks.map((block, index) => <option value={block.id} key={block.id}>تصویر بخش {index + 1}</option>)}</select></label>}<div className="seo-checklist"><b>چک‌لیست زنده</b><span data-ok={title.length >= 20}>عنوان توصیفی</span><span data-ok={excerpt.length >= 80}>خلاصه مناسب</span><span data-ok={blocks.some((block) => block.type === "heading")}>حداقل یک H2</span><span data-ok={blocks.some((block) => block.type === "image" || block.type === "imageText")}>تصویر در محتوا</span><span data-ok={blocks.some((block) => block.type === "faq")}>FAQ ساختاریافته</span></div></aside>
    </div>
  </form>;
}
