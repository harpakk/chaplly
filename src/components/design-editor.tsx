"use client";

import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/estedad/400.css";
import "@fontsource/estedad/700.css";
import { ResilientImg } from "@/components/resilient-image";
import {
  ChangeEvent,
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  Crop,
  FolderOpen,
  ImageIcon,
  Keyboard,
  Layers3,
  Lock,
  MousePointer2,
  Move,
  Package,
  Palette,
  Redo2,
  RotateCw,
  Save,
  Search,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  saveDesignDraftAction,
  saveDesignMockupSelectionAction,
  uploadDesignAssetAction,
} from "@/app/actions/dashboard";
import type { getDesignEditorData } from "@/lib/dashboard-data";
import { SavingOverlay } from "@/components/saving-overlay";
import { SellerOnboardingTour, SellerTourReplayButton, type SellerTourStep } from "@/components/seller-onboarding-tour";
import type { SellerTourState } from "@/lib/seller-tour-shared";
import { WarpedArtwork } from "@/components/warped-artwork";
import { croppedArtworkImageStyle, hasManualArtworkCrop } from "@/lib/design-artwork-style";

type EditorData = Awaited<ReturnType<typeof getDesignEditorData>>;
type ObjectItem = {
  id: string;
  kind: "text" | "shape" | "image";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  text?: string;
  src?: string;
  storageFileId?: string;
  fontSize: number;
  fontFamily?: string;
  opacity?: number;
  saturation?: number;
  cropScale?: number;
  cropX?: number;
  cropY?: number;
  cropLeft?: number;
  cropTop?: number;
  cropWidth?: number;
  cropHeight?: number;
  imageAspect?: number;
  rotation?: number;
  locked: boolean;
};

async function downloadDesignAsset(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download_failed");
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const designTourSteps: SellerTourStep[] = [
  { target: '[data-tour="design-tools"]', emoji: "🧰", title: "ابزارهای ساده، نتیجه حرفه‌ای", body: "تصویر خودت را آپلود کن، متن بنویس یا از طرح‌های آماده استفاده کن. برای شروع همین سه ابزار کافیه." },
  { target: '[data-tour="free-designs"]', emoji: "🎁", title: "طرح رایگان هم داریم", body: "اگر فایل آماده نداری، اینجا کلی طرح آماده هست که با یک کلیک روی محصول می‌شینه." },
  { target: '[data-tour="design-canvas"]', emoji: "🖼️", title: "این کادر محدوده چاپ است", body: "هر چیزی داخل کادر خط‌چین باشه چاپ می‌شه. طرح را بگیر و داخل همین محدوده جابه‌جا کن." },
  { target: '[data-tour="design-canvas"]', emoji: "🤏", title: "اندازه و چرخش با خودت", body: "طرح را انتخاب کن؛ گوشه‌ها برای تغییر اندازه و دستگیره بالایی برای چرخاندنه." },
  { target: '[data-tour="design-variants"]', emoji: "🎨", title: "جلو، پشت و رنگ‌ها", body: "پایین صفحه نما و رنگ محصول را عوض کن تا مطمئن شی طرحت روی همه حالت‌ها عالیه." },
  { target: '[data-tour="layers"]', emoji: "🥞", title: "لایه‌ها نظم می‌دن", body: "از اینجا متن و تصویرها را دوباره انتخاب، مرتب یا قفل کن؛ مثل ورق‌های روی هم." },
  { target: '[data-tour="top-tools"]', emoji: "🪄", title: "ابزار دقیق همین بالاست", body: "وقتی یک طرح یا متن را انتخاب کنی، شفافیت، برش، چرخش و ترتیب لایه‌ها همین بالا ظاهر می‌شه." },
  { target: '[data-tour="design-continue"]', emoji: "✅", title: "ادامه یعنی ذخیره امن", body: "ادامه را بزن؛ بعد تأمین‌کننده، رنگ و سایزهای قابل طراحی و در آخر موکاپ را انتخاب می‌کنی.", hint: "پیش‌نویست در مسیر ذخیره می‌شه؛ با خیال راحت جلو برو." },
];

export function DesignEditor({ data, tourState, productId }: { data: EditorData; tourState: SellerTourState; productId?: string }) {
  const raw = data.rawProducts[0],
    existing = data.design;
  const initialColorId =
    raw.colors.find(
      (color) =>
        color.name.trim() === "سفید" ||
        ["#fff", "#ffffff"].includes((color.hex || "").toLowerCase()),
    )?.id || raw.colors[0]?.id || "";
  const initialObjects = Object.fromEntries(
    raw.views.flatMap((view) =>
      raw.colors.map((color) => {
        const document = existing?.views.find(
          (item) => item.raw_product_view_id === view.id,
        )?.canvas_document as
          | { objects?: ObjectItem[]; colorObjects?: Record<string, ObjectItem[]> }
          | undefined;
        return [
          `${view.id}:${color.id}`,
          (
            document?.colorObjects?.[color.id]?.length
              ? document.colorObjects[color.id]
              : document?.objects || []
          ).map((object) =>
        object.kind === "image" && object.storageFileId
          ? {
              ...object,
              src:
                [
                  ...data.uploads,
                  ...data.freeDesigns.map((file) => ({
                    id: file.file_id,
                    url: file.url,
                  })),
                ].find((file) => file.id === object.storageFileId)?.url ||
                object.src,
            }
          : object,
          ),
        ];
      }),
    ),
  );
  const [objects, setObjects] =
    useState<Record<string, ObjectItem[]>>(initialObjects);
  const [localCanvasReady, setLocalCanvasReady] = useState(false);
  const [viewId, setViewId] = useState(raw.views[0]?.id || "");
  const [colorId, setColorId] = useState(initialColorId);
  const [sharedColorId] = useState(initialColorId);
  const initialColorSettings = existing?.views[0]?.canvas_document as
    | { independentColorIds?: string[] }
    | undefined;
  const [independentColorIds, setIndependentColorIds] = useState<string[]>(
    initialColorSettings?.independentColorIds || [],
  );
  const [reviewedSharedColorIds, setReviewedSharedColorIds] = useState<string[]>([
    initialColorId,
  ]);
  const [backgroundAspectRatio, setBackgroundAspectRatio] = useState(1.25);
  const [selected, setSelected] = useState<string | null>(null),
    [zoom, setZoom] = useState(140),
    [designId, setDesignId] = useState(existing?.id || ""),
    [designName] = useState(
      () =>
        existing?.name ||
        `طرح-${raw.id.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`,
    ),
    [panel, setPanel] = useState<"layers" | "files" | "free" | null>(null),
    [cropOpen, setCropOpen] = useState(false),
    [uploads, setUploads] = useState(data.uploads),
    [tool, setTool] = useState<"select" | "pan">("select"),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [undoByView, setUndoByView] = useState<Record<string, ObjectItem[][]>>({}),
    [redoByView, setRedoByView] = useState<Record<string, ObjectItem[][]>>({});
  const [cropDraft, setCropDraft] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [cropImageAspect, setCropImageAspect] = useState(1);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [freeVisibleCount, setFreeVisibleCount] = useState(10);
  const [freeSearch, setFreeSearch] = useState("");
  const [freeStyle, setFreeStyle] = useState("ALL");
  const [freeAccess, setFreeAccess] = useState("ALL");
  const [freeSort, setFreeSort] = useState("DEFAULT");
  const [selectedVariants, setSelectedVariants] = useState<string[]>(
    existing?.variantIds || [],
  );
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>(() => [...new Set(raw.variants.filter(variant=>(existing?.variantIds||[]).includes(variant.id)).map(variant=>variant.color_id))]);
  const [selectedSizeIds, setSelectedSizeIds] = useState<string[]>(() => [...new Set(raw.variants.filter(variant=>(existing?.variantIds||[]).includes(variant.id)).map(variant=>variant.size_id))]);
  const [variantStep, setVariantStep] = useState<"colors"|"sizes">("colors");
  const [selectedSupplierOfferId, setSelectedSupplierOfferId] = useState(
    () =>
      data.suppliers.find(
        (offer) =>
          offer.id === data.productDraft?.primary_supplier_offer_id &&
          offer.raw_product_id === raw.id &&
          offer.variants.length > 0,
      )?.id ||
      data.suppliers.find(
        (offer) => offer.raw_product_id === raw.id && offer.variants.length > 0,
      )?.id ||
      "",
  );
  const selectedSupplier = data.suppliers.find(
    (offer) => offer.id === selectedSupplierOfferId,
  );
  const supplierVariantIds = new Set(
    selectedSupplier?.variants.map(
      (variant) => variant.raw_product_variant_id,
    ) || [],
  );
  const availableVariants = raw.variants.filter((variant) => supplierVariantIds.has(variant.id));
  const availableColorIds = raw.colors
    .filter((color) =>
      availableVariants.some((variant) => variant.color_id === color.id),
    )
    .map((color) => color.id);
  const availableSizeIds = raw.sizes
    .filter((size) =>
      availableVariants.some(
        (variant) =>
          selectedColorIds.includes(variant.color_id) &&
          variant.size_id === size.id,
      ),
    )
    .map((size) => size.id);
  const syncVariants = (colors:string[],sizes:string[]) => {
    setSelectedColorIds(colors); setSelectedSizeIds(sizes);
    setSelectedVariants(availableVariants.filter(variant=>colors.includes(variant.color_id)&&sizes.includes(variant.size_id)).map(variant=>variant.id));
  };
  const [saveState, setSaveState] = useState("ذخیره خودکار آماده"),
    [phase, setPhase] = useState<
      "design" | "supplier" | "variants" | "mockups" | "review"
    >("design"),
    [selectedMockups, setSelectedMockups] = useState<string[]>(
      data.selectedMockupIds || [],
    ),
    [mockupSideFilter, setMockupSideFilter] = useState("ALL"),
    [mockupColorFilter, setMockupColorFilter] = useState("ALL"),
    [chatGuideOpen, setChatGuideOpen] = useState(false),
    [fileDragActive, setFileDragActive] = useState(false),
    [blockingSave, setBlockingSave] = useState(""),
    [pendingUploads, setPendingUploads] = useState(0),
    [retryNotice, setRetryNotice] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null),
    copiedObject = useRef<ObjectItem | null>(null),
    saving = useRef(false);
  useEffect(() => {
    if (existing) {
      setLocalCanvasReady(true);
      return;
    }
    try {
      const saved = localStorage.getItem(`chapli-design-canvas:new:${raw.id}`);
      if (saved) setObjects(JSON.parse(saved) as Record<string, ObjectItem[]>);
      const savedColorSettings = localStorage.getItem(`chapli-design-colors:new:${raw.id}`);
      if (savedColorSettings) {
        const parsed = JSON.parse(savedColorSettings) as {
          independent?: string[];
          reviewedShared?: string[];
        };
        if (Array.isArray(parsed.independent)) setIndependentColorIds(parsed.independent);
        if (Array.isArray(parsed.reviewedShared)) setReviewedSharedColorIds(parsed.reviewedShared);
      }
    } catch {
      localStorage.removeItem(`chapli-design-canvas:new:${raw.id}`);
      localStorage.removeItem(`chapli-design-colors:new:${raw.id}`);
    } finally {
      setLocalCanvasReady(true);
    }
  }, [existing, raw.id]);
  useEffect(() => {
    if (!localCanvasReady || existing) return;
    localStorage.setItem(
      `chapli-design-canvas:new:${raw.id}`,
      JSON.stringify(objects),
    );
  }, [existing, localCanvasReady, objects, raw.id]);
  useEffect(() => {
    if (!localCanvasReady || existing) return;
    localStorage.setItem(
      `chapli-design-colors:new:${raw.id}`,
      JSON.stringify({
        independent: independentColorIds,
        reviewedShared: reviewedSharedColorIds,
      }),
    );
  }, [existing, independentColorIds, localCanvasReady, raw.id, reviewedSharedColorIds]);
  const designColorId = independentColorIds.includes(colorId)
    ? colorId
    : sharedColorId;
  const activeKey = `${viewId}:${designColorId}`;
  const active = objects[activeKey] || [];
  const selectedVariantColorIds = new Set(
    raw.variants
      .filter((variant) => selectedVariants.includes(variant.id))
      .map((variant) => variant.color_id),
  );
  const eligibleMockupIds = new Set(
    data.mockups
      .filter(
        (mockup) =>
          mockup.raw_product_id === raw.id &&
          Boolean(mockup.color_id) &&
          selectedVariantColorIds.has(String(mockup.color_id)),
      )
      .map((mockup) => mockup.id),
  );
  const eligibleMockupSignature = [...eligibleMockupIds].sort().join(":");
  useEffect(() => {
    setSelectedMockups((current) =>
      current.filter((mockupId) => eligibleMockupIds.has(mockupId)),
    );
  }, [eligibleMockupSignature]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredMockups = data.mockups.filter(
    (mockup) => {
      return (
        mockup.raw_product_id === raw.id &&
        Boolean(mockup.color_id) &&
        selectedVariantColorIds.has(String(mockup.color_id)) &&
        (mockupColorFilter === "ALL" || mockup.color_id === mockupColorFilter) &&
        (mockupSideFilter === "ALL" || mockup.side === mockupSideFilter)
      );
    },
  );
  const item = active.find((entry) => entry.id === selected);
  const currentVariant =
    raw.variants.find((variant) => variant.color_id === colorId) ||
    raw.variants[0];
  const activeView = raw.views.find((view) => view.id === viewId);
  const currentAsset =
    data.assets.find(
      (asset) =>
        asset.raw_product_variant_id === currentVariant?.id &&
        asset.raw_product_view_id === viewId,
    ) || data.assets.find((asset) => asset.raw_product_view_id === viewId);
  const background = activeView?.backgroundUrl || currentAsset?.backgroundUrl,
    overlay = activeView?.overlayUrl || currentAsset?.overlayUrl;
  const printAreaAspect =
    backgroundAspectRatio *
    (Number(activeView?.print_area_width || 0.4) /
      Number(activeView?.print_area_height || 0.55));
  useEffect(() => {
    setObjects((current) => {
      let changed = false;
      const next = (current[activeKey] || []).map((entry) => {
        if (entry.kind !== "image" || !entry.imageAspect) return entry;
        const visibleAspect =
          entry.imageAspect *
          ((entry.cropWidth ?? 100) / Math.max(1, entry.cropHeight ?? 100));
        const height = Math.max(
          3,
          Math.min(2000, (entry.w * printAreaAspect) / visibleAspect),
        );
        if (Math.abs(entry.h - height) < 0.01) return entry;
        changed = true;
        return { ...entry, h: height };
      });
      return changed ? { ...current, [activeKey]: next } : current;
    });
  }, [activeKey, printAreaAspect]);
  const freeStyles = useMemo(
    () => [...new Set(data.freeDesigns.map((file) => file.style_name).filter(Boolean))],
    [data.freeDesigns],
  );
  const filteredFreeDesigns = useMemo(() => {
    const search = freeSearch.trim().toLocaleLowerCase("fa");
    const result = data.freeDesigns.filter(
      (file) =>
        (!search ||
          file.title.toLocaleLowerCase("fa").includes(search) ||
          file.style_name.toLocaleLowerCase("fa").includes(search)) &&
        (freeStyle === "ALL" || file.style_name === freeStyle) &&
        (freeAccess === "ALL" ||
          (freeAccess === "FREE" ? !file.is_premium : file.is_premium)),
    );
    if (freeSort === "TITLE")
      return [...result].sort((a, b) => a.title.localeCompare(b.title, "fa"));
    if (freeSort === "STYLE")
      return [...result].sort((a, b) =>
        a.style_name.localeCompare(b.style_name, "fa"),
      );
    return result;
  }, [data.freeDesigns, freeAccess, freeSearch, freeSort, freeStyle]);
  useEffect(() => setFreeVisibleCount(10), [freeAccess, freeSearch, freeSort, freeStyle]);
  const canvasViews = useMemo(
    () =>
      raw.views.map((view) => ({
        rawProductViewId: view.id,
        canvas: {
          version: 2,
          objects: objects[`${view.id}:${sharedColorId}`] || [],
          independentColorIds,
          colorObjects: Object.fromEntries(
            raw.colors.map((color) => [
              color.id,
              independentColorIds.includes(color.id)
                ? objects[`${view.id}:${color.id}`] || []
                : objects[`${view.id}:${sharedColorId}`] || [],
            ]),
          ),
        },
      })),
    [independentColorIds, objects, raw.colors, raw.views, sharedColorId],
  );
  const latestDraft = useRef({
    name: designName,
    views: canvasViews,
    variantIds: selectedVariants,
  });
  latestDraft.current = { name: designName, views: canvasViews, variantIds: selectedVariants };
  const designIdRef = useRef(existing?.id || "");
  const uploadTasks = useRef<Set<Promise<void>>>(new Set());
  const changeRevision = useRef(0);
  const savedRevision = useRef(0);
  const activeSave = useRef<Promise<string> | null>(null);
  const persist = useCallback(async () => {
    if (activeSave.current) return activeSave.current;
    const task = (async () => {
      saving.current = true;
      let savedId = designIdRef.current;
      try {
        do {
          const targetRevision = changeRevision.current;
          const payload = latestDraft.current;
          setSaveState("در حال ذخیره در فضای ابری…");
          const result = await saveDesignDraftAction({
            designId: designIdRef.current || undefined,
            rawProductId: raw.id,
            name: payload.name,
            views: payload.views,
            variantIds: payload.variantIds,
          });
          if (!result.ok || !result.id) {
            setSaveState(result.message);
            return "";
          }
          savedId = result.id;
          designIdRef.current = result.id;
          setDesignId(result.id);
          const currentUrl = new URL(window.location.href);
          if (currentUrl.searchParams.get("design") !== result.id) {
            currentUrl.searchParams.set("design", result.id);
            window.history.replaceState(window.history.state, "", currentUrl);
          }
          savedRevision.current = targetRevision;
          localStorage.removeItem(`chapli-design-canvas:new:${raw.id}`);
          localStorage.removeItem(`chapli-design-colors:new:${raw.id}`);
        } while (savedRevision.current < changeRevision.current);
        setSaveState("همه تغییرات در فضای ابری ذخیره شد");
        return savedId;
      } catch (error) {
        console.error("Design save failed", error);
        setSaveState("ذخیره طراحی ناموفق بود؛ اینترنت را بررسی و دوباره تلاش کنید.");
        return "";
      } finally {
        saving.current = false;
        activeSave.current = null;
      }
    })();
    activeSave.current = task;
    return task;
  }, [raw.id]);
  useEffect(() => {
    if (!localCanvasReady) return;
    changeRevision.current += 1;
    setSaveState("تغییر جدید؛ در صف ذخیره خودکار");
    const timer = setTimeout(() => void persist(), 900);
    return () => clearTimeout(timer);
  }, [canvasViews, designName, localCanvasReady, persist, selectedVariants]);
  useEffect(() => {
    const sendLastDraft = () => {
      if (
        !designIdRef.current ||
        savedRevision.current >= changeRevision.current ||
        typeof navigator.sendBeacon !== "function"
      ) return;
      const payload = latestDraft.current;
      navigator.sendBeacon(
        "/api/seller/designs/autosave",
        new Blob([
          JSON.stringify({
            designId: designIdRef.current,
            rawProductId: raw.id,
            name: payload.name,
            views: payload.views,
            variantIds: payload.variantIds,
          }),
        ], { type: "application/json" }),
      );
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") sendLastDraft();
    };
    window.addEventListener("pagehide", sendLastDraft);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", sendLastDraft);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [raw.id]);
  const commit = (next: ObjectItem[], record = true) => {
    if (record) {
      setUndoByView((current) => ({
        ...current,
        [activeKey]: [...(current[activeKey] || []), active].slice(-50),
      }));
      setRedoByView((current) => ({ ...current, [activeKey]: [] }));
    }
    setObjects((current) => ({ ...current, [activeKey]: next }));
  };
  const undo = () => {
    const history = undoByView[activeKey] || [];
    const previous = history.at(-1);
    if (!previous) return;
    setUndoByView((current) => ({
      ...current,
      [activeKey]: history.slice(0, -1),
    }));
    setRedoByView((current) => ({
      ...current,
      [activeKey]: [...(current[activeKey] || []), active],
    }));
    commit(previous, false);
    setSelected(null);
  };
  const redo = () => {
    const history = redoByView[activeKey] || [];
    const next = history.at(-1);
    if (!next) return;
    setRedoByView((current) => ({
      ...current,
      [activeKey]: history.slice(0, -1),
    }));
    setUndoByView((current) => ({
      ...current,
      [activeKey]: [...(current[activeKey] || []), active],
    }));
    commit(next, false);
    setSelected(null);
  };
  const add = (kind: ObjectItem["kind"], extra: Partial<ObjectItem> = {}) => {
    const next: ObjectItem = {
      id: crypto.randomUUID(),
      kind,
      x: 34,
      y: 34,
      w: kind === "text" ? 38 : 28,
      h: kind === "text" ? 14 : 28,
      color: "#201d2b",
      text: kind === "text" ? "متن قشنگت اینجا" : undefined,
      fontSize: 20,
      opacity: 100,
      saturation: 100,
      cropScale: 100,
      cropX: 50,
      cropY: 50,
      locked: false,
      ...extra,
    };
    commit([...active, next]);
    setSelected(next.id);
    return next.id;
  };
  const update = (patch: Partial<ObjectItem>) =>
    item &&
    commit(
      active.map((entry) =>
        entry.id === item.id ? { ...entry, ...patch } : entry,
      ),
    );
  const duplicate = (target = item) => {
    if (!target) return;
    const { id: _id, ...copy } = target;
    void _id;
    add(target.kind, { ...copy, x: target.x + 3, y: target.y + 3 });
  };
  const copySelection = () => {
    if (item) copiedObject.current = { ...item };
  };
  const pasteSelection = () => {
    if (!copiedObject.current) return;
    const copy = copiedObject.current;
    add(copy.kind, { ...copy, x: copy.x + 3, y: copy.y + 3 });
  };
  const syncImageAspect = (
    targetId: string,
    naturalWidth: number,
    naturalHeight: number,
  ) => {
    if (!naturalWidth || !naturalHeight) return;
    const imageAspect = naturalWidth / naturalHeight;
    setObjects((current) => ({
      ...current,
      [activeKey]: (current[activeKey] || []).map((entry) => {
        if (entry.id !== targetId || entry.kind !== "image") return entry;
        const visibleAspect =
          imageAspect *
          ((entry.cropWidth ?? 100) / Math.max(1, entry.cropHeight ?? 100));
        const height = Math.max(
          3,
          Math.min(2000, (entry.w * printAreaAspect) / visibleAspect),
        );
        if (
          Math.abs((entry.imageAspect || 0) - imageAspect) < 0.0001 &&
          Math.abs(entry.h - height) < 0.01
        )
          return entry;
        return { ...entry, imageAspect, h: height };
      }),
    }));
  };
  const remove = () => {
    if (item) {
      commit(active.filter((entry) => entry.id !== item.id));
      setSelected(null);
    }
  };
  const moveLayer = (direction: "up" | "down") => {
    if (!item) return;
    const index = active.findIndex((entry) => entry.id === item.id);
    const target = direction === "up" ? index + 1 : index - 1;
    if (target < 0 || target >= active.length) return;
    const next = [...active];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };
  const scaleImage = (factor: number) => {
    if (!item || item.kind !== "image") return;
    const ratio = item.h / item.w;
    const width = Math.max(3, Math.min(2000, item.w * factor));
    const height = Math.max(3, Math.min(2000, width * ratio));
    update({ w: width, h: height });
  };
  const rotateBy = (degrees: number) =>
    item && update({ rotation: ((item.rotation || 0) + degrees) % 360 });
  const chooseCanvasColor = (nextColorId: string) => {
    if (nextColorId === colorId) return;
    if (
      independentColorIds.includes(nextColorId) ||
      reviewedSharedColorIds.includes(nextColorId)
    ) {
      setColorId(nextColorId);
      setSelected(null);
      return;
    }
    const colorName = raw.colors.find((color) => color.id === nextColorId)?.name || "این رنگ";
    const separate = window.confirm(
      `برای «${colorName}» طرح جداگانه می‌خواهی؟\n\nتأیید: یک نسخه مستقل برای جلو و پشت این رنگ ساخته می‌شود.\nلغو: همین طرح فعلی برای این رنگ و سایر رنگ‌ها استفاده می‌شود.`,
    );
    if (separate) {
      setObjects((current) => {
        const next = { ...current };
        for (const view of raw.views) {
          const sourceColor = independentColorIds.includes(colorId)
            ? colorId
            : sharedColorId;
          const source = current[`${view.id}:${sourceColor}`] || [];
          next[`${view.id}:${nextColorId}`] = source.map((entry) => ({ ...entry }));
        }
        return next;
      });
      setIndependentColorIds((current) => [...new Set([...current, nextColorId])]);
    } else {
      setReviewedSharedColorIds((current) => [...new Set([...current, nextColorId])]);
    }
    setColorId(nextColorId);
    setSelected(null);
  };
  const openCropEditor = (target: ObjectItem) => {
    const width = target.cropWidth ?? Math.min(100, 10000 / (target.cropScale ?? 100));
    const height = target.cropHeight ?? Math.min(100, 10000 / (target.cropScale ?? 100));
    setCropDraft({
      x: target.cropLeft ?? Math.max(0, Math.min(100 - width, (target.cropX ?? 50) - width / 2)),
      y: target.cropTop ?? Math.max(0, Math.min(100 - height, (target.cropY ?? 50) - height / 2)),
      width,
      height,
    });
    setCropOpen(true);
  };
  const applyCrop = () => {
    if (!item || item.kind !== "image") return;
    const croppedAspect = Math.max(
      0.05,
      cropImageAspect * (cropDraft.width / cropDraft.height),
    );
    update({
      cropLeft: cropDraft.x,
      cropTop: cropDraft.y,
      cropWidth: cropDraft.width,
      cropHeight: cropDraft.height,
      cropScale: 100,
      cropX: 50,
      cropY: 50,
      imageAspect: cropImageAspect,
      h: Math.max(3, Math.min(2000, (item.w * printAreaAspect) / croppedAspect)),
    });
    setCropOpen(false);
  };
  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setSaveState("فقط فایل تصویری را روی بوم رها کنید.");
      return;
    }
    const temporaryUrl = URL.createObjectURL(file);
    const objectId = add("image", {
      src: temporaryUrl,
      color: "transparent",
      w: 36,
      h: 36,
    });
    const form = new FormData();
    form.set("file", file);
    setPendingUploads((value) => value + 1);
    setSaveState("تصویر اضافه شد؛ در حال آپلود…");
    try {
      const result = await uploadDesignAssetAction(form);
      if (result.ok && result.url && result.fileId) {
        const uploadedFileId = result.fileId;
        setObjects((current) => ({
          ...current,
          [activeKey]: (current[activeKey] || []).map((entry) =>
            entry.id === objectId
              ? {
                  ...entry,
                  src: result.url,
                  storageFileId: uploadedFileId,
                }
              : entry,
          ),
        }));
        setUploads((current) => [
          {
            id: uploadedFileId,
            name: file.name,
            url: result.url!,
          },
          ...current.filter((item) => item.id !== uploadedFileId),
        ]);
        URL.revokeObjectURL(temporaryUrl);
        setSaveState("تصویر آپلود و ذخیره شد");
      } else {
        setObjects((current) => ({ ...current, [activeKey]: (current[activeKey] || []).filter((entry) => entry.id !== objectId) }));
        URL.revokeObjectURL(temporaryUrl);
        setSaveState(`آپلود تصویر انجام نشد: ${result.message}`);
      }
    } catch {
      setObjects((current) => ({ ...current, [activeKey]: (current[activeKey] || []).filter((entry) => entry.id !== objectId) }));
      URL.revokeObjectURL(temporaryUrl);
      setSaveState("آپلود تصویر ناموفق بود و تصویر اضافه نشد؛ دوباره تلاش کنید.");
    } finally {
      setPendingUploads((value) => Math.max(0, value - 1));
    }
  };
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      const task = uploadFile(file);
      uploadTasks.current.add(task);
      void task.finally(() => uploadTasks.current.delete(task));
    }
  };
  const dropOnCanvas = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    setFileDragActive(false);
    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
    if (file) {
      const task = uploadFile(file);
      uploadTasks.current.add(task);
      void task.finally(() => uploadTasks.current.delete(task));
    }
    else setSaveState("فایل رهاشده تصویر نیست؛ PNG، JPG یا WEBP انتخاب کنید.");
  };
  const drag = (
    event: ReactPointerEvent<HTMLDivElement>,
    target: ObjectItem,
  ) => {
    if (tool !== "select") return;
    event.preventDefault();
    event.stopPropagation();
    setSelected(target.id);
    if (target.locked) return;
    setUndoByView((current) => ({
      ...current,
      [activeKey]: [...(current[activeKey] || []), active].slice(-50),
    }));
    setRedoByView((current) => ({ ...current, [activeKey]: [] }));
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.parentElement!.getBoundingClientRect(),
      sx = event.clientX,
      sy = event.clientY,
      ox = target.x,
      oy = target.y;
    const move = (next: PointerEvent) =>
      setObjects((current) => ({
        ...current,
        [activeKey]: (current[activeKey] || []).map((entry) =>
          entry.id === target.id
            ? {
                ...entry,
                x: ox + ((next.clientX - sx) / box.width) * 100,
                y: oy + ((next.clientY - sy) / box.height) * 100,
              }
            : entry,
        ),
      }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const resize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    target: ObjectItem,
    corner: "northWest" | "northEast" | "southEast" | "southWest",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const box =
      event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (!box) return;
    setUndoByView((current) => ({
      ...current,
      [activeKey]: [...(current[activeKey] || []), active].slice(-50),
    }));
    setRedoByView((current) => ({ ...current, [activeKey]: [] }));
    const startX = event.clientX,
      startY = event.clientY,
      startObjectX = target.x,
      startObjectY = target.y,
      startW = target.w,
      startH = target.h;
    const move = (next: PointerEvent) => {
      const dx = ((next.clientX - startX) / box.width) * 100;
      const dy = ((next.clientY - startY) / box.height) * 100;
      const horizontal = corner.endsWith("East") ? dx / startW : -dx / startW;
      const vertical = corner.startsWith("south") ? dy / startH : -dy / startH;
      const requestedScale = 1 + (horizontal + vertical) / 2;
      const minimumScale = Math.max(3 / startW, 3 / startH);
      const maximumScale = Math.min(2000 / startW, 2000 / startH);
      const scale = Math.max(
        minimumScale,
        Math.min(maximumScale, requestedScale),
      );
      setObjects((current) => ({
        ...current,
        [activeKey]: (current[activeKey] || []).map((entry) =>
          entry.id === target.id
              ? {
                ...entry,
                w: startW * scale,
                h: startH * scale,
                x: corner.endsWith("West")
                  ? startObjectX + startW - startW * scale
                  : startObjectX,
                y: corner.startsWith("north")
                  ? startObjectY + startH - startH * scale
                  : startObjectY,
              }
            : entry,
        ),
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const panStage = (event: ReactPointerEvent<HTMLElement>) => {
    if (tool !== "pan") return;
    event.preventDefault();
    const startX = event.clientX,
      startY = event.clientY,
      origin = pan;
    const move = (next: PointerEvent) =>
      setPan({
        x: origin.x + next.clientX - startX,
        y: origin.y + next.clientY - startY,
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const manipulateCrop = (
    event: ReactPointerEvent<HTMLElement>,
    mode:
      | "move"
      | "north"
      | "northEast"
      | "east"
      | "southEast"
      | "south"
      | "southWest"
      | "west"
      | "northWest",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const stage = event.currentTarget.closest(".manual-crop-stage") as HTMLElement | null;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...cropDraft };
    const move = (next: PointerEvent) => {
      const dx = ((next.clientX - startX) / bounds.width) * 100;
      const dy = ((next.clientY - startY) / bounds.height) * 100;
      if (mode === "move") {
        setCropDraft({
          ...origin,
          x: Math.max(0, Math.min(100 - origin.width, origin.x + dx)),
          y: Math.max(0, Math.min(100 - origin.height, origin.y + dy)),
        });
      } else {
        let left = origin.x;
        let top = origin.y;
        let right = origin.x + origin.width;
        let bottom = origin.y + origin.height;
        if (mode.includes("West") || mode === "west")
          left = Math.max(0, Math.min(right - 8, origin.x + dx));
        if (mode.includes("East") || mode === "east")
          right = Math.min(100, Math.max(left + 8, right + dx));
        if (mode.startsWith("north"))
          top = Math.max(0, Math.min(bottom - 8, origin.y + dy));
        if (mode.startsWith("south"))
          bottom = Math.min(100, Math.max(top + 8, bottom + dy));
        setCropDraft({ x: left, y: top, width: right - left, height: bottom - top });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const rotate = (
    event: ReactPointerEvent<HTMLButtonElement>,
    target: ObjectItem,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const object = event.currentTarget.parentElement;
    if (!object || target.locked) return;
    const bounds = object.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const startPointerAngle = Math.atan2(
      event.clientY - centerY,
      event.clientX - centerX,
    );
    const startRotation = target.rotation || 0;
    setUndoByView((current) => ({
      ...current,
      [activeKey]: [...(current[activeKey] || []), active].slice(-50),
    }));
    setRedoByView((current) => ({ ...current, [activeKey]: [] }));
    const move = (next: PointerEvent) => {
      const angle = Math.atan2(next.clientY - centerY, next.clientX - centerX);
      let degrees = startRotation + ((angle - startPointerAngle) * 180) / Math.PI;
      if (next.shiftKey) degrees = Math.round(degrees / 15) * 15;
      setObjects((current) => ({
        ...current,
        [activeKey]: (current[activeKey] || []).map((entry) =>
          entry.id === target.id ? { ...entry, rotation: degrees } : entry,
        ),
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (editing) return;
      if (command && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (command && key === "y") {
        event.preventDefault();
        redo();
      } else if (command && (key === "d" || key === "j")) {
        event.preventDefault();
        duplicate();
      } else if (command && key === "c") {
        event.preventDefault();
        copySelection();
      } else if (command && key === "v") {
        event.preventDefault();
        pasteSelection();
      } else if (command && key === "t" && item?.kind === "image") {
        event.preventDefault();
        openCropEditor(item);
      } else if (command && key === "r" && item) {
        event.preventDefault();
        rotateBy(event.shiftKey ? -15 : 15);
      } else if (command && event.key === "]") {
        event.preventDefault();
        moveLayer("up");
      } else if (command && event.key === "[") {
        event.preventDefault();
        moveLayer("down");
      } else if (event.key === "Escape") {
        setCropOpen(false);
        setShortcutsOpen(false);
        setSelected(null);
      } else if (item && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 5 : 0.5;
        update({
          x: item.x + (event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0),
          y: item.y + (event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0),
        });
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((value) => Math.min(250, value + 10));
      } else if (event.key === "-") {
        event.preventDefault();
        setZoom((value) => Math.max(30, value - 10));
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        remove();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  });
  const continueFromDesign = async () => {
    setBlockingSave(pendingUploads ? "در حال تکمیل آپلود تصویر…" : "در حال ذخیره طراحی…");
    try {
      if (uploadTasks.current.size) await Promise.all([...uploadTasks.current]);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const id = await persist();
      if (!id) {
        setSaveState("ذخیره طراحی انجام نشد؛ تا ذخیره موفق نمی‌توانید ادامه دهید.");
        return;
      }
      setPhase("supplier");
    } finally {
      setBlockingSave("");
    }
  };
  const finish = async () => {
    setRetryNotice(false);
    if (productId && !window.confirm(
      "با ادامه، رنگ‌ها و سایزهای انتخاب‌شده برای همین محصول ذخیره می‌شوند. پس از تأیید نهایی در مرحله بعد، همه تصاویر فعلی محصول حذف و موکاپ‌های تازه جایگزین آن‌ها خواهند شد. آیا مطمئن هستید؟",
    )) return;
    const productDetailsUrl = (savedDesignId: string) =>
      productId
        ? `/seller/dashboard/products/${productId}/edit?supplier=${selectedSupplierOfferId}&replaceImages=1`
        : `/seller/dashboard/products/new?raw=${raw.id}&design=${savedDesignId}&supplier=${selectedSupplierOfferId}`;
    setBlockingSave("در حال ذخیره نسخه نهایی طراحی…");
    let id = designId;
    try {
      // Persist the canvas first. Saving the selection in parallel used to race
      // a newly-created design (and fixed timeouts produced false failures on
      // slower production connections).
      id = (await persist()) || id;
      if (id) {
        let selection = await saveDesignMockupSelectionAction(id, selectedMockups);
        if (!selection.ok) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          selection = await saveDesignMockupSelectionAction(id, selectedMockups);
        }
        if (!selection.ok) {
          setBlockingSave("");
          setSaveState(selection.message);
          setRetryNotice(true);
          return;
        }
      }
    } catch {
      setBlockingSave("");
      setSaveState("ذخیره رنگ‌ها، سایزها یا موکاپ‌ها کامل نشد؛ اتصال را بررسی و دوباره تلاش کنید. تا ذخیره کامل، به مرحله بعد منتقل نمی‌شوید.");
      setRetryNotice(true);
      return;
    }
    if (!id) {
      setBlockingSave("");
      setRetryNotice(true);
      return;
    }
    location.assign(
      productDetailsUrl(id),
    );
  };
  const renderConfiguredMockup = (mockup: (typeof data.mockups)[number]) => (
    <article className="configured-mockup" key={mockup.id}>
      <h3>
        <span>{mockup.name}<small className={`mockup-side-badge ${mockup.side.toLowerCase()}`}>{mockup.side === "BACK" ? "نمای پشت" : "نمای جلو"}</small></span>
        <span className="configured-mockup-actions">
          <button type="button" className="remove" onClick={() => setSelectedMockups((current) => current.filter((id) => id !== mockup.id))} aria-label={`حذف ${mockup.name}`}><Trash2 /></button>
        </span>
      </h3>
      <div className="configured-mockup-views">
        {mockup.views.map((mockupView) => {
          const rawView = raw.views.find(
            (view) => view.side === mockupView.side,
          );
          const requestedArtwork = rawView
            ? objects[
                `${rawView.id}:${mockup.color_id && independentColorIds.includes(mockup.color_id) ? mockup.color_id : sharedColorId}`
              ]
            : undefined;
          const artwork = rawView
            ? requestedArtwork || []
            : [];
          return (
            <div className="configured-mockup-canvas" key={mockupView.id}>
              <ResilientImg
                src={mockupView.backgroundUrl}
                alt={`${mockup.name} ${mockupView.side}`}
              />
              {artwork.length > 0 && <WarpedArtwork
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
                {artwork.map((entry) => (
                  <div
                    className="configured-object"
                    key={entry.id}
                    style={{
                      left: `${entry.x}%`,
                      top: `${entry.y}%`,
                      width: `${entry.w}%`,
                      height: `${entry.h}%`,
                      color: entry.color,
                      background:
                        entry.kind === "shape" ? entry.color : "transparent",
                      fontSize: `${Math.max(7, entry.fontSize * 0.32)}px`,
                      fontFamily: entry.fontFamily || "Vazirmatn",
                      opacity: (entry.opacity ?? 100) / 100,
                      transform: `rotate(${entry.rotation || 0}deg)`,
                    }}
                  >
                    {entry.kind === "text" && entry.text}
                    {entry.kind === "image" && entry.src && (
                      <ResilientImg
                        src={entry.src}
                        alt="طرح"
                        data-manual-crop={hasManualArtworkCrop(entry) ? "true" : undefined}
                        style={{
                          filter: `saturate(${entry.saturation ?? 100}%)`,
                          ...croppedArtworkImageStyle(entry),
                        }}
                      />
                    )}
                  </div>
                ))}
              </WarpedArtwork>}
            </div>
          );
        })}
      </div>
    </article>
  );
  return (
    <main className="design-app" dir="rtl">
      <SellerOnboardingTour tour="design" state={tourState} steps={designTourSteps} />
      <SavingOverlay visible={Boolean(blockingSave)} text={blockingSave} />
      <header className="design-top">
        <a href={productId ? `/seller/dashboard/products/${productId}/edit` : "/seller/dashboard/products/new"}>
          <ArrowRight />
          <span>{productId ? "بازگشت به ویرایش محصول" : "بازگشت"}</span>
        </a>
        <div className="design-product">
          <i>◫</i>
          <div>
            <b>{raw.name}</b>
            <small>{raw.has_back ? "جلو و پشت" : "نمای جلو"}</small>
          </div>
        </div>
        <div className="design-context" data-tour="top-tools">
          <button
            className={tool === "select" ? "active" : ""}
            title="انتخاب"
            onClick={() => setTool("select")}
          >
            <MousePointer2 />
          </button>
          <button
            className={tool === "pan" ? "active" : ""}
            title="جابجایی صفحه"
            onClick={() => setTool("pan")}
          >
            <Move />
          </button>
          <button
            title="بازگشت"
            onClick={undo}
            disabled={!undoByView[activeKey]?.length}
          >
            <Undo2 />
          </button>
          <button
            title="انجام دوباره"
            onClick={redo}
            disabled={!redoByView[activeKey]?.length}
          >
            <Redo2 />
          </button>
          <button
            title="میانبرهای صفحه‌کلید"
            onClick={() => setShortcutsOpen(true)}
          >
            <Keyboard />
          </button>
          {item?.kind === "text" && (
            <>
              <input
                className="design-text-input"
                value={item.text || ""}
                onChange={(event) => update({ text: event.target.value })}
                aria-label="متن"
              />
              <select
                value={item.fontFamily || "Vazirmatn"}
                onChange={(event) => update({ fontFamily: event.target.value })}
              >
                <option>Vazirmatn</option>
                <option>Estedad</option>
                <option value="Tahoma">Tahoma</option>
                <option value="Arial">Arial</option>
                <option value="Shabnam">Shabnam</option>
                <option value="Sahel">Sahel</option>
                <option value="Samim">Samim</option>
                <option value="Yekan Bakh">Yekan Bakh</option>
              </select>
              <input
                className="number"
                type="number"
                value={item.fontSize}
                onChange={(event) =>
                  update({ fontSize: Number(event.target.value) })
                }
              />
              <input
                type="color"
                value={item.color}
                onChange={(event) => update({ color: event.target.value })}
              />
            </>
          )}
          {item?.kind === "shape" && (
            <input
              type="color"
              value={item.color}
              onChange={(event) => update({ color: event.target.value })}
              aria-label="رنگ شکل"
            />
          )}
          {item && (item.kind === "text" || item.kind === "image") && (
            <label className="editor-range" title="شفافیت">
              <span>شفافیت</span>
              <input
                type="range"
                min="0"
                max="100"
                value={item.opacity ?? 100}
                onChange={(event) =>
                  update({ opacity: Number(event.target.value) })
                }
              />
              <b>{item.opacity ?? 100}%</b>
            </label>
          )}
          {item?.kind === "image" && (
            <>
              <button onClick={() => scaleImage(0.9)} title="کوچک کردن تصویر">
                <ZoomOut />
              </button>
              <button onClick={() => scaleImage(1.1)} title="بزرگ کردن تصویر">
                <ZoomIn />
              </button>
              <label className="editor-range" title="اشباع رنگ">
                <span>اشباع</span>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={item.saturation ?? 100}
                  onChange={(event) =>
                    update({ saturation: Number(event.target.value) })
                  }
                />
                <b>{item.saturation ?? 100}%</b>
              </label>
              <button
                className={cropOpen ? "active" : ""}
                onClick={() => openCropEditor(item)}
                title="برش تصویر (Ctrl/Cmd + T)"
              >
                <Crop />
              </button>
              <button
                onClick={() => rotateBy(15)}
                title="چرخش ۱۵ درجه (Ctrl/Cmd + R)"
              >
                <RotateCw />
              </button>
            </>
          )}
          {item && (
            <>
              <button
                title="تکثیر (Ctrl/Cmd + D یا J)"
                onClick={() => duplicate()}
              >
                <Copy />
              </button>
              <button onClick={() => update({ locked: !item.locked })}>
                {item.locked ? <Unlock /> : <Lock />}
              </button>
              <button
                title="آوردن یک لایه به جلو"
                onClick={() => moveLayer("up")}
                disabled={
                  active.findIndex((entry) => entry.id === item.id) ===
                  active.length - 1
                }
              >
                <ChevronUp />
              </button>
              <button
                title="بردن یک لایه به عقب"
                onClick={() => moveLayer("down")}
                disabled={
                  active.findIndex((entry) => entry.id === item.id) === 0
                }
              >
                <ChevronDown />
              </button>
              <button className="danger" onClick={remove}>
                <Trash2 />
              </button>
            </>
          )}
        </div>
        <div className="design-save">
          <span>
            <Save /> {saveState}
          </span>
          <button className="design-save-now" type="button" onClick={() => void persist()}>
            <Save /> ذخیره حالا
          </button>
          <SellerTourReplayButton tour="design" label="راهنما" />
          <button data-tour="design-continue" disabled={Boolean(blockingSave) || pendingUploads > 0} onClick={() => void continueFromDesign()}>
            {pendingUploads > 0 ? "در حال آپلود…" : blockingSave ? "در حال ذخیره…" : "ادامه"} <ChevronLeft />
          </button>
        </div>
      </header>
      <aside className="design-side">
        <div className="design-side-tools" data-tour="design-tools">
          <button onClick={() => uploadRef.current?.click()}>
            <Upload />
            <span>آپلود تصویر</span>
          </button>
          <input
            ref={uploadRef}
            type="file"
            hidden
            accept="image/*"
            onChange={upload}
          />
          <button onClick={() => add("text")}>
            <Type />
            <span>افزودن متن</span>
          </button>
          <button
            className={panel === "files" ? "active" : ""}
            onClick={() =>
              setPanel((value) => (value === "files" ? null : "files"))
            }
          >
            <FolderOpen />
            <span>فایل‌ها</span>
          </button>
          <button
            data-tour="free-designs"
            className={panel === "free" ? "active" : ""}
            onClick={() =>
              setPanel((value) => (value === "free" ? null : "free"))
            }
          >
            <Sparkles />
            <span>طرح رایگان</span>
          </button>
          <button
            data-tour="layers"
            className={panel === "layers" ? "active" : ""}
            onClick={() =>
              setPanel((value) => (value === "layers" ? null : "layers"))
            }
          >
            <Layers3 />
            <span>لایه‌ها</span>
          </button>
          <button onClick={remove} disabled={!item}>
            <Trash2 />
            <span>حذف انتخاب</span>
          </button>
        </div>
        {panel === "layers" && (
          <div className="design-panel">
            <h3>لایه‌ها</h3>
            {active.length ? (
              active
                .slice()
                .reverse()
                .map((entry) => (
                  <button
                    className={selected === entry.id ? "active" : ""}
                    onClick={() => setSelected(entry.id)}
                    key={entry.id}
                  >
                    {entry.kind === "text" ? (
                      <Type />
                    ) : entry.kind === "image" ? (
                      <ImageIcon />
                    ) : (
                      <Shapes />
                    )}
                    <span>
                      {entry.kind === "text"
                        ? entry.text
                        : entry.kind === "image"
                          ? "تصویر"
                          : "شکل"}
                    </span>
                    {entry.locked && <Lock />}
                  </button>
                ))
            ) : (
              <div className="empty-files">
                <Layers3 />
                <p>هنوز لایه‌ای اضافه نشده است.</p>
              </div>
            )}
          </div>
        )}
        {panel === "files" && (
          <div className="design-panel design-files-panel">
            <h3>فایل‌های من</h3>
            <button
              className="files-upload-again"
              onClick={() => uploadRef.current?.click()}
            >
              <Upload /> آپلود تصویر جدید
            </button>
            {uploads.length ? (
              <div className="design-file-grid">
                {uploads.map((file) => (
                  <button
                    key={file.id}
                    title={file.name}
                    onClick={() =>
                      add("image", {
                        src: file.url,
                        storageFileId: file.id,
                        color: "transparent",
                        w: 36,
                        h: 36,
                      })
                    }
                  >
                    <ResilientImg src={file.url} alt={file.name} />
                    <span>{file.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-files">
                <ImageIcon />
                <p>هنوز فایلی آپلود نشده است.</p>
              </div>
            )}
          </div>
        )}
        {panel === "free" && (
          <div className="design-panel design-files-panel free-design-panel">
            <h3>طرح‌های رایگان چاپلی</h3>
            <p>برای افزودن مستقیم به بوم روی طرح کلیک کنید.</p>
            <div className="free-design-filters">
              <label className="free-design-search"><Search/><input value={freeSearch} onChange={(event)=>setFreeSearch(event.target.value)} placeholder="جستجو در نام یا سبک…"/></label>
              <select value={freeStyle} onChange={(event)=>setFreeStyle(event.target.value)} aria-label="فیلتر سبک">
                <option value="ALL">همه سبک‌ها</option>
                {freeStyles.map((style)=><option value={style} key={style}>{style}</option>)}
              </select>
              <select value={freeAccess} onChange={(event)=>setFreeAccess(event.target.value)} aria-label="فیلتر دسترسی">
                <option value="ALL">همه دسترسی‌ها</option><option value="FREE">رایگان</option><option value="PREMIUM">ویژه</option>
              </select>
              <select value={freeSort} onChange={(event)=>setFreeSort(event.target.value)} aria-label="مرتب‌سازی">
                <option value="DEFAULT">ترتیب پیشنهادی</option><option value="TITLE">نام طرح</option><option value="STYLE">نام سبک</option>
              </select>
            </div>
            {filteredFreeDesigns.length ? (
              <>
              <div className="design-file-grid">
                {filteredFreeDesigns.slice(0,freeVisibleCount).map((file) => (
                  <button
                    key={file.id}
                    title={`${file.title} · ${file.style_name}`}
                    onClick={() =>
                      add("image", {
                        src: file.url,
                        storageFileId: file.file_id,
                        color: "transparent",
                        w: 36,
                        h: 36,
                      })
                    }
                  >
                    <ResilientImg src={file.url} alt={file.title} />
                    <span>{file.title}</span>
                    <small>{file.style_name}</small>
                  </button>
                ))}
              </div>
              {freeVisibleCount<filteredFreeDesigns.length&&<button className="free-design-load-more" onClick={()=>setFreeVisibleCount(value=>value+10)}>نمایش ۱۰ طرح بیشتر</button>}
              <small className="free-design-result-count">نمایش {Math.min(freeVisibleCount,filteredFreeDesigns.length).toLocaleString("fa-IR")} از {filteredFreeDesigns.length.toLocaleString("fa-IR")} طرح</small>
              </>
            ) : (
              <div className="empty-files">
                <Sparkles />
                <p>{data.freeDesigns.length?"طرحی مطابق فیلترها پیدا نشد.":"هنوز طرح رایگانی منتشر نشده است."}</p>
              </div>
            )}
          </div>
        )}
      </aside>
      <section
        data-tour="design-canvas"
        className={`design-stage ${tool === "pan" ? "is-panning" : ""} ${fileDragActive ? "is-file-dragging" : ""}`}
        onPointerDown={panStage}
        onDragEnter={(event) => {
          if (event.dataTransfer.types.includes("Files")) setFileDragActive(true);
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFileDragActive(false);
        }}
        onDrop={dropOnCanvas}
      >
        {fileDragActive && <div className="design-drop-hint"><Upload /><b>تصویر را رها کن</b><span>خودکار آپلود و روی بوم اضافه می‌شود</span></div>}
        <div
          className="design-canvas-wrap"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
            aspectRatio: backgroundAspectRatio,
          }}
        >
          <div
            className="design-canvas"
            style={{
              backgroundColor:
                raw.colors.find((color) => color.id === colorId)?.hex ||
                "#f4f2f7",
            }}
          >
            {background ? (
              <ResilientImg
                className="design-background"
                src={background}
                alt={raw.name}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  if (image.naturalWidth && image.naturalHeight) {
                    setBackgroundAspectRatio(
                      image.naturalWidth / image.naturalHeight,
                    );
                  }
                }}
              />
            ) : (
              <div className="design-background placeholder">
                <ImageIcon />
              </div>
            )}
            <div
              className="print-area"
              style={{
                left: `${Number(raw.views.find((view) => view.id === viewId)?.print_area_x || 0.3) * 100}%`,
                top: `${Number(raw.views.find((view) => view.id === viewId)?.print_area_y || 0.2) * 100}%`,
                width: `${Number(raw.views.find((view) => view.id === viewId)?.print_area_width || 0.4) * 100}%`,
                height: `${Number(raw.views.find((view) => view.id === viewId)?.print_area_height || 0.55) * 100}%`,
              }}
            >
              {active.map((entry) => (
                <div
                  className={`canvas-object ${entry.kind}-object ${selected === entry.id ? "selected" : ""}`}
                  key={entry.id}
                  onPointerDown={(event) => drag(event, entry)}
                  onClick={() => setSelected(entry.id)}
                  style={{
                    left: `${entry.x}%`,
                    top: `${entry.y}%`,
                    width: `${entry.w}%`,
                    height: `${entry.h}%`,
                    background:
                      entry.kind === "shape" ? entry.color : "transparent",
                    color: entry.color,
                    fontSize: entry.fontSize,
                    fontFamily: entry.fontFamily || "Vazirmatn",
                    opacity: (entry.opacity ?? 100) / 100,
                    transform: `rotate(${entry.rotation || 0}deg)`,
                  }}
                >
                  {entry.kind === "text" && entry.text}
                  {entry.kind === "image" && entry.src && (
                    <span
                      className="canvas-image-clip"
                    >
                      <ResilientImg
                        src={entry.src}
                        alt="design"
                        draggable={false}
                        onLoad={(event) =>
                          syncImageAspect(
                            entry.id,
                            event.currentTarget.naturalWidth,
                            event.currentTarget.naturalHeight,
                          )
                        }
                        data-manual-crop={hasManualArtworkCrop(entry) ? "true" : undefined}
                        style={{
                          filter: `saturate(${entry.saturation ?? 100}%)`,
                          ...croppedArtworkImageStyle(entry),
                        }}
                      />
                    </span>
                  )}
                  {selected === entry.id &&
                    (entry.kind === "text" || entry.kind === "image") &&
                    !entry.locked && (
                      <>
                        {(["northWest", "northEast", "southEast", "southWest"] as const).map((corner) => (
                          <button
                            className={`object-resize-handle ${corner}`}
                            onPointerDown={(event) => resize(event, entry, corner)}
                            aria-label="تغییر اندازه"
                            title="تغییر اندازه"
                            key={corner}
                          />
                        ))}
                        <button
                          className="object-rotate-handle"
                          onPointerDown={(event) => rotate(event, entry)}
                          aria-label="چرخاندن"
                          title="برای چرخاندن بکش؛ Shift یعنی گام‌های ۱۵ درجه"
                        ><RotateCw /></button>
                      </>
                    )}
                </div>
              ))}
            </div>
            {overlay && (
              <ResilientImg
                className="design-overlay"
                src={overlay}
                alt="لایه رویی محصول"
              />
            )}
          </div>
        </div>
        <div className="design-bottom" data-tour="design-variants">
          {raw.views.length > 1 && (
            <div className="view-switch">
              {raw.views.map((view) => (
                <button
                  className={viewId === view.id ? "active" : ""}
                  onClick={() => {
                    setViewId(view.id);
                    setSelected(null);
                  }}
                  key={view.id}
                >
                  {view.side === "FRONT" ? "جلو" : "پشت"}
                </button>
              ))}
            </div>
          )}
          {raw.colors.length > 1 && (
            <div className="color-switch">
              {raw.colors.map((color) => (
                <button
                  className={colorId === color.id ? "active" : ""}
                  onClick={() => chooseCanvasColor(color.id)}
                  key={color.id}
                  title={color.name}
                  style={{ background: color.hex || "#ddd" }}
                />
              ))}
            </div>
          )}
          <div className="zoom-switch">
            <button
              onClick={() => setZoom((value) => Math.max(30, value - 10))}
              aria-label="کوچک‌نمایی"
              title={`کوچک‌نمایی — ${zoom}%`}
            >
              <ZoomOut />
            </button>
            <button
              onClick={() => setZoom((value) => Math.min(250, value + 10))}
              aria-label="بزرگ‌نمایی"
              title={`بزرگ‌نمایی — ${zoom}%`}
            >
              <ZoomIn />
            </button>
          </div>
        </div>
      </section>
      {shortcutsOpen && (
        <div className="crop-dialog-backdrop" onPointerDown={()=>setShortcutsOpen(false)}>
          <section className="design-shortcuts-dialog" onPointerDown={(event)=>event.stopPropagation()}>
            <header><div><Keyboard/><h2>میانبرهای طراحی</h2></div><button type="button" onClick={()=>setShortcutsOpen(false)}>×</button></header>
            <div>
              {[["Ctrl/Cmd + D یا J","تکثیر"],["Ctrl/Cmd + C / V","کپی / چسباندن"],["Ctrl/Cmd + T","برش تصویر"],["Ctrl/Cmd + R","چرخش ۱۵ درجه"],["Ctrl/Cmd + Z","بازگشت"],["Ctrl/Cmd + Shift + Z یا Y","انجام دوباره"],["کلیدهای جهت","حرکت دقیق"],["Shift + جهت","حرکت ۵ واحدی"],["Ctrl/Cmd + [ یا ]","عقب / جلو بردن لایه"],["+ و −","بزرگ‌نمایی / کوچک‌نمایی"],["Delete","حذف"],["Escape","لغو انتخاب"]].map(([keys,label])=><p key={keys}><kbd>{keys}</kbd><span>{label}</span></p>)}
            </div>
          </section>
        </div>
      )}
      {cropOpen && item?.kind === "image" && item.src && (
        <div className="crop-dialog-backdrop" onPointerDown={()=>setCropOpen(false)}>
          <section className="crop-dialog manual-crop-dialog" onPointerDown={(event)=>event.stopPropagation()}>
            <header><div><Crop/><h2>برش تصویر</h2></div><button type="button" onClick={()=>setCropOpen(false)}>×</button></header>
            <p>کادر روشن را جابه‌جا کن و از گوشه‌ها اندازه‌اش را آزادانه تغییر بده. نسبت نهایی تصویر همان نسبت کادر خواهد بود.</p>
            <div className="manual-crop-stage" style={{ aspectRatio: cropImageAspect }}>
              <ResilientImg src={item.src} alt="تصویر اصلی برای برش" draggable={false} onLoad={(event)=>{
                const image=event.currentTarget;
                if(image.naturalWidth&&image.naturalHeight)setCropImageAspect(image.naturalWidth/image.naturalHeight);
              }}/>
              <div
                className="manual-crop-frame"
                style={{ left:`${cropDraft.x}%`,top:`${cropDraft.y}%`,width:`${cropDraft.width}%`,height:`${cropDraft.height}%` }}
                onPointerDown={(event)=>manipulateCrop(event,"move")}
              >
                <button type="button" className="north-west" onPointerDown={(event)=>manipulateCrop(event,"northWest")} aria-label="گوشه بالا چپ" />
                <button type="button" className="north" onPointerDown={(event)=>manipulateCrop(event,"north")} aria-label="لبه بالا" />
                <button type="button" className="north-east" onPointerDown={(event)=>manipulateCrop(event,"northEast")} aria-label="گوشه بالا راست" />
                <button type="button" className="east" onPointerDown={(event)=>manipulateCrop(event,"east")} aria-label="لبه راست" />
                <button type="button" className="south-east" onPointerDown={(event)=>manipulateCrop(event,"southEast")} aria-label="گوشه پایین راست" />
                <button type="button" className="south" onPointerDown={(event)=>manipulateCrop(event,"south")} aria-label="لبه پایین" />
                <button type="button" className="south-west" onPointerDown={(event)=>manipulateCrop(event,"southWest")} aria-label="گوشه پایین چپ" />
                <button type="button" className="west" onPointerDown={(event)=>manipulateCrop(event,"west")} aria-label="لبه چپ" />
                <span>{Math.round(cropDraft.width).toLocaleString("fa-IR")} × {Math.round(cropDraft.height).toLocaleString("fa-IR")}</span>
              </div>
            </div>
            <footer><button type="button" onClick={()=>setCropOpen(false)}>انصراف</button><button type="button" onClick={applyCrop}>اعمال برش</button></footer>
          </section>
        </div>
      )}
      {phase !== "design" && (
        <div className="design-flow-back">
          <section className={`design-flow ${phase === "review" ? "review-flow" : ""}`}>
            <button className="close" onClick={() => setPhase("design")}>
              ×
            </button>
            <button type="button" className="flow-previous" onClick={() => phase === "supplier" ? setPhase("design") : phase === "variants" ? (variantStep === "sizes" ? setVariantStep("colors") : setPhase("supplier")) : phase === "mockups" ? setPhase("variants") : setPhase("mockups")}><ArrowRight /> مرحله قبل</button>
            {phase === "supplier" ? (
              <>
                <Package />
                <span>انتخاب تأمین‌کننده</span>
                <h2>اول تأمین‌کننده را انتخاب کن</h2>
                <p>
                  رتبه بر اساس تعداد محصولات قابل تأمین و نظرهای واقعی خریداران
                  محاسبه شده است.
                </p>
                <div className="supplier-choice-ranking">
                  {data.suppliers
                    .filter(
                      (offer) =>
                        offer.raw_product_id === raw.id &&
                        offer.variants.length > 0,
                    )
                    .map((offer, index) => (
                      <button
                        key={offer.id}
                        className={
                          selectedSupplierOfferId === offer.id ? "active" : ""
                        }
                        onClick={() => {
                          setSelectedSupplierOfferId(offer.id);
                          setSelectedVariants([]);
                          setSelectedColorIds([]);setSelectedSizeIds([]);setVariantStep("colors");
                        }}
                      >
                        <b>
                          {index + 1}. {offer.organization?.display_name}
                        </b>
                        <span>
                          {offer.productCount} محصول · {offer.reviewCount} نظر ·
                          امتیاز {offer.ratingAverage.toFixed(1)}
                        </span>
                        <small>
                          {offer.variants.length} تنوع قابل طراحی · آماده‌سازی{" "}
                          {offer.lead_time_days} روز
                        </small>
                        {selectedSupplierOfferId === offer.id && <Check />}
                      </button>
                    ))}
                </div>
                {!data.suppliers.some(
                  (offer) =>
                    offer.raw_product_id === raw.id &&
                    offer.variants.length > 0,
                ) && (
                  <div className="empty-state">
                    تأمین‌کننده تأییدشده‌ای برای این محصول وجود ندارد.
                  </div>
                )}
                <button
                  disabled={!selectedSupplierOfferId}
                  onClick={() => setPhase("variants")}
                >
                  انتخاب رنگ و سایز <ChevronLeft />
                </button>
              </>
            ) : phase === "variants" ? (
              <>
                <Palette />
                <span>تنوع‌های قابل طراحی</span>
                <h2>رنگ و سایزها را انتخاب کن</h2>
                <p>
                  طرح روی همه انتخاب‌ها ثابت می‌ماند؛ فقط تصویر محصول تغییر
                  می‌کند.
                </p>
                {variantStep==="colors" ? <>
                  <div className="variant-step-heading"><h3>۱. رنگ‌های موردنظر را انتخاب کنید</h3><button type="button" onClick={()=>syncVariants(availableColorIds,selectedSizeIds)}>انتخاب همه رنگ‌ها</button></div>
                  <div className="variant-choice-list fixed-variant-list">{raw.colors.filter(color=>availableVariants.some(variant=>variant.color_id===color.id)).map(color=><label key={color.id}><input type="checkbox" checked={selectedColorIds.includes(color.id)} onChange={()=>{const next=selectedColorIds.includes(color.id)?selectedColorIds.filter(id=>id!==color.id):[...selectedColorIds,color.id];syncVariants(next,selectedSizeIds)}}/><span><i style={{background:color.hex||"#ddd"}}/>{color.name}<Check/></span></label>)}</div>
                  <button disabled={!selectedColorIds.length} onClick={()=>setVariantStep("sizes")}>ادامه و انتخاب سایز <ChevronLeft/></button>
                </> : <>
                  <div className="variant-step-heading"><h3>۲. سایزهای موردنظر را انتخاب کنید</h3><button type="button" onClick={()=>syncVariants(selectedColorIds,availableSizeIds)}>انتخاب همه سایزها</button></div>
                  <div className="variant-choice-list fixed-variant-list">{raw.sizes.filter(size=>availableVariants.some(variant=>selectedColorIds.includes(variant.color_id)&&variant.size_id===size.id)).map(size=><label key={size.id}><input type="checkbox" checked={selectedSizeIds.includes(size.id)} onChange={()=>{const next=selectedSizeIds.includes(size.id)?selectedSizeIds.filter(id=>id!==size.id):[...selectedSizeIds,size.id];syncVariants(selectedColorIds,next)}}/><span>{size.name}<Check/></span></label>)}</div>
                  <button type="button" className="variant-back" onClick={()=>setVariantStep("colors")}>بازگشت به رنگ‌ها</button>
                  <button disabled={!selectedVariants.length} onClick={()=>setPhase("mockups")}>انتخاب موکاپ‌ها <ChevronLeft/></button>
                </>}
                <div hidden>
                <button
                  type="button"
                  className="variant-select-all"
                  onClick={() =>
                    setSelectedVariants(
                      raw.variants
                        .filter((variant) => supplierVariantIds.has(variant.id))
                        .map((variant) => variant.id),
                    )
                  }
                >
                  انتخاب همه
                </button>
                <div className="variant-choice-list">
                  {raw.variants
                    .filter((variant) => supplierVariantIds.has(variant.id))
                    .map((variant) => {
                      const color = raw.colors.find(
                          (item) => item.id === variant.color_id,
                        ),
                        size = raw.sizes.find(
                          (item) => item.id === variant.size_id,
                        );
                      return (
                        <label key={variant.id}>
                          <input
                            type="checkbox"
                            checked={selectedVariants.includes(variant.id)}
                            onChange={() =>
                              setSelectedVariants((current) =>
                                current.includes(variant.id)
                                  ? current.filter((id) => id !== variant.id)
                                  : [...current, variant.id],
                              )
                            }
                          />
                          <span>
                            <i style={{ background: color?.hex || "#ddd" }} />
                            {color?.name} · {size?.name}
                            <Check />
                          </span>
                        </label>
                      );
                    })}
                </div>
                <button
                  disabled={!selectedVariants.length}
                  onClick={() => setPhase("mockups")}
                >
                  انتخاب موکاپ‌ها <ChevronLeft />
                </button>
                </div>
              </>
            ) : phase === "mockups" ? (
              <>
                <ImageIcon />
                <span>انتخاب موکاپ</span>
                <h2>حداکثر ۵۰ موکاپ تک‌نما انتخاب کن</h2>
                <p>
                  هر کارت فقط جلو یا پشت است. طرح همان نما روی محدوده دقیق و
                  هم‌نسبت تعریف‌شده توسط مدیر قرار می‌گیرد.
                </p>
                <div className="mockup-filter-bar">
                  <label>رنگ
                    <select value={mockupColorFilter} onChange={(event) => setMockupColorFilter(event.target.value)}>
                      <option value="ALL">همه رنگ‌های انتخاب‌شده</option>
                      {raw.colors.filter((color) => selectedVariantColorIds.has(color.id)).map((color) => (
                        <option key={color.id} value={color.id}>{color.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>نما
                    <select value={mockupSideFilter} onChange={(event) => setMockupSideFilter(event.target.value)}>
                      <option value="ALL">همه نماها</option>
                      <option value="FRONT">جلو</option>
                      <option value="BACK">پشت</option>
                    </select>
                  </label>
                </div>
                {filteredMockups.length ? (
                  <div className="mockup-choice-grid">
                    {filteredMockups.map((mockup) => (
                        <button
                          className={
                            selectedMockups.includes(mockup.id) ? "active" : ""
                          }
                          key={mockup.id}
                          onClick={() =>
                            setSelectedMockups((current) =>
                              current.includes(mockup.id)
                                ? current.filter((id) => id !== mockup.id)
                                : current.length < 50
                                  ? [...current, mockup.id]
                                  : current,
                            )
                          }
                        >
                          <div>
                            {mockup.views[0]?.backgroundUrl && (
                              <ResilientImg
                                src={mockup.views[0].backgroundUrl}
                                alt={mockup.name}
                              />
                            )}
                          </div>
                          <b>{mockup.name}</b>
                          <small>{raw.colors.find((color) => color.id === mockup.color_id)?.name || "—"}</small>
                          <span className={`mockup-side-badge ${mockup.side.toLowerCase()}`}>
                            {mockup.side === "BACK" ? "نمای پشت" : "نمای جلو"}
                          </span>
                          {selectedMockups.includes(mockup.id) && <Check />}
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    هنوز مدیر برای این محصول خام موکاپی نساخته است.
                  </div>
                )}
                <button
                  disabled={!selectedMockups.length}
                  onClick={() => {
                    setPhase("review");
                    if (designId)
                      void saveDesignMockupSelectionAction(
                        designId,
                        selectedMockups,
                      );
                  }}
                >
                  رندر و بازبینی <ChevronLeft />
                </button>
              </>
            ) : (
              <>
                <Sparkles />
                <span>موکاپ‌های آماده</span>
                <h2>نتیجه نهایی روی {raw.name}</h2>
                <div className="configured-mockup-list">
                  {data.mockups
                    .filter((mockup) => selectedMockups.includes(mockup.id))
                    .map(renderConfiguredMockup)}
                </div>
                <section className="mockup-quality-guide">
                  <h2>اگر از کیفیت کاملا راضی نیستید:</h2>
                  <ol>
                    <li>از طرح‌های بدون بک‌گراند استفاده کنید.</li>
                    <li>بهتر است ابعاد طرحتان را کوچک‌تر کنید.</li>
                    <li>با زدن دکمه زیر به‌وسیله ChatGPT می‌توانید موکاپ بهتری بسازید.</li>
                  </ol>
                  <button type="button" onClick={() => setChatGuideOpen((value) => !value)}>
                    ساخت با ChatGPT
                  </button>
                  {chatGuideOpen && (
                    <div className="chatgpt-mockup-guide">
                      <h3>۱ — یک طرح و یک موکاپ دانلود کنید</h3>
                      <div className="mockup-downloads">
                        {[...new Map(Object.values(objects).flat().filter((entry) => entry.kind === "image" && entry.src).map((entry) => [entry.src, entry])).values()].map((entry, index) => (
                          <button type="button" onClick={() => void downloadDesignAsset(entry.src || "", `chaplly-design-${index + 1}.png`)} key={entry.id}>دانلود طرح {index + 1}</button>
                        ))}
                        {data.mockups.filter((mockup) => selectedMockups.includes(mockup.id)).flatMap((mockup) => mockup.views.map((view) => (
                          <button type="button" onClick={() => void downloadDesignAsset(view.backgroundUrl, `chaplly-mockup-${view.id}.png`)} key={view.id}>دانلود {mockup.name}</button>
                        )))}
                      </div>
                      <h3>۲ — پرامپت را کپی کنید یا مستقیماً ChatGPT را باز کنید</h3>
                      <textarea readOnly value="Create a realistic product mockup using the attached blank mockup image as the base and the attached transparent design image as the artwork. Preserve the product shape, fabric texture, lighting, shadows, folds, camera angle, and background. Place the design naturally inside the printable area, keep its aspect ratio, slightly blend it with the fabric texture, and return one clean high-resolution product image without changing the design." />
                      <div>
                        <button type="button" onClick={() => navigator.clipboard.writeText("Create a realistic product mockup using the attached blank mockup image as the base and the attached transparent design image as the artwork. Preserve the product shape, fabric texture, lighting, shadows, folds, camera angle, and background. Place the design naturally inside the printable area, keep its aspect ratio, slightly blend it with the fabric texture, and return one clean high-resolution product image without changing the design.")}>کپی پرامپت</button>
                        <a target="_blank" rel="noreferrer" href={`https://chatgpt.com/?q=${encodeURIComponent("Create a realistic product mockup using the attached blank mockup image as the base and the attached transparent design image as the artwork. Preserve the product shape, fabric texture, lighting, shadows, folds, camera angle, and background. Place the design naturally inside the printable area, keep its aspect ratio, slightly blend it with the fabric texture, and return one clean high-resolution product image without changing the design.")}`}>باز کردن ChatGPT با پرامپت</a>
                      </div>
                      <h3>۳ — دو تصویر دانلودشده را پیوست و پیام را ارسال کنید</h3>
                    </div>
                  )}
                </section>
                <button
                  className="redo-mockups"
                  onClick={() => setPhase("mockups")}
                >
                  انتخاب دوباره
                </button>
                {retryNotice && <p className="design-retry-notice"><strong>این مرحله هنوز کامل نشده است.</strong> لطفاً دکمه زیر را دوباره بزنید.</p>}
                <button
                  disabled={!selectedMockups.length || Boolean(blockingSave)}
                  data-action-waiting={blockingSave ? "true" : undefined}
                  onClick={finish}
                >
                  تأیید و تکمیل اطلاعات محصول <ChevronLeft />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
