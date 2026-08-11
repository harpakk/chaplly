import Link from "next/link";
import {ArrowLeft, Mail, Phone, ShieldCheck} from "lucide-react";

export type PolicySection={
  id:string;
  title:string;
  paragraphs:string[];
  bullets?:string[];
};

export function PolicyPage({
  eyebrow,title,description,updated="آخرین به‌روزرسانی: مرداد ۱۴۰۵",sections,showContact=false,
}:{
  eyebrow:string;
  title:string;
  description:string;
  updated?:string;
  sections:PolicySection[];
  showContact?:boolean;
}){
  return <main className="policy-page">
    <section className="policy-hero"><div className="shop-container"><span><ShieldCheck/>{eyebrow}</span><h1>{title}</h1><p>{description}</p><small>{updated}</small></div></section>
    <div className="shop-container policy-layout">
      <aside><strong>در این صفحه</strong>{sections.map(section=><a href={`#${section.id}`} key={section.id}>{section.title}</a>)}{showContact?<div className="policy-contact-mini"><a href="tel:+989912624379"><Phone/>۰۹۹۱۲۶۲۴۳۷۹</a><a href="mailto:info@chaply.ir"><Mail/>info@chaply.ir</a></div>:null}</aside>
      <article className="policy-content">
        {sections.map((section,index)=><section id={section.id} key={section.id}><header><i>{String(index+1).padStart(2,"0")}</i><h2>{section.title}</h2></header>{section.paragraphs.map((paragraph,paragraphIndex)=><p key={paragraphIndex}>{paragraph}</p>)}{section.bullets?.length?<ul>{section.bullets.map(item=><li key={item}>{item}</li>)}</ul>:null}</section>)}
        <div className="policy-final-cta"><div><b>هنوز سؤال داری؟</b><span>پشتیبانی چاپلی برای سؤال‌های خرید، فروشندگی، سفارش و حساب کاربری کنار توست.</span></div><Link href="/support">ارتباط با پشتیبانی <ArrowLeft/></Link></div>
      </article>
    </div>
  </main>;
}
