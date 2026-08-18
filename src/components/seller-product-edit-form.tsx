"use client";

import Link from "next/link";
import { useState } from "react";
import { Send, Store } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { saveSellerProductAction } from "@/app/actions/dashboard";
import type { getSellerProductEditData } from "@/lib/dashboard-data";
import { formatRial } from "@/lib/catalog";
import { createPropertyMarkups, expandPropertyMarkups, serializePropertyMarkups, VariantPropertyPricing } from "@/components/variant-property-pricing";

type EditData=NonNullable<Awaited<ReturnType<typeof getSellerProductEditData>>>;

export function SellerProductEditForm({data}:{data:EditData}){
  const {product}=data;
  const [primary,setPrimary]=useState(product.primary_supplier_offer_id||"");
  const selectedSupplier=data.suppliers.find((offer)=>offer.id===primary);
  const pricingVariants=data.variantPrices.map((variant)=>{
    const supplierVariant=selectedSupplier?.variants.find((item)=>item.raw_product_variant_id===variant.rawProductVariantId);
    return {...variant,supplierCost:Number(supplierVariant?.unit_cost||0)};
  });
  const [propertyMarkups,setPropertyMarkups]=useState(()=>createPropertyMarkups(pricingVariants,data.propertyMarkups));
  const variantMarkups=expandPropertyMarkups(pricingVariants,propertyMarkups);
  return <main className="seller-product-edit">
    <header><div><span>ویرایش محصول / نسخه {product.version.toLocaleString("fa-IR")}</span><h1>{product.title}</h1><p>هر ویرایش، حتی برای محصول تأییدشده یا ردشده، به‌عنوان نسخه جدید برای بررسی مدیر ارسال می‌شود.</p></div><Link href="/seller/dashboard?section=products">بازگشت به محصولات</Link></header>
    <ActionForm action={saveSellerProductAction} refreshAfterSuccess={false} savingText="در حال ذخیره و ارسال نسخه جدید…">
      <input type="hidden" name="productId" value={product.id}/><input type="hidden" name="designId" value={product.design_id||""}/><input type="hidden" name="rawProductId" value={product.raw_product_id}/>
      <input type="hidden" name="variantMarkups" value={JSON.stringify(variantMarkups)}/><input type="hidden" name="propertyMarkups" value={JSON.stringify(serializePropertyMarkups(pricingVariants,propertyMarkups))}/>
      <section><h2>معرفی محصول</h2><div className="seller-product-edit-grid">
        <label>عنوان<input name="title" required minLength={3} defaultValue={product.title}/></label><label>شناسه انگلیسی<input name="slug" required pattern="[a-z0-9-]+" defaultValue={product.slug}/></label>
        <label className="wide">زیرعنوان<input name="subtitle" defaultValue={product.subtitle||""}/></label><label className="wide">توضیحات<textarea name="description" required rows={7} defaultValue={product.description||""}/></label>
        <label>جنسیت<select name="gender" required defaultValue={product.gender}><option value="MALE">مردانه</option><option value="FEMALE">زنانه</option><option value="UNISEX">یونیسکس</option></select></label>
        <label>نمایش در فروشگاه<select name="visibility" required defaultValue={product.visibility || "VISIBLE"}><option value="VISIBLE">عمومی پس از تأیید مدیر</option><option value="PRIVATE">خصوصی؛ فقط با لینک مستقیم</option></select><small>محصول عمومی تا زمان تأیید فقط با لینک دیده می‌شود. محصول خصوصی بعد از تأیید هم وارد ویترین و جست‌وجو نمی‌شود.</small></label>
        <label className="wide">تصاویر جدید محصول (اختیاری)<input name="productImages" type="file" accept="image/*" multiple/><small>در صورت انتخاب، تصاویر جدید به نسخه محصول افزوده می‌شوند.</small></label>
      </div></section>
      <section><h2>سبک‌های گرافیکی</h2><div className="edit-graphic-styles">{data.graphicStyles.map((style)=><label key={style.id}><input type="checkbox" name="graphicStyleIds" value={style.id} defaultChecked={data.selectedGraphicStyleIds.includes(style.id)}/><span><b>{style.name}</b>{style.caption&&<small>{style.caption}</small>}</span></label>)}</div></section>
      <section><VariantPropertyPricing variants={pricingVariants} value={propertyMarkups} onChange={setPropertyMarkups}/></section>
      <section><h2>مشخصات محصول</h2><div className="detail-builder">{[0,1,2,3,4].map(index=><div key={index}><input name={`detailTitle${index}`} placeholder="عنوان مشخصه" defaultValue={data.details[index]?.title||""}/><input name={`detailValue${index}`} placeholder="مقدار" defaultValue={data.details[index]?.value||""}/></div>)}</div></section>
      <section><h2>تأمین‌کننده</h2><div className="seller-product-edit-grid"><label>اصلی<select name="primarySupplierOfferId" required value={primary} onChange={(event)=>setPrimary(event.target.value)}><option value="">تأمین‌کننده را انتخاب کنید</option>{data.suppliers.map(offer=><option value={offer.id} key={offer.id}>{offer.organization?.display_name||"شرکت تأمین"} · {formatRial(offer.base_cost)}</option>)}</select></label><label>پشتیبان<select name="backupSupplierOfferId" defaultValue={product.backup_supplier_offer_id||""}><option value="">بدون پشتیبان</option>{data.suppliers.filter(offer=>offer.id!==primary).map(offer=><option value={offer.id} key={offer.id}>{offer.organization?.display_name||"شرکت تأمین"}</option>)}</select></label></div></section>
      <section><h2>SEO</h2><div className="seller-product-edit-grid"><label>عنوان SEO<input name="seoTitle" defaultValue={product.seo_title||""}/></label><label className="wide">توضیح SEO<textarea name="seoDescription" rows={3} defaultValue={product.seo_description||""}/></label></div></section>
      <footer><button className="primary" name="intent" value="publish"><Send/> ذخیره و ارسال برای بررسی</button>{product.status==="PUBLISHED"&&<Link href={`/products/${product.slug}`}><Store/> مشاهده نسخه فعلی</Link>}</footer>
    </ActionForm>
  </main>;
}
