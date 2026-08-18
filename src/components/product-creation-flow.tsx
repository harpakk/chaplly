/* eslint-disable @next/next/no-img-element -- DOM images are rasterized into product PNG files. */
"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronLeft,
  Layers3,
  ImagePlus,
  Package,
  Palette,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  saveSellerProductAction,
  type ActionResult,
} from "@/app/actions/dashboard";
import type {
  getDesignEditorData,
  getProductStartData,
} from "@/lib/dashboard-data";
import { SavingOverlay } from "@/components/saving-overlay";
import { WarpedArtwork } from "@/components/warped-artwork";
import {
  createPropertyPrices,
  expandPropertyPrices,
  VariantPropertyPricing,
} from "@/components/variant-property-pricing";
import { croppedArtworkImageStyle, hasManualArtworkCrop } from "@/lib/design-artwork-style";
import { SellerOnboardingTour, SellerTourReplayButton, type SellerTourStep } from "@/components/seller-onboarding-tour";
import type { SellerTourState } from "@/lib/seller-tour-shared";

type CreationData = Awaited<ReturnType<typeof getProductStartData>>;
type EditorData = Awaited<ReturnType<typeof getDesignEditorData>>;

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
                {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} width={72} height={72} unoptimized /> : <Palette />}
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
                      <Image
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
  const [backup, setBackup] = useState(
    draft?.backup_supplier_offer_id || "",
  );
  const [clientError, setClientError] = useState<null | {
    message: string;
    field?: string;
  }>(null);
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
  const savedVariantPrices = new Map(
    (draft?.variantPrices || []).map((item) => [item.rawProductVariantId, item.price]),
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
      minimumPrice: Math.ceil(supplierCost * 1.1),
      price: savedVariantPrices.get(id) || Math.max(1, Math.round(supplierCost * 1.3)),
      isSavedPrice: savedVariantPrices.has(id),
    }];
  });
  const [propertyPrices, setPropertyPrices] = useState(() => createPropertyPrices(pricingVariants));
  const variantPrices = expandPropertyPrices(pricingVariants, propertyPrices);
  const mockupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const errorAlert = useRef<HTMLDivElement>(null);
  const preparing = useRef(false);
  useEffect(() => {
    if (!pending && state.message) preparing.current = false;
  }, [pending, state.message]);
  useEffect(() => {
    if (pending || state.ok || !state.message) return;
    errorAlert.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstField = Object.keys(state.fieldErrors || {})[0];
    if (!firstField) return;
    const field = document.querySelector<HTMLElement>(`[name="${firstField}"]`);
    field?.focus({ preventScroll: true });
  }, [pending, state.fieldErrors, state.message, state.ok]);
  const showClientError = (message: string, field?: string) => {
    setClientError({ message, field });
    requestAnimationFrame(() => {
      errorAlert.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (!field) return;
      const input = document.querySelector<HTMLElement>(`[name="${field}"]`);
      input?.focus({ preventScroll: true });
    });
  };
  const fieldError = (name: string) =>
    clientError?.field === name
      ? clientError.message
      : state.fieldErrors?.[name];
  const prepareImages = async (event: React.FormEvent<HTMLFormElement>) => {
    if (preparing.current) return;
    event.preventDefault();
    // React only guarantees currentTarget while the event handler is running
    // synchronously. Rasterizing mockups awaits images/fonts, so retain the DOM
    // form before the first await and never read currentTarget afterward.
    const formElement = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
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
    if (!String(form.get("primarySupplierOfferId") || "")) {
      showClientError(
        "یک تأمین‌کننده اصلی برای تنوع‌های انتخاب‌شده انتخاب کنید.",
        "primarySupplierOfferId",
      );
      return;
    }
    const belowMinimumMargin = variantPrices.some((variant) => {
      const source = pricingVariants.find((item) => item.rawProductVariantId === variant.rawProductVariantId);
      return variant.price < Number(source?.minimumPrice || 0);
    });
    if (belowMinimumMargin) {
      showClientError(
        "قیمت فروش هر تنوع باید حداقل ۱۰ درصد بیشتر از هزینه تأمین باشد.",
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
    const transfer = new DataTransfer();
    const prepared: { key: string; file: File }[] = [];
    let failedRenders = 0;
    try {
      for (const id of visibleMockups) {
        const node = mockupRefs.current[id];
        if (node) {
          try {
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
            const background = images[0];
            const sourceWidth = background?.naturalWidth || node.offsetWidth;
            const targetWidth = Math.max(node.offsetWidth, sourceWidth);
            const ratio = node.offsetHeight / Math.max(1, node.offsetWidth);
            const blob = await toBlob(node, {
              pixelRatio: 1,
              canvasWidth: targetWidth,
              canvasHeight: Math.round(targetWidth * ratio),
              cacheBust: false,
              backgroundColor: "transparent",
              skipFonts: true,
              filter: (candidate) =>
                !candidate.classList?.contains("artwork-warp-raster-source") &&
                !candidate.classList?.contains("artwork-warp-loading"),
            });
            if (blob) {
              prepared.push({
                key: id,
                file: new File([blob], `mockup-${id}.png`, { type: "image/png" }),
              });
            } else {
              failedRenders += 1;
            }
          } catch (error) {
            failedRenders += 1;
            console.error(`Mockup rasterization failed for ${id}`, error);
          }
        }
      }
    } catch (error) {
      console.error("Mockup rasterization failed", error);
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
    if (!transfer.files.length) {
      showClientError(
        failedRenders
          ? "رندر موکاپ‌ها انجام نشد. یک تصویر دلخواه اضافه کنید یا موکاپ‌ها را دوباره انتخاب کنید."
          : "حداقل یک تصویر محصول لازم است.",
        "productImages",
      );
      return;
    }
    if (fileInput.current) fileInput.current.files = transfer.files;
    if (!formElement.isConnected) {
      showClientError(
        "فرم دیگر در صفحه فعال نیست؛ صفحه را تازه‌سازی و دوباره تلاش کنید.",
      );
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
            visible={pending}
            text="در حال ذخیره و آماده‌سازی محصول…"
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
                <p>{clientError?.message || state.message}</p>
                {!clientError && state.detail && (
                  <small>جزئیات خطا: {state.detail}</small>
                )}
                <span>اطلاعات واردشده حفظ شده؛ مورد بالا را اصلاح و دوباره تلاش کنید.</span>
              </div>
            </div>
          )}
          <section className="wizard-section product-image-section">
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
                        ref={(node) => {
                          mockupRefs.current[key] = node;
                        }}
                        className="configured-mockup-canvas product-render-canvas"
                      >
                        <div key={mockupView.id}>
                          <img
                            src={mockupView.backgroundUrl}
                            alt={mockup.name}
                          />
                          <WarpedArtwork
                            points={mockupView.perspective_points}
                            clip={mockupView.artwork_clip}
                            fabricTextureUrl={mockupView.backgroundUrl}
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
                                    <img
                                      src={String(object.src)}
                                      alt="طرح"
                                      data-manual-crop={hasManualArtworkCrop(object) ? "true" : undefined}
                                      style={croppedArtworkImageStyle(object)}
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
                  <img src={URL.createObjectURL(file)} alt={file.name} />
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
          </section>
          <section className="wizard-section">
            <span>معرفی محصول</span>
            <div className="wizard-fields">
              <label>
                عنوان رسمی
                <input
                  name="title"
                  required
                  minLength={3}
                  defaultValue={draft?.title || ""}
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
                value={
                  draft?.slug ||
                  `${raw?.slug || "product"}-${designId.slice(0, 8)}`
                }
              />
              <label className="wide">
                زیرعنوان کوتاه
                <input
                  name="subtitle"
                  defaultValue={draft?.subtitle || ""}
                />
              </label>
              <label className="wide">
                توضیحات کامل
                <textarea
                  name="description"
                  required
                  rows={6}
                  defaultValue={draft?.description || ""}
                  aria-invalid={Boolean(fieldError("description"))}
                />
                {fieldError("description") && (
                  <small className="field-error">
                    {fieldError("description")}
                  </small>
                )}
                <small>توضیح اختصاصی محصول و طراحی خودت را اضافه کن.</small>
              </label>
              <details className="wide graphic-style-picker">
                <summary>سبک‌های گرافیکی محصول را انتخاب کنید</summary>
                <div>
                  {data.graphicStyles.map((style) => (
                    <label key={style.id}>
                      <input
                        type="checkbox"
                        name="graphicStyleIds"
                        value={style.id}
                        defaultChecked={draft?.graphicStyleIds.includes(style.id)}
                      />
                      {style.imageUrl && <Image src={style.imageUrl} alt={style.name} width={52} height={52} unoptimized />}
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
              </details>
            </div>
            <VariantPropertyPricing
              variants={pricingVariants}
              value={propertyPrices}
              onChange={setPropertyPrices}
            />
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
            <h2>اصلی و پشتیبان را انتخاب کن</h2>
            {eligible.length ? (
              <div className="final-suppliers">
                <label>
                  تأمین‌کننده اصلی
                  <select
                    name="primarySupplierOfferId"
                    value={primary}
                    onChange={(event) => {
                      const nextPrimary = event.target.value;
                      setPrimary(nextPrimary);
                      if (backup === nextPrimary) setBackup("");
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
                <label>
                  تأمین‌کننده پشتیبان
                  <select
                    name="backupSupplierOfferId"
                    value={backup}
                    onChange={(event) => setBackup(event.target.value)}
                    aria-invalid={Boolean(
                      fieldError("backupSupplierOfferId"),
                    )}
                  >
                    <option value="">بدون پشتیبان</option>
                    {eligible
                      .filter((offer) => offer.id !== primary)
                      .map((offer) => (
                        <option value={offer.id} key={offer.id}>
                          {offer.organization?.display_name}
                        </option>
                      ))}
                  </select>
                  {fieldError("backupSupplierOfferId") && (
                    <small className="field-error">
                      {fieldError("backupSupplierOfferId")}
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
      {state.ok && (
        <div className="publish-success">
          <div>
            <span>🎉</span>
            <small>اطلاعات با موفقیت ذخیره شد</small>
            <h2>{state.message}</h2>
            <p>محصول در داشبورد و صف بررسی قابل مشاهده است.</p>
            <Link href="/seller/dashboard?section=products">
              بازگشت به محصولات <ChevronLeft />
            </Link>
            <BadgeCheck />
          </div>
        </div>
      )}
    </div>
  );
}
