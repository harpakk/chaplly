"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Copy,
  Crown,
  ExternalLink,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import {
  activateExclusiveStoreAction,
  updateStoreMediaAction,
  type ActionResult,
} from "@/app/actions/dashboard";
import { ActionForm } from "@/components/action-form";
import { SavingOverlay } from "@/components/saving-overlay";

type Store = {
  name: string;
  slug: string;
  description: string | null;
  brand_color: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  brand_tone: string | null;
  hostname: string | null;
};
const initial: ActionResult = { ok: false, message: "" };

export function ExclusiveStoreControl({ store }: { store: Store }) {
  const [enabled, setEnabled] = useState(store.brand_tone === "EXCLUSIVE");
  const [share, setShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(
    activateExclusiveStoreAction,
    initial,
  );
  useEffect(() => {
    if (state.ok) {
      setEnabled(true);
      setShare(true);
    }
  }, [state]);
  const url = `https://${store.hostname || `${store.slug}.chaplly.ir`}`;
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <ActionForm
        action={updateStoreMediaAction}
        className="sd-card store-media-settings"
      >
        <div>
          <span>تصاویر برند</span>
          <h2>لوگو و بنر فروشگاه</h2>
          <p>هم در پنل و هم در فروشگاه اختصاصی استفاده می‌شوند.</p>
        </div>
        <label>
          لوگوی مربع
          <input
            name="storeLogo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
          />
          <span className="store-media-current square">{store.logoUrl ? <Image src={store.logoUrl} alt="لوگوی فعلی فروشگاه" fill sizes="72px" unoptimized /> : "بدون لوگو"}</span>
        </label>
        <label>
          بنر عریض
          <input
            name="storeBanner"
            type="file"
            accept="image/png,image/jpeg,image/webp"
          />
          <span className="store-media-current banner">{store.bannerUrl ? <Image src={store.bannerUrl} alt="بنر فعلی فروشگاه" fill sizes="180px" unoptimized /> : "بدون بنر"}</span>
        </label>
        <button>ذخیره تصاویر</button>
      </ActionForm>
      <section className="sd-exclusive-card">
        <div>
          <Crown />
          <span>
            {enabled ? "فروشگاه اختصاصی فعال است" : "ویترین مستقل برندت"}
          </span>
          <h2>
            {enabled
              ? store.hostname || `${store.slug}.chaplly.ir`
              : "یک فروشگاه که کاملاً مال خودته"}
          </h2>
          <p>
            لوگو، بنر، رنگ و محصولات خودت؛ یک لینک کوتاه برای بیو، استوری و فروش
            مستقیم.
          </p>
        </div>
        <div>
          {enabled ? (
            <>
              <a href={`/stores/${store.slug}`} target="_blank">
                مشاهده <ExternalLink />
              </a>
              <button onClick={() => setShare(true)}>
                <Share2 /> اشتراک‌گذاری
              </button>
            </>
          ) : (
            <form action={action}>
              <SavingOverlay
                visible={pending}
                text="در حال ساخت فروشگاه اختصاصی…"
              />
              <button disabled={pending}>
                <Sparkles />
                {pending ? "در حال ساخت…" : "ساخت فروشگاه اختصاصی"}
              </button>
              {state.message && !state.ok && <small>{state.message}</small>}
            </form>
          )}
        </div>
      </section>
      {share && (
        <div className="store-share-backdrop" onClick={() => setShare(false)}>
          <section
            className="store-share-modal"
            onClick={(event) => event.stopPropagation()}
            style={
              { "--share-color": store.brand_color } as React.CSSProperties
            }
          >
            <button
              className="store-share-close"
              onClick={() => setShare(false)}
            >
              <X />
            </button>
            <div
              className="share-story-card"
              style={{
                backgroundImage: `linear-gradient(155deg,${store.brand_color}ee,#17121f 72%),url("${store.bannerUrl || ""}")`,
              }}
            >
              <span>
                <Crown /> فروشگاه اختصاصی من
              </span>
              <Image
                src={store.logoUrl || "/images/product-placeholder.png"}
                alt=""
                width={160}
                height={160}
              />
              <h2>{store.name}</h2>
              <p>{store.description || "محصول‌های اورجینال با امضای خودم."}</p>
              <div>
                <b>{store.hostname || `${store.slug}.chaplly.ir`}</b>
                <BadgeCheck />
              </div>
              <small>برای دیدن کالکشن وارد لینک شو ✦</small>
            </div>
            <div className="share-modal-copy">
              <span>آماده‌ی اسکرین‌شات و استوری</span>
              <h3>فروشگاهت را با افتخار معرفی کن</h3>
              <p>
                کارت بالا با نسبت مناسب استوری طراحی شده. اسکرین‌شات بگیر یا
                لینک را کپی کن.
              </p>
              <button onClick={copy}>
                {copied ? <BadgeCheck /> : <Copy />}
                {copied ? "کپی شد" : "کپی لینک فروشگاه"}
              </button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  onClick={() =>
                    navigator.share({
                      title: store.name,
                      text: `فروشگاه ${store.name}`,
                      url,
                    })
                  }
                >
                  <Share2 /> اشتراک‌گذاری مستقیم
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
