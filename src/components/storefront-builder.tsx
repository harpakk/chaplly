"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ImagePlus, Link2, Plus, Save, Trash2 } from "lucide-react";
import { updateStorefrontAction } from "@/app/actions/dashboard";
import { ActionForm } from "@/components/action-form";
import { normalizeStorefrontConfig } from "@/lib/storefront";
import { ResilientImage } from "@/components/resilient-image";

export function StorefrontBuilder({
  store,
}: {
  store: { slug: string; storefront_config: unknown };
}) {
  const config = useMemo(
    () => normalizeStorefrontConfig(store.storefront_config),
    [store.storefront_config],
  );
  const [bannerMode, setBannerMode] = useState(config.bannerMode);
  const [faqCount, setFaqCount] = useState(Math.max(3, config.faqs.length));
  const [bannerPreviews, setBannerPreviews] = useState<(string | null)[]>(() =>
    [0, 1, 2].map((index) => config.banners[index]?.url || null),
  );
  useEffect(
    () => () => {
      bannerPreviews.forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    },
    [bannerPreviews],
  );
  const previewBanner = (index: number, file?: File) => {
    if (!file) return;
    setBannerPreviews((current) => {
      const next = [...current];
      if (next[index]?.startsWith("blob:")) URL.revokeObjectURL(next[index]!);
      next[index] = URL.createObjectURL(file);
      return next;
    });
  };
  const faqs = Array.from({ length: faqCount }, (_, index) =>
    config.faqs[index] || { question: "", answer: "" },
  );

  return (
    <ActionForm
      action={updateStorefrontAction}
      className="sd-card storefront-builder"
      savingText="در حال ساخت صفحه اختصاصی فروشگاه…"
    >
      <header className="storefront-builder-head">
        <div>
          <span>صفحه‌ساز فروشگاه</span>
          <h2>ویترینت را مثل یک وب‌سایت مستقل بچین</h2>
          <p>هر بخش را جداگانه روشن کن. بخش‌های ناقص حتی اگر انتخاب شوند، به خریدار نمایش داده نمی‌شوند.</p>
        </div>
        <a href={`/stores/${store.slug}`} target="_blank" rel="noreferrer">پیش‌نمایش فروشگاه</a>
      </header>

      <details open className="storefront-editor-group">
        <summary><span>آدرس و معرفی کوتاه</span><ChevronDown /></summary>
        <div className="storefront-editor-grid">
          <label>
            آدرس فروشگاه
            <div className="slug-input"><span>chaplly.ir/stores/</span><input name="slug" dir="ltr" defaultValue={store.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" minLength={3} maxLength={48} /></div>
            <small>فقط حروف کوچک انگلیسی، عدد و خط تیره؛ بدون فاصله.</small>
          </label>
          <label>
            شعار کوتاه برند
            <input name="tagline" defaultValue={config.tagline} maxLength={180} placeholder="مثلاً: رنگ‌های جسور برای روزهای معمولی" />
          </label>
          <label className="storefront-wide storefront-toggle"><input type="checkbox" name="heroEnabled" defaultChecked={config.heroEnabled} /><span>نمایش بخش اصلی بالای صفحه</span></label>
          <label className="storefront-wide storefront-toggle"><input type="checkbox" name="announcementEnabled" defaultChecked={config.announcementEnabled} /><span>نمایش نوار اطلاع‌رسانی</span></label>
          <label className="storefront-wide">
            متن اطلاع‌رسانی
            <input name="announcement" defaultValue={config.announcement} maxLength={180} placeholder="ارسال رایگان برای خریدهای بالای…" />
          </label>
        </div>
      </details>

      <details open className="storefront-editor-group">
        <summary><span>بنرهای تبلیغاتی میانی</span><ChevronDown /></summary>
        <label className="storefront-toggle"><input type="checkbox" name="bannerEnabled" defaultChecked={config.bannerEnabled} /><span>نمایش بنر تبلیغاتی</span></label>
        <div className="banner-mode-picker">
          <label><input type="radio" name="bannerMode" value="STATIC" checked={bannerMode === "STATIC"} onChange={() => setBannerMode("STATIC")} /><span>یک بنر ثابت</span></label>
          <label><input type="radio" name="bannerMode" value="SLIDER" checked={bannerMode === "SLIDER"} onChange={() => setBannerMode("SLIDER")} /><span>اسلاید خودکار ۲ یا ۳ بنری</span></label>
        </div>
        <p className="storefront-hint">تصویرها بدون افت کیفیت ذخیره می‌شوند. برای اسلایدر حداقل دو تصویر لازم است.</p>
        <div className="promo-banner-editors">
          {[0, 1, 2].map((index) => {
            const banner = config.banners[index];
            const preview = bannerPreviews[index];
            return <section key={index} className={bannerMode === "STATIC" && index > 0 ? "secondary-banner" : ""}>
              <b>بنر {index + 1}</b>
              <input type="hidden" name={`currentBanner${index}`} value={banner?.url || ""} />
              <label className={`promo-image-input ${preview ? "has-preview" : ""}`}>
                {preview ? <ResilientImage src={preview} alt={`پیش‌نمایش بنر ${index + 1}`} fill sizes="260px" unoptimized /> : <ImagePlus />}
                <input type="file" name={`promoBanner${index}`} accept="image/png,image/jpeg,image/webp" onChange={(event) => previewBanner(index, event.target.files?.[0])} />
                <span>{preview ? "تغییر تصویر" : "انتخاب تصویر"}</span>
              </label>
              <input name={`bannerTitle${index}`} defaultValue={banner?.title || ""} maxLength={90} placeholder="تیتر بنر (اختیاری)" />
              <textarea name={`bannerSubtitle${index}`} defaultValue={banner?.subtitle || ""} maxLength={180} placeholder="توضیح کوتاه (اختیاری)" />
              <div><input name={`bannerCtaLabel${index}`} defaultValue={banner?.ctaLabel || ""} maxLength={35} placeholder="متن دکمه" /><label><Link2 /><input name={`bannerCtaUrl${index}`} defaultValue={banner?.ctaUrl || ""} dir="ltr" placeholder="/products/..." /></label></div>
            </section>;
          })}
        </div>
      </details>

      <details open className="storefront-editor-group">
        <summary><span>داستان و درباره ما</span><ChevronDown /></summary>
        <label className="storefront-toggle"><input type="checkbox" name="aboutEnabled" defaultChecked={config.aboutEnabled} /><span>نمایش درباره ما</span></label>
        <div className="storefront-editor-grid">
          <label>عنوان بخش<input name="aboutTitle" defaultValue={config.aboutTitle} maxLength={90} /></label>
          <label className="storefront-wide">داستان برند<textarea name="aboutBody" defaultValue={config.aboutBody} maxLength={6000} rows={8} placeholder="از شروع مسیر، نگاهت به طراحی، ارزش‌های برند و محصولاتی که می‌سازی بنویس…" /><small>برای نمایش، حداقل ۴۰ کاراکتر لازم است. با خط خالی، پاراگراف‌ها را جدا کن.</small></label>
        </div>
      </details>

      <details open className="storefront-editor-group">
        <summary><span>سؤالات متداول</span><ChevronDown /></summary>
        <label className="storefront-toggle"><input type="checkbox" name="faqEnabled" defaultChecked={config.faqEnabled} /><span>نمایش سؤالات متداول در انتهای صفحه</span></label>
        <p className="storefront-hint">برای نمایش این بخش، حداقل سه سؤال و پاسخ کامل لازم است.</p>
        <div className="faq-editor-list">
          {faqs.map((faq, index) => <section key={index}>
            <b>سؤال {index + 1}</b>
            <input name="faqQuestion" defaultValue={faq.question} maxLength={180} placeholder="سؤال مشتری" />
            <textarea name="faqAnswer" defaultValue={faq.answer} maxLength={1200} placeholder="پاسخ روشن و کوتاه" />
            {faqCount > 3 && index === faqCount - 1 && <button type="button" onClick={() => setFaqCount((value) => value - 1)}><Trash2 /> حذف</button>}
          </section>)}
        </div>
        {faqCount < 8 && <button type="button" className="storefront-add-row" onClick={() => setFaqCount((value) => value + 1)}><Plus /> افزودن سؤال</button>}
      </details>

      <details open className="storefront-editor-group">
        <summary><span>بخش‌های هوشمند فروشگاه</span><ChevronDown /></summary>
        <p className="storefront-hint">محصولات این بخش‌ها خودکار انتخاب می‌شوند و هر ردیف دو محصول بزرگ نشان می‌دهد.</p>
        <div className="automatic-section-toggles">
          <label><input type="checkbox" name="popularEnabled" defaultChecked={config.popularEnabled} /><span><b>محبوب‌ترین‌ها</b><small>بر اساس فروش و بازدید</small></span></label>
          <label><input type="checkbox" name="newestEnabled" defaultChecked={config.newestEnabled} /><span><b>جدیدترین‌ها</b><small>تازه‌ترین محصولات منتشرشده</small></span></label>
          <label><input type="checkbox" name="discountsEnabled" defaultChecked={config.discountsEnabled} /><span><b>بیشترین تخفیف</b><small>بالاترین درصد تخفیف فعال</small></span></label>
          <label><input type="checkbox" name="affordableEnabled" defaultChecked={config.affordableEnabled} /><span><b>اقتصادی‌ترین‌ها</b><small>کمترین قیمت نهایی</small></span></label>
          <label><input type="checkbox" name="reelsEnabled" defaultChecked={config.reelsEnabled} /><span><b>ویدیوهای فروشگاه</b><small>۶ ریل برتر فروشنده</small></span></label>
        </div>
      </details>

      <button className="sd-primary storefront-save"><Save /> ذخیره و انتشار چیدمان</button>
    </ActionForm>
  );
}
