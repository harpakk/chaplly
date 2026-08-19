/* eslint-disable @next/next/no-img-element -- DOM images are rasterized into product PNG files. */
"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronLeft,
  Copy,
  ExternalLink,
  Layers3,
  Maximize2,
  ImagePlus,
  Package,
  Palette,
  Save,
  ShoppingBag,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  saveSellerProductAction,
  publishSellerProductToWooCommerceAction,
  type ActionResult,
} from "@/app/actions/dashboard";
import type {
  getDesignEditorData,
  getProductStartData,
} from "@/lib/dashboard-data";
import { SavingOverlay } from "@/components/saving-overlay";
import { ActionForm } from "@/components/action-form";
import { WarpedArtwork } from "@/components/warped-artwork";
import {
  createPropertyPrices,
  expandPropertyPrices,
  serializePropertyPrices,
  VariantPropertyPricing,
} from "@/components/variant-property-pricing";
import { croppedArtworkImageStyle, hasManualArtworkCrop } from "@/lib/design-artwork-style";
import { SellerOnboardingTour, SellerTourReplayButton, type SellerTourStep } from "@/components/seller-onboarding-tour";
import type { SellerTourState } from "@/lib/seller-tour-shared";
import { ResilientImage, ResilientImg } from "@/components/resilient-image";

type CreationData = Awaited<ReturnType<typeof getProductStartData>>;
type EditorData = Awaited<ReturnType<typeof getDesignEditorData>>;

const exportSafeImageUrl = (source: string) => {
  if (!source || source.startsWith("data:") || source.startsWith("blob:") || source.startsWith("/")) return source;
  try {
    const imageUrl = new URL(source);
    const storageUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost");
    return imageUrl.origin === storageUrl.origin && imageUrl.pathname.startsWith("/storage/v1/object/")
      ? `/api/render-image?url=${encodeURIComponent(source)}`
      : source;
  } catch {
    return source;
  }
};

const productTourSteps: SellerTourStep[] = [
  { target: '[data-tour="product-intro"]', emoji: "🎯", title: "اول زمین بازی را انتخاب کن", body: "اینجا محصول پایه‌ای را انتخاب می‌کنی که طرحت قراره روی اون چاپ بشه." },
  { target: '[data-tour="product-categories"]', emoji: "🗂️", title: "یک دسته انتخاب کن", body: "مثلاً پوشاک یا اکسسوری. با انتخاب دسته، محصول‌های مناسب پایین صفحه ظاهر می‌شن." },
  { target: '[data-tour="raw-products"]', emoji: "👕", title: "حالا محصول خام را بردار", body: "هر کارت رنگ‌ها، اندازه‌ها و نمای قابل طراحی را نشون می‌ده. محصولی را انتخاب کن که به طرحت میاد." },
  { target: '[data-tour="enter-design"]', emoji: "✨", title: "ورود به استودیو", body: "با این دکمه وارد طراحی می‌شی؛ هنوز چیزی منتشر نمی‌شه و هر وقت بخوای می‌تونی برگردی.", hint: "بعد از کلیک، راهنمای خود استودیو هم منتظرته." },
];

export function ProductCreationFlow({
  data,
  rawProductId,
  designId,
  supplierOfferId,
  tourState,
}: {
  data: CreationData | EditorData;
  rawProductId?: string;
  designId?: string;
  supplierOfferId?: string;
  tourState: SellerTourState;
}) {
  if (rawProductId && designId && "design" in data && data.design)
    return (
      <FinalProduct
        data={data}
        rawProductId={rawProductId}
        designId={designId}
        supplierOfferId={supplierOfferId}
      />
    );
  return <StartProduct data={data} tourState={tourState} />;
}

function StartProduct({ data, tourState }: { data: CreationData | EditorData; tourState: SellerTourState }) {
  const parents = data.categories.filter(
    (category) =>
      !category.parent_id &&
      category.name.trim() !== "لوازم تحریر" &&
      !/stationery|stationary/i.test(category.slug),
  );
  const [category, setCategory] = useState(parents[0]?.id || "");
  const rawProducts = useMemo(() => {
    const childIds = new Set(
      data.categories
        .filter((item) => item.parent_id === category)
        .map((item) => item.id),
    );
    return data.rawProducts.filter(
      (raw) => raw.category_id === category || childIds.has(raw.category_id),
    );
  }, [category, data]);
  return (
    <div className="product-wizard-page">
      <SellerOnboardingTour tour="product" state={tourState} steps={productTourSteps} />
      <header className="wizard-head" data-tour="product-intro">
        <div>
          <span>ساخت محصول جدید / مرحله ۱</span>
          <h1>اول محصول پایه را انتخاب کن</h1>
          <p>
            دسته را انتخاب کن و بعد محصول خامی را بردار که قرار است طرحت روی آن
            بنشیند.
          </p>
        </div>
        <SellerTourReplayButton tour="product" label="راهنمای این مرحله" />
      </header>
      <main className="wizard-main">
        <section className="wizard-section" data-tour="product-categories">
          <span>دسته‌بندی رسمی</span>
          <h2>چه چیزی می‌سازی؟</h2>
          <div className="category-cards">
            {parents.map((item) => (
              <button
                className={category === item.id ? "active" : ""}
                onClick={() => setCategory(item.id)}
                key={item.id}
              >
                {item.imageUrl ? <ResilientImage src={item.imageUrl} alt={item.name} width={72} height={72} unoptimized /> : <Palette />}
                <b>{item.name}</b>
              </button>
            ))}
          </div>
        </section>
        <section className="wizard-section" data-tour="raw-products">
          <span>محصول خام / زیر‌دسته</span>
          <h2>پایه تولید را انتخاب کن</h2>
          {rawProducts.length ? (
            <div className="raw-choice-grid">
              {rawProducts.map((raw) => (
                <article key={raw.id}>
                  <div>
                    {raw.mainImageUrl ? (
                      <ResilientImage
                        src={raw.mainImageUrl}
                        alt={raw.name}
                        width={640}
                        height={512}
                        sizes="(max-width: 760px) 100vw, 300px"
                        unoptimized
                      />
                    ) : (
                      <Package />
                    )}
                  </div>
                  <small>
                    {raw.has_back ? "نمای جلو و پشت" : "فقط نمای جلو"}
                  </small>
                  <h3>{raw.name}</h3>
                  <p>{raw.description}</p>
                  <div>
                    <span>{raw.colorCount} رنگ</span>
                    <span>{raw.sizeCount} سایز</span>
                  </div>
                  <Link
                    className="next"
                    data-tour="enter-design"
                    href={`/seller/dashboard/products/new/design?raw=${raw.id}`}
                  >
                    ورود به صفحه طراحی <ChevronLeft />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              برای این دسته هنوز محصول خام فعالی تعریف نشده است.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function FinalProduct({
  data,
  rawProductId,
  designId,
  supplierOfferId,
}: {
  data: EditorData;
  rawProductId: string;
  designId: string;
  supplierOfferId?: string;
}) {
  const raw = data.rawProducts[0];
  const draft = data.productDraft;
  const productSlug =
    draft?.slug || `${raw?.slug || "product"}-${designId.slice(0, 8)}`;
  const eligible = data.suppliers.filter((offer) =>
    data.design!.variantIds.every((variantId) =>
      offer.variants.some(
        (variant) => variant.raw_product_variant_id === variantId,
      ),
    ),
  );
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    saveSellerProductAction,
    { ok: false, message: "" },
  );
  const [primary, setPrimary] = useState(
    supplierOfferId || draft?.primary_supplier_offer_id || "",
  );
  const [clientError, setClientError] = useState<null | {
    message: string;
    field?: string;
  }>(null);
  const [submittedIntent, setSubmittedIntent] = useState("");
  const [successOpen, setSuccessOpen] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [expandedImage, setExpandedImage] = useState<{ src: string; label: string } | null>(null);
  const [title, setTitle] = useState(draft?.title || "");
  const [subtitle, setSubtitle] = useState(draft?.subtitle || "");
  const [description, setDescription] = useState(draft?.description || "");
  const [aiPending, setAiPending] = useState(false);
  const [preparingImages, setPreparingImages] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const selectedMockups = data.mockups.filter((mockup) =>
    data.selectedMockupIds.includes(mockup.id),
  );
  const pricingOffer = data.suppliers.find(
    (offer) => offer.id === primary,
  );
  const renderedMockupViews = selectedMockups.flatMap((mockup) =>
    mockup.views.map((view) => ({
      mockup,
      view,
      key: `${mockup.id}:${view.id}`,
    })),
  );
  const [visibleMockups, setVisibleMockups] = useState(
    renderedMockupViews.map((item) => item.key),
  );
  const [primaryImage, setPrimaryImage] = useState(
    renderedMockupViews[0]?.key || "",
  );
  const [customImages, setCustomImages] = useState<File[]>([]);
  const savedVariantMarkups = new Map(
    (draft?.variantPrices || []).map((item) => [item.rawProductVariantId, item.markupPercentage]),
  );
  const pricingVariants = data.design!.variantIds.flatMap((id) => {
    const variant = raw.variants.find((item) => item.id === id);
    if (!variant) return [];
    const supplierCost = Number(
      pricingOffer?.variants.find((item) => item.raw_product_variant_id === id)?.unit_cost || 0,
    );
    return [{
      rawProductVariantId: id,
      colorId: variant.color_id,
      colorName: raw.colors.find((item) => item.id === variant.color_id)?.name || "رنگ استاندارد",
      sizeId: variant.size_id,
      sizeName: raw.sizes.find((item) => item.id === variant.size_id)?.name || "سایز استاندارد",
      supplierCost,
      markupPercentage: savedVariantMarkups.get(id) ?? 30,
    }];
  });
  const [propertyPrices, setPropertyPrices] = useState(() => createPropertyPrices(pricingVariants, draft?.propertyMarkups));
  const variantPrices = expandPropertyPrices(pricingVariants, propertyPrices);
  const fileInput = useRef<HTMLInputElement>(null);
  const errorAlert = useRef<HTMLDivElement>(null);
  const preparing = useRef(false);
  useEffect(() => () => {
    if (expandedImage?.src.startsWith("blob:")) URL.revokeObjectURL(expandedImage.src);
  }, [expandedImage]);
  useEffect(() => {
    if (pending) setPreparingImages(false);
    if (!pending && state.message) preparing.current = false;
  }, [pending, state.message]);
  useEffect(() => {
    if (pending || state.ok || !state.message) return;
    const firstField = Object.keys(state.fieldErrors || {})[0];
    if (!firstField) {
      errorAlert.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const field = document.querySelector<HTMLElement>(`[data-error-field="${firstField}"]`) || document.querySelector<HTMLElement>(`[name="${firstField}"]`);
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => field?.focus({ preventScroll: true }), 350);
  }, [pending, state.fieldErrors, state.message, state.ok]);
  const showClientError = (message: string, field?: string) => {
    setClientError({ message, field });
    requestAnimationFrame(() => {
      if (!field) {
        errorAlert.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const input = document.querySelector<HTMLElement>(`[data-error-field="${field}"]`) || document.querySelector<HTMLElement>(`[name="${field}"]`);
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => input?.focus({ preventScroll: true }), 350);
    });
  };
  const fieldError = (name: string) =>
    clientError?.field === name
      ? clientError.message
      : state.fieldErrors?.[name];
  const errorField = clientError?.field || Object.keys(state.fieldErrors || {})[0];
  const errorPlace = errorField
    ? ({
        productImages: "بخش تصاویر محصول",
        variantPrices: "بخش قیمت فروش رنگ‌ها و سایزها",
        title: "فیلد عنوان رسمی",
        description: "فیلد توضیحات کامل",
        graphicStyleIds: "بخش نوع طراحی محصول",
        primarySupplierOfferId: "انتخاب تأمین‌کننده اصلی",
        gender: "انتخاب جنسیت محصول",
        details: "بخش مشخصات ساختاریافته",
        visibility: "بخش نحوه نمایش محصول",
      } as Record<string, string>)[errorField]
    : undefined;
  const fileAsDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const captureImage = async (key: string, pixelRatio = 2) => {
    if (key.startsWith("custom:")) {
      const file = customImages[Number(key.split(":")[1])];
      return file ? fileAsDataUrl(file) : "";
    }
    const item = renderedMockupViews.find((candidate) => candidate.key === key);
    if (!item) return "";
    const node = document.getElementById(`product-render-${item.mockup.id}-${item.view.id}`);
    if (!node) return "";
    const blob = await toBlob(node, {
      pixelRatio,
      cacheBust: true,
      includeQueryParams: true,
      backgroundColor: "transparent",
      skipFonts: true,
      filter: (candidate) => !candidate.classList?.contains("artwork-warp-raster-source") && !candidate.classList?.contains("artwork-warp-loading"),
    });
    return blob ? fileAsDataUrl(blob) : "";
  };
  const openImagePreview = async (key: string, label: string) => {
    try {
      const dataUrl = await captureImage(key, 2);
      if (dataUrl) setExpandedImage({ src: dataUrl, label });
    } catch {
      setAiMessage("نمایش بزرگ این تصویر آماده نشد؛ دوباره تلاش کنید.");
    }
  };
  const generateAiCopy = async () => {
    if (!window.confirm("دستیار هوشمند عنوان، زیرعنوان و توضیحات فعلی را با یک متن تازه جایگزین کند؟")) return;
    setAiPending(true);
    setAiMessage("دستیار در حال دیدن محصول و نوشتن متن فارسی است…");
    try {
      const imageDataUrl = await captureImage(primaryImage || visibleMockups[0] || "", 1);
      const response = await fetch("/api/seller/product-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId, requestId: crypto.randomUUID(), imageDataUrl: imageDataUrl || undefined }),
      });
      const payload = await response.json() as { copy?: { title: string; subtitle: string; description: string }; quota?: { remaining: number }; message?: string };
      if (!response.ok || !payload.copy) throw new Error(payload.message || "ساخت متن انجام نشد.");
      setTitle(payload.copy.title);
      setSubtitle(payload.copy.subtitle);
      setDescription(payload.copy.description);
      setAiRemaining(payload.quota?.remaining ?? null);
      setAiMessage("متن آماده شد؛ می‌توانید هر بخش را قبل از ثبت ویرایش کنید.");
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : "ساخت متن انجام نشد؛ دوباره تلاش کنید.");
    } finally {
      setAiPending(false);
    }
  };
  const prepareImages = async (event: React.FormEvent<HTMLFormElement>) => {
    if (preparing.current) return;
    event.preventDefault();
    // React only guarantees currentTarget while the event handler is running
    // synchronously. Rasterizing mockups awaits images/fonts, so retain the DOM
    // form before the first await and never read currentTarget afterward.
    const formElement = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    setSubmittedIntent(submitter?.value || "draft");
    setSuccessOpen(true);
    setClientError(null);
    const form = new FormData(formElement);
    const title = String(form.get("title") || "").trim();
    const slug = String(form.get("slug") || "").trim();
    const description = String(form.get("description") || "").trim();
    if (title.length < 3) {
      showClientError("عنوان محصول باید حداقل ۳ نویسه باشد.", "title");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(slug)) {
      showClientError(
        "شناسه انگلیسی باید ۳ تا ۸۰ نویسه و فقط شامل حروف کوچک انگلیسی، عدد و خط تیره باشد.",
        "slug",
      );
      return;
    }
    if (!description) {
      showClientError("توضیحات کامل محصول را وارد کنید.", "description");
      return;
    }
    if (!form.getAll("graphicStyleIds").some(Boolean)) {
      showClientError(
        "حداقل یک نوع طراحی برای محصول انتخاب کنید.",
        "graphicStyleIds",
      );
      return;
    }
    if (!String(form.get("primarySupplierOfferId") || "")) {
      showClientError(
        "یک تأمین‌کننده اصلی برای تنوع‌های انتخاب‌شده انتخاب کنید.",
        "primarySupplierOfferId",
      );
      return;
    }
    const belowSupplierCost = variantPrices.some((variant) => variant.consumerPrice < (pricingVariants.find((item) => item.rawProductVariantId === variant.rawProductVariantId)?.supplierCost || 0));
    if (belowSupplierCost) {
      showClientError(
        "قیمت فروش هیچ تنوعی نمی‌تواند از قیمت تأمین‌کننده کمتر باشد.",
        "variantPrices",
      );
      return;
    }
    if (submitter?.value?.startsWith("publish")) {
      const normalize = (value: unknown) =>
        String(value || "")
          .trim()
          .replace(/\s+/g, " ")
          .toLocaleLowerCase("fa");
      if (normalize(form.get("title")) === normalize(raw.name)) {
        showClientError(
          "عنوان محصول باید با نام محصول خام متفاوت باشد.",
          "title",
        );
        return;
      }
      if (normalize(form.get("description")) === normalize(raw.description)) {
        showClientError(
          "توضیحات محصول باید اختصاصی باشد و نمی‌تواند بدون تغییر از محصول خام کپی شود.",
          "description",
        );
        return;
      }
    }
    setPreparingImages(true);
    const transfer = new DataTransfer();
    const prepared: { key: string; file: File }[] = [];
    const failedRenderLabels: string[] = [];
    const mockupLabel = (key: string) => {
      const item = renderedMockupViews.find((candidate) => candidate.key === key);
      return item
        ? `${item.mockup.name} (${item.view.side === "FRONT" ? "نمای جلو" : "نمای پشت"})`
        : "موکاپ انتخاب‌شده";
    };
    try {
      const captureItems = renderedMockupViews.filter((item) =>
        visibleMockups.includes(item.key),
      );
      for (const item of captureItems) {
        const id = item.key;
        const node = document.getElementById(
          `product-render-${item.mockup.id}-${item.view.id}`,
        );
        if (node) {
          try {
            if (
              node.dataset.renderKey !== id ||
              node.dataset.mockupId !== item.mockup.id ||
              node.dataset.mockupViewId !== item.view.id
            ) {
              throw new Error("MOCKUP_CAPTURE_IDENTITY_MISMATCH");
            }
            const warpedCanvases = Array.from(
              node.querySelectorAll<HTMLCanvasElement>("canvas.artwork-warp-canvas"),
            );
            await Promise.all(
              warpedCanvases.map(
                (canvas) =>
                  canvas.dataset.warpReady === "true" || canvas.dataset.warpReady === "failed"
                    ? Promise.resolve()
                    : new Promise<void>((resolve) => {
                        const timeout = window.setTimeout(resolve, 2500);
                        canvas.addEventListener("warpready", () => {
                          window.clearTimeout(timeout);
                          resolve();
                        }, { once: true });
                      }),
              ),
            );
            const images = Array.from(node.querySelectorAll("img"));
            await Promise.all(
              images.map(async (image) => {
                if (!image.complete) {
                  await new Promise<void>((resolve) => {
                    image.addEventListener("load", () => resolve(), { once: true });
                    image.addEventListener("error", () => resolve(), { once: true });
                  });
                }
                await image.decode().catch(() => undefined);
              }),
            );
            await document.fonts.ready;
            for (const canvas of warpedCanvases.filter((item) => item.dataset.warpReady === "true"))
              canvas.toDataURL("image/png");
            const background = node.querySelector<HTMLImageElement>(
              "img[data-mockup-background]",
            );
            if (
              !background ||
              background.dataset.mockupViewId !== item.view.id
            ) {
              throw new Error("MOCKUP_BACKGROUND_IDENTITY_MISMATCH");
            }
            const sourceWidth = background?.naturalWidth || node.offsetWidth;
            // Keep the preview's CSS box untouched so export geometry is
            // identical. Raising pixelRatio adds real pixels without
            // stretching the already-rendered artwork or reflowing the clone.
            const outputPixelRatio = Math.max(
              1,
              Math.min(4, sourceWidth / Math.max(1, node.offsetWidth)),
            );
            const blob = await toBlob(node, {
              pixelRatio: outputPixelRatio,
              cacheBust: true,
              // Every protected mockup is served through /api/render-image
              // with the real file URL in the query string. html-to-image
              // otherwise drops that query when building its cache key and
              // reuses the first mockup background for every later render.
              includeQueryParams: true,
              backgroundColor: "transparent",
              skipFonts: true,
              filter: (candidate) =>
                !candidate.classList?.contains("artwork-warp-raster-source") &&
                !candidate.classList?.contains("artwork-warp-loading"),
            });
            if (blob) {
              prepared.push({
                key: id,
                file: new File(
                  [blob],
                  `mockup-${item.mockup.id}-${item.view.id}.png`,
                  { type: "image/png" },
                ),
              });
            } else {
              failedRenderLabels.push(mockupLabel(id));
            }
          } catch {
            failedRenderLabels.push(mockupLabel(id));
          }
        } else {
          failedRenderLabels.push(mockupLabel(id));
        }
      }
    } catch {
      failedRenderLabels.push("تصاویر موکاپ");
    }
    customImages.forEach((file, index) =>
      prepared.push({ key: `custom:${index}`, file }),
    );
    prepared
      .sort(
        (a, b) =>
          Number(b.key === primaryImage) - Number(a.key === primaryImage),
      )
      .forEach((item) => transfer.items.add(item.file));
    if (failedRenderLabels.length) {
      const labels = [...new Set(failedRenderLabels)].slice(0, 3).join("، ");
      showClientError(
        `رندر ${labels} کامل نشد. در بخش «تصاویر محصول» همان موکاپ را حذف و دوباره انتخاب کنید؛ یا آن را حذف کنید و یک تصویر دلخواه اضافه کنید.`,
        "productImages",
      );
      setPreparingImages(false);
      return;
    }
    if (!transfer.files.length) {
      showClientError(
        "در بخش «تصاویر محصول» حداقل یک موکاپ را نگه دارید یا از دکمه «افزودن تصویر» استفاده کنید.",
        "productImages",
      );
      setPreparingImages(false);
      return;
    }
    if (fileInput.current) fileInput.current.files = transfer.files;
    if (!formElement.isConnected) {
      showClientError(
        "فرم دیگر در صفحه فعال نیست؛ صفحه را تازه‌سازی و دوباره تلاش کنید.",
      );
      setPreparingImages(false);
      return;
    }
    preparing.current = true;
    formElement.requestSubmit(
      submitter?.form === formElement ? submitter : undefined,
    );
  };
  return (
    <div className="product-wizard-page">
      <header className="wizard-head">
        <div>
          <span>ساخت محصول / مرحله نهایی</span>
          <h1>از طرح به ویترین</h1>
          <p>
            کپی، قیمت، مشخصات و تأمین‌کننده‌ها را کامل کن. انتشار وارد صف بررسی
            مدیر می‌شود.
          </p>
        </div>
        <Link
          href={`/seller/dashboard/products/new/design?raw=${rawProductId}&design=${designId}`}
        >
          <Layers3 /> برگشت به طراحی
        </Link>
      </header>
      <main className="wizard-main">
        <form action={action} onSubmit={prepareImages} noValidate>
          <SavingOverlay
            visible={pending || preparingImages}
            text="در حال ذخیره و آماده‌سازی محصول…"
            steps={["رندر تصاویر موکاپ", "بارگذاری تصاویر", "ذخیره مشخصات محصول", "ثبت قیمت و تنوع‌ها", "نهایی‌سازی انتشار"]}
          />
          <input type="hidden" name="designId" value={designId} />
          <input type="hidden" name="rawProductId" value={rawProductId} />
          <input
            type="hidden"
            name="productId"
            value={state.id || draft?.id || ""}
          />
          <input
            ref={fileInput}
            type="file"
            name="productImages"
            multiple
            hidden
          />
          <input
            type="hidden"
            name="variantPrices"
            value={JSON.stringify(variantPrices)}
          />
          <input type="hidden" name="propertyPrices" value={JSON.stringify(serializePropertyPrices(pricingVariants, propertyPrices))} />
          {(clientError || (!pending && !state.ok && state.message)) && (
            <div
              className="product-submit-alert"
              role="alert"
              ref={errorAlert}
              tabIndex={-1}
            >
              <AlertTriangle />
              <div>
                <strong>محصول هنوز ارسال نشده است</strong>
                {errorPlace && <b>محل اصلاح: {errorPlace}</b>}
                <p>{clientError?.message || state.message}</p>
                {!clientError && state.detail && (
                  <small>جزئیات خطا: {state.detail}</small>
                )}
                <span>اطلاعات واردشده حفظ شده؛ مورد بالا را اصلاح و دوباره تلاش کنید.</span>
              </div>
            </div>
          )}
          <section className="wizard-section product-image-section" data-error-field="productImages" tabIndex={-1}>
            <span>تصاویر محصول</span>
            <h2>موکاپ‌های نهایی و تصاویر دلخواه</h2>
            <p>
              حداقل یک تصویر لازم است. موکاپ‌ها با طرح شما رندر می‌شوند و
              می‌توانید حذفشان کنید یا تصویر دیگری اضافه کنید.
            </p>
            <div className="final-product-images">
              {renderedMockupViews
                .filter((item) => visibleMockups.includes(item.key))
                .map(({ mockup, view: mockupView, key }) => {
                  const rawView = raw.views.find(
                    (view) => view.side === mockupView.side,
                  );
                  const document = data.design!.views.find(
                    (view) => view.raw_product_view_id === rawView?.id,
                  )?.canvas_document as
                    {
                      objects?: Array<Record<string, unknown>>;
                      colorObjects?: Record<
                        string,
                        Array<Record<string, unknown>>
                      >;
                    } | undefined;
                  const colorArtwork = mockup.color_id
                    ? document?.colorObjects?.[mockup.color_id]
                    : undefined;
                  const mockupArtwork = colorArtwork?.length
                    ? colorArtwork
                    : document?.objects || [];
                  return (
                    <article key={key}>
                      <div
                        id={`product-render-${mockup.id}-${mockupView.id}`}
                        data-render-key={key}
                        data-mockup-id={mockup.id}
                        data-mockup-view-id={mockupView.id}
                        className="configured-mockup-canvas product-render-canvas"
                      >
                        <div key={mockupView.id}>
                          <ResilientImg
                            src={exportSafeImageUrl(mockupView.backgroundUrl)}
                            alt={mockup.name}
                            crossOrigin="anonymous"
                            data-mockup-background
                            data-mockup-view-id={mockupView.id}
                          />
                          <WarpedArtwork
                            key={`${mockup.id}:${mockupView.id}:${mockup.color_id || "default"}`}
                            points={mockupView.perspective_points}
                            clip={mockupView.artwork_clip}
                            fabricTextureUrl={exportSafeImageUrl(mockupView.backgroundUrl)}
                            renderPixelRatio={4}
                            style={{
                              left: `${Number(mockupView.area_x) * 100}%`,
                              top: `${Number(mockupView.area_y) * 100}%`,
                              width: `${Number(mockupView.area_width) * 100}%`,
                              height: `${Number(mockupView.area_height) * 100}%`,
                              transform: `rotate(${Number(mockupView.rotation_degrees || 0)}deg)`,
                            }}
                          >
                            {mockupArtwork.map((object, index) => (
                              <div
                                className="configured-object"
                                key={String(object.id || index)}
                                style={{
                                  left: `${Number(object.x || 0)}%`,
                                  top: `${Number(object.y || 0)}%`,
                                  width: `${Number(object.w || 10)}%`,
                                  height: `${Number(object.h || 10)}%`,
                                  color: String(object.color || "#111"),
                                  background: object.kind === "shape" ? String(object.color || "#111") : "transparent",
                                  fontSize: `${Math.max(7, Number(object.fontSize || 20) * 0.32)}px`,
                                  fontFamily: String(
                                    object.fontFamily || "Vazirmatn",
                                  ),
                                  opacity:
                                    Number(object.opacity ?? 100) / 100,
                                  transform: `rotate(${Number(object.rotation || 0)}deg)`,
                                }}
                              >
                                {object.kind === "text" &&
                                  String(object.text || "")}
                                {object.kind === "image" &&
                                  Boolean(object.src) && (
                                    <span
                                      className="cropped-artwork-image"
                                    >
                                    <ResilientImg
                                      src={exportSafeImageUrl(String(object.src))}
                                      alt="طرح"
                                      crossOrigin="anonymous"
                                      data-manual-crop={hasManualArtworkCrop(object) ? "true" : undefined}
                                      style={{
                                        filter: `saturate(${Number(object.saturation ?? 100)}%)`,
                                        ...croppedArtworkImageStyle(object),
                                      }}
                                    />
                                    </span>
                                  )}
                              </div>
                            ))}
                          </WarpedArtwork>
                        </div>
                      </div>
                      <small className="mockup-side-label">
                        {mockup.name} ·{" "}
                        {mockupView.side === "FRONT" ? "نمای جلو" : "نمای پشت"}
                      </small>
                      <button type="button" className="expand-product-image" onClick={() => void openImagePreview(key, mockup.name)} aria-label="نمایش بزرگ تصویر"><Maximize2 /></button>
                      <button
                        type="button"
                        className={`choose-primary-image ${primaryImage === key ? "active" : ""}`}
                        onClick={() => setPrimaryImage(key)}
                      >
                        {primaryImage === key
                          ? "تصویر اصلی"
                          : "انتخاب به‌عنوان اصلی"}
                      </button>
                      <button
                        className="remove-product-image"
                        type="button"
                        onClick={() =>
                          setVisibleMockups((current) => {
                            const next = current.filter((id) => id !== key);
                            if (primaryImage === key)
                              setPrimaryImage(
                                next[0] ||
                                  (customImages.length ? "custom:0" : ""),
                              );
                            return next;
                          })
                        }
                      >
                        <Trash2 /> حذف
                      </button>
                    </article>
                  );
                })}
              {customImages.map((file, index) => (
                <article key={`${file.name}-${index}`}>
                  <ResilientImg src={URL.createObjectURL(file)} alt={file.name} />
                  <button type="button" className="expand-product-image" onClick={() => void openImagePreview(`custom:${index}`, file.name)} aria-label="نمایش بزرگ تصویر"><Maximize2 /></button>
                  <button
                    type="button"
                    className={`choose-primary-image ${primaryImage === `custom:${index}` ? "active" : ""}`}
                    onClick={() => setPrimaryImage(`custom:${index}`)}
                  >
                    {primaryImage === `custom:${index}`
                      ? "تصویر اصلی"
                      : "انتخاب به‌عنوان اصلی"}
                  </button>
                  <button
                    className="remove-product-image"
                    type="button"
                    onClick={() =>
                      setCustomImages((current) => {
                        const next = current.filter(
                          (_, itemIndex) => itemIndex !== index,
                        );
                        if (primaryImage === `custom:${index}`)
                          setPrimaryImage(
                            visibleMockups[0] ||
                              (next.length ? "custom:0" : ""),
                          );
                        return next;
                      })
                    }
                  >
                    <Trash2 /> حذف
                  </button>
                </article>
              ))}
              <label className="add-product-image">
                <ImagePlus />
                <b>افزودن تصویر</b>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    setCustomImages((current) => {
                      if (!primaryImage && files.length)
                        setPrimaryImage(`custom:${current.length}`);
                      return [...current, ...files];
                    });
                  }}
                />
              </label>
            </div>
            {expandedImage && (
              <div className="product-image-lightbox" role="dialog" aria-modal="true" aria-label={expandedImage.label} onClick={() => setExpandedImage(null)}>
                <button type="button" onClick={() => setExpandedImage(null)} aria-label="بستن"><X /></button>
                <ResilientImg src={expandedImage.src} alt={expandedImage.label} onClick={(event) => event.stopPropagation()} />
              </div>
            )}
            {fieldError("productImages") && <small className="field-error product-section-error">{fieldError("productImages")}</small>}
          </section>
          <section className="wizard-section">
            <span>معرفی محصول</span>
            <div className="ai-copy-assistant">
              <div><WandSparkles /><span><b>نوشتن با دستیار هوشمند</b><small>با توجه به نوع محصول، تنوع‌ها و یک تصویر، متن فارسی اختصاصی می‌سازد. دو هفته اول روزی ۱۵ بار و بعد از آن روزی یک بار رایگان است.</small></span></div>
              <button type="button" onClick={() => void generateAiCopy()} disabled={aiPending}>{aiPending ? "در حال نوشتن…" : "ساخت متن با AI"}</button>
              {aiMessage && <p role="status">{aiMessage}{aiRemaining !== null ? ` · ${aiRemaining.toLocaleString("fa-IR")} استفاده رایگان باقی مانده` : ""}</p>}
            </div>
            <div className="wizard-fields">
              <label>
                عنوان رسمی
                <input
                  name="title"
                  required
                  minLength={3}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={`${raw?.name || "محصول"} — نام طرح`}
                  aria-invalid={Boolean(fieldError("title"))}
                />
                {fieldError("title") && (
                  <small className="field-error">{fieldError("title")}</small>
                )}
                <small>
                  برای ارسال به بررسی، عنوان باید با نام محصول خام متفاوت باشد.
                </small>
              </label>
              <input
                type="hidden"
                name="slug"
                value={productSlug}
              />
              <label className="wide">
                زیرعنوان کوتاه
                <input
                  name="subtitle"
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                />
              </label>
              <label className="wide">
                توضیحات کامل
                <textarea
                  name="description"
                  required
                  rows={6}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  aria-invalid={Boolean(fieldError("description"))}
                />
                {fieldError("description") && (
                  <small className="field-error">
                    {fieldError("description")}
                  </small>
                )}
                <small>توضیح اختصاصی محصول و طراحی خودت را اضافه کن.</small>
              </label>
              <details
                className="wide graphic-style-picker"
                data-error-field="graphicStyleIds"
                open
              >
                <summary>نوع طراحی محصول را انتخاب کنید (حداقل یک مورد)</summary>
                <div>
                  {data.graphicStyles.map((style) => (
                    <label key={style.id}>
                      <input
                        type="checkbox"
                        name="graphicStyleIds"
                        value={style.id}
                        defaultChecked={draft?.graphicStyleIds.includes(style.id)}
                      />
                      {style.imageUrl && <ResilientImage src={style.imageUrl} alt={style.name} width={52} height={52} unoptimized />}
                      <span>
                        <b>{style.name}</b>
                        {style.caption && <small>{style.caption}</small>}
                      </span>
                    </label>
                  ))}
                  {!data.graphicStyles.length && (
                    <p>هنوز سبک گرافیکی فعالی ثبت نشده است.</p>
                  )}
                </div>
                {fieldError("graphicStyleIds") && (
                  <small className="field-error product-section-error">
                    {fieldError("graphicStyleIds")}
                  </small>
                )}
              </details>
            </div>
            <div data-error-field="variantPrices" tabIndex={-1}>
              <VariantPropertyPricing
                variants={pricingVariants}
                value={propertyPrices}
                onChange={setPropertyPrices}
              />
            </div>
            {fieldError("variantPrices") && (
              <small className="field-error product-section-error">
                {fieldError("variantPrices")}
              </small>
            )}
          </section>
          <section className="wizard-section">
            <span>مشخصات ساختاریافته</span>
            <h2>جواب سؤال‌ها قبل از پرسیدن</h2>
            <label className="product-gender-field">
              جنسیت محصول
              <select name="gender" required defaultValue={draft?.gender || "UNISEX"} aria-invalid={Boolean(fieldError("gender"))}>
                <option value="MALE">مردانه</option>
                <option value="FEMALE">زنانه</option>
                <option value="UNISEX">یونیسکس</option>
              </select>
              {fieldError("gender") && <small className="field-error">{fieldError("gender")}</small>}
            </label>
            <div className="detail-builder">
              {[0, 1, 2, 3, 4].map((index) => (
                <div key={index}>
                  <input
                    name={`detailTitle${index}`}
                    defaultValue={
                      draft?.details[index]?.title ||
                      ["جنس", "وزن", "توضیحات تولید", "رنگ‌ها", "سایزها"][index]
                    }
                    placeholder="عنوان؛ مثل جنس"
                  />
                  <input
                    name={`detailValue${index}`}
                    defaultValue={
                      draft?.details[index]?.value ||
                      [
                          raw?.material || "",
                          raw?.weight_grams ? `${raw.weight_grams} گرم` : "",
                          raw?.production_notes || "",
                          raw?.colors.map((item) => item.name).join("، ") || "",
                          raw?.sizes.map((item) => item.name).join("، ") || "",
                        ][index]
                    }
                    placeholder="مقدار؛ مثل پنبه دورس"
                  />
                </div>
              ))}
            </div>
            {fieldError("details") && (
              <small className="field-error product-section-error">
                {fieldError("details")}
              </small>
            )}
          </section>
          <section className="wizard-section">
            <span>تأمین تولید</span>
            <h2>تأمین‌کننده محصول را انتخاب کن</h2>
            {eligible.length ? (
              <div className="final-suppliers">
                <label>
                  تأمین‌کننده اصلی
                  <select
                    name="primarySupplierOfferId"
                    value={primary}
                    onChange={(event) => {
                      setPrimary(event.target.value);
                    }}
                    required
                    aria-invalid={Boolean(
                      fieldError("primarySupplierOfferId"),
                    )}
                  >
                    <option value="">تأمین‌کننده را انتخاب کنید</option>
                    {eligible.map((offer) => (
                      <option value={offer.id} key={offer.id}>
                        {offer.organization?.display_name} ·{" "}
                        {offer.lead_time_days} روز · {offer.variants.length}{" "}
                        تنوع
                      </option>
                    ))}
                  </select>
                  {fieldError("primarySupplierOfferId") && (
                    <small className="field-error">
                      {fieldError("primarySupplierOfferId")}
                    </small>
                  )}
                </label>
              </div>
            ) : (
              <div className="empty-state">
                فعلاً تأمین‌کننده فعالی برای همه تنوع‌های انتخاب‌شده وجود ندارد.
                رنگ یا سایزها را بازبینی کنید یا تأمین‌کننده دیگری انتخاب کنید.
              </div>
            )}
          </section>
          <section className="wizard-section product-visibility-section">
            <span>نحوه نمایش</span>
            <h2>محصول کجا دیده شود؟</h2>
            <label>
              وضعیت نمایش محصول
              <select name="visibility" required defaultValue={draft?.visibility || "VISIBLE"}>
                <option value="VISIBLE">عمومی پس از تأیید</option>
                <option value="PRIVATE">خصوصی؛ فقط با لینک مستقیم</option>
              </select>
              <small>
                تا قبل از تأیید، هر دو گزینه فقط با لینک مستقیم قابل مشاهده و خرید هستند.
                اگر «خصوصی» را انتخاب کنی، محصول حتی بعد از تأیید هم در خانه، فروشگاه و جست‌وجو نمایش داده نمی‌شود.
              </small>
            </label>
          </section>
          {state.ok && state.message && (
            <div className="action-note success">
              {state.message}
              {state.id && (
                <Link href="/seller/dashboard?section=products">
                  دیدن محصولات <ChevronLeft />
                </Link>
              )}
            </div>
          )}
          <footer className="wizard-actions">
            <button name="intent" value="draft" disabled={pending}>
              <Save /> ذخیره پیش‌نویس
            </button>
            {data.woocommerceConnected ? (
              <div className="publish-channel-actions">
                <button name="intent" value="publish_chaplly" disabled={pending}>
                  انتشار فقط در چاپلی
                </button>
                <button className="next" name="intent" value="publish_woocommerce" disabled={pending}>
                  <Sparkles /> انتشار فقط در سایت من
                </button>
                <button className="next" name="intent" value="publish_both" disabled={pending}>
                  <Sparkles /> انتشار در چاپلی و سایت من
                </button>
              </div>
            ) : (
              <button className="next" name="intent" value="publish_chaplly" disabled={pending}>
                <Sparkles /> ارسال برای بررسی و انتشار
              </button>
            )}
          </footer>
        </form>
      </main>
      {state.ok && successOpen && ["publish", "publish_chaplly", "publish_both"].includes(submittedIntent) && (
        <div className="publish-success" role="dialog" aria-modal="true" aria-labelledby="publish-success-title">
          <div className="publish-success-card">
            <button type="button" className="publish-success-close" aria-label="بستن" onClick={() => setSuccessOpen(false)}><X /></button>
            <header className="publish-success-head">
              <span>🎉</span>
              <div>
                <small>محصول با موفقیت ساخته شد</small>
                <h2 id="publish-success-title">{state.message}</h2>
              </div>
              <BadgeCheck />
            </header>
            <p className="publish-success-explanation">تا زمان تأیید، محصول در ویترین‌ها دیده نمی‌شود؛ اما خریدار می‌تواند با لینک مستقیم آن را ببیند و بخرد.</p>
            <small className="publish-link-label">لینک مستقیم محصول</small>
            <div className="publish-share-link" dir="ltr">
              <input readOnly value={`/products/${productSlug}`} aria-label="لینک مستقیم محصول" />
              <button type="button" onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/products/${productSlug}`);
                setLinkCopied(true);
              }}><Copy /> {linkCopied ? "کپی شد" : "کپی لینک"}</button>
            </div>
            <div className="publish-success-actions">
              <Link className="publish-action-primary" href="/seller/dashboard/products/new">
                ساخت محصول جدید <Sparkles />
              </Link>
              <Link className="publish-action-secondary" href={`/products/${productSlug}`} target="_blank">
                مشاهده محصول <ExternalLink />
              </Link>
              <Link className="publish-action-tertiary" href="/seller/dashboard?section=products">
                بازگشت به محصولات <ChevronLeft />
              </Link>
            </div>
            {data.woocommerceConnected && submittedIntent !== "publish_both" && state.id && (
              <ActionForm action={publishSellerProductToWooCommerceAction} refreshAfterSuccess={false} savingText="در حال افزودن محصول به ووکامرس…" onSuccess={(result) => { if (result.detail?.startsWith("http")) window.open(result.detail, "_blank", "noopener,noreferrer"); }} className="publish-to-woo-form">
                <input type="hidden" name="productId" value={state.id} />
                <button type="submit"><ShoppingBag /> افزودن همین محصول به ووکامرس</button>
              </ActionForm>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
