"use client";

import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Search, ShoppingBag, Sparkles } from "lucide-react";

type Store={
  name:string;slug:string;description:string|null;social_url:string|null;brand_color:string;
  follower_count:number;is_verified:boolean;logoUrl:string;bannerUrl:string;
};

export function ExclusiveStoreHero({store}:{store:Store}){
 return <><header className="exclusive-nav"><Link href={`/stores/${store.slug}`}><Image src={store.logoUrl} alt="" width={72} height={72}/><b>{store.name}</b>{store.is_verified&&<BadgeCheck/>}</Link><nav><a href="#store-products">محصول‌ها</a><a href="#about-store">درباره ما</a></nav><div><Link href={`?q=`} aria-label="جست‌وجو"><Search/></Link><Link href="/cart" aria-label="سبد خرید"><ShoppingBag/></Link></div></header>
 <section className="exclusive-hero" style={{backgroundImage:`linear-gradient(90deg,rgba(12,10,17,.88),rgba(12,10,17,.15)),url("${store.bannerUrl}")`}}>
  <div><span><Sparkles/> فروشگاه اختصاصی</span><Image src={store.logoUrl} alt={`لوگوی ${store.name}`} width={160} height={160}/><h1>{store.name}</h1><p>{store.description||"محصول‌هایی با امضای خودمان؛ ساخته‌شده برای سلیقه‌هایی که تکراری نیستند."}</p><a href="#store-products">دیدن کالکشن</a></div>
 </section><section className="exclusive-marquee" id="about-store"><span>اورجینال باش ✦ انتخاب خودت باش ✦ ترند را خودت بساز ✦ {store.name} ✦</span></section><i id="store-products"/></>;
}
