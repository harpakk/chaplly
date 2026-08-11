"use client";
import Image from "next/image";
import { Bookmark, Play } from "lucide-react";
import type { Reel } from "@/lib/catalog";
export function SavedReels({items}:{items:Reel[]}){return <section className="saved-reels"><h2>ویدیوهای سیوشده</h2>{items.length?<div>{items.map((item)=><article key={item.id}><Image src={item.media} alt={item.caption} fill sizes="180px"/><Play fill="currentColor"/><p>{item.caption}</p></article>)}</div>:<p><Bookmark/> هنوز ویدیویی سیو نکردی؛ از صفحه اصلی یک ریل باز کن.</p>}</section>}
