"use client";

import Image from "next/image";
import { useState } from "react";
import { BadgeCheck, Minus, Plus, Star } from "lucide-react";
import type { Product } from "@/lib/catalog";

type Review={id:string;rating:number;title:string|null;body:string|null;pros:string[];cons:string[];displayName:string;is_verified_purchase:boolean;created_at:string;images:string[]};

export function ProductTabs({product,reviews}:{product:Product;reviews:Review[]}){
  const [tab,setTab]=useState<"specs"|"story"|"reviews">("specs");
  return <section className="product-tabs-section" id="reviews"><div className="product-detail-tabs"><button className={tab==="specs"?"active":""} onClick={()=>setTab("specs")}>جزئیات محصول</button><button className={tab==="story"?"active":""} onClick={()=>setTab("story")}>داستان و توضیحات</button><button className={tab==="reviews"?"active":""} onClick={()=>setTab("reviews")}>دیدگاه‌ها ({reviews.length.toLocaleString("fa-IR")})</button></div>
    {tab==="specs"&&<dl className="spec-pairs">{product.details.length?product.details.map(item=><div key={item.title}><dt>{item.title}</dt><dd>{item.value}</dd></div>):<div><dt>مشخصات</dt><dd>اطلاعات تکمیلی توسط فروشنده ثبت نشده است.</dd></div>}<div><dt>سبک گرافیک</dt><dd>{product.graphicStyles.map(item=>item.name).join("، ")||"—"}</dd></div><div><dt>فروشنده</dt><dd>{product.seller}</dd></div></dl>}
    {tab==="story"&&<div className="long-description"><h2>{product.subtitle||product.title}</h2><p>{product.description}</p></div>}
    {tab==="reviews"&&<div className="reviews-real"><aside><strong>{product.rating.toLocaleString("fa-IR")}</strong><span><Star fill="currentColor"/> از ۵</span><small>{reviews.length.toLocaleString("fa-IR")} دیدگاه تأییدشده</small></aside><div className="review-public-list">{reviews.map(review=><article key={review.id}><header><div><b>{review.displayName}</b>{review.is_verified_purchase&&<span><BadgeCheck/> خرید تأییدشده</span>}</div><em>{"★".repeat(review.rating)}</em></header>{review.title&&<h3>{review.title}</h3>}{review.body&&<p>{review.body}</p>}{(review.pros.length>0||review.cons.length>0)&&<div className="review-points"><ul>{review.pros.map(item=><li key={item}><Plus/> {item}</li>)}</ul><ul>{review.cons.map(item=><li key={item}><Minus/> {item}</li>)}</ul></div>}{review.images.length>0&&<div className="review-public-images">{review.images.map(url=><Image src={url} alt="تصویر خریدار" width={130} height={130} key={url}/>)}</div>}<time>{new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium"}).format(new Date(review.created_at))}</time></article>)}{!reviews.length&&<div className="empty-state">هنوز دیدگاه تأییدشده‌ای برای این محصول وجود ندارد.</div>}</div></div>}
  </section>;
}
