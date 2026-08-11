/* eslint-disable @next/next/no-img-element */
"use client";

import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/estedad/400.css";
import "@fontsource/estedad/700.css";
import {
  ChangeEvent,
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
  Layers3,
  Lock,
  MousePointer2,
  Move,
  Package,
  Palette,
  Redo2,
  Save,
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
import { WarpedArtwork } from "@/components/warped-artwork";

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

export function DesignEditor({ data }: { data: EditorData }) {
  const raw = data.rawProducts[0],
    existing = data.design;
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
  const [colorId, setColorId] = useState(
    raw.colors.find(
      (color) =>
        color.name.trim() === "سفید" ||
        ["#fff", "#ffffff"].includes((color.hex || "").toLowerCase()),
    )?.id || raw.colors[0]?.id || "",
  );
  const [backgroundAspectRatio, setBackgroundAspectRatio] = useState(1.25);
  const [selected, setSelected] = useState<string | null>(null),
    [zoom, setZoom] = useState(140),
    [designId, setDesignId] = useState(existing?.id || ""),
    [panel, setPanel] = useState<"layers" | "files" | "free" | null>(null),
    [cropOpen, setCropOpen] = useState(false),
    [uploads, setUploads] = useState(data.uploads),
    [tool, setTool] = useState<"select" | "pan">("select"),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [undoByView, setUndoByView] = useState<Record<string, ObjectItem[][]>>({}),
    [redoByView, setRedoByView] = useState<Record<string, ObjectItem[][]>>({});
  const [cropDraft, setCropDraft] = useState({ scale: 100, x: 50, y: 50 });
  const [selectedVariants, setSelectedVariants] = useState<string[]>(
    existing?.variantIds || [],
  );
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>(() => [...new Set(raw.variants.filter(variant=>(existing?.variantIds||[]).includes(variant.id)).map(variant=>variant.color_id))]);
  const [selectedSizeIds, setSelectedSizeIds] = useState<string[]>(() => [...new Set(raw.variants.filter(variant=>(existing?.variantIds||[]).includes(variant.id)).map(variant=>variant.size_id))]);
  const [variantStep, setVariantStep] = useState<"colors"|"sizes">("colors");
  const [selectedSupplierOfferId, setSelectedSupplierOfferId] = useState("");
  const selectedSupplier = data.suppliers.find(
    (offer) => offer.id === selectedSupplierOfferId,
  );
  const supplierVariantIds = new Set(
    selectedSupplier?.variants.map(
      (variant) => variant.raw_product_variant_id,
    ) || [],
  );
  const availableVariants = raw.variants.filter((variant) => supplierVariantIds.has(variant.id));
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
    [mockupGenderFilter, setMockupGenderFilter] = useState("ALL"),
    [mockupSideFilter, setMockupSideFilter] = useState("ALL"),
    [mockupColorFilter, setMockupColorFilter] = useState("ALL"),
    [chatGuideOpen, setChatGuideOpen] = useState(false),
    [blockingSave, setBlockingSave] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null),
    saving = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`chapli-design-canvas:${raw.id}`);
      if (saved) setObjects(JSON.parse(saved) as Record<string, ObjectItem[]>);
    } catch {
      localStorage.removeItem(`chapli-design-canvas:${raw.id}`);
    } finally {
      setLocalCanvasReady(true);
    }
  }, [raw.id]);
  useEffect(() => {
    if (!localCanvasReady) return;
    localStorage.setItem(
      `chapli-design-canvas:${raw.id}`,
      JSON.stringify(objects),
    );
  }, [localCanvasReady, objects, raw.id]);
  const activeKey = `${viewId}:${colorId}`;
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
        (mockupSideFilter === "ALL" || mockup.side === mockupSideFilter) &&
        (mockupGenderFilter === "ALL" || mockup.gender === mockupGenderFilter)
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
  const canvasViews = useMemo(
    () =>
      raw.views.map((view) => ({
        rawProductViewId: view.id,
        canvas: {
          version: 2,
          objects: objects[`${view.id}:${colorId}`] || [],
          colorObjects: Object.fromEntries(
            raw.colors.map((color) => [
              color.id,
              objects[`${view.id}:${color.id}`]?.length
                ? objects[`${view.id}:${color.id}`]
                : objects[`${view.id}:${colorId}`] || [],
            ]),
          ),
        },
      })),
    [colorId, objects, raw.colors, raw.views],
  );
  const activeSave = useRef<Promise<string> | null>(null);
  const persist = useCallback(async () => {
    if (activeSave.current) return activeSave.current;
    const task = (async () => {
      saving.current = true;
      setSaveState("در حال ذخیره…");
      try {
        const result = await saveDesignDraftAction({
          designId: designId || undefined,
          rawProductId: raw.id,
          name: `طرح ${raw.name}`,
          views: canvasViews,
          variantIds: selectedVariants,
        });
        if (result.ok && result.id) {
          setDesignId(result.id);
          setSaveState("ذخیره شد");
          return result.id;
        }
        setSaveState(result.message);
        return "";
      } catch (error) {
        console.error("Design save failed", error);
        setSaveState("ذخیره طراحی ناموفق بود؛ دوباره تلاش کنید.");
        return "";
      } finally {
        saving.current = false;
        activeSave.current = null;
      }
    })();
    activeSave.current = task;
    return task;
  }, [canvasViews, designId, raw.id, raw.name, selectedVariants]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void persist();
    }, 600);
    return () => clearTimeout(timer);
  }, [persist]);
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
    const width = Math.max(12, Math.min(400, item.w * factor));
    const height = Math.max(8, Math.min(400, width * ratio));
    update({ w: width, h: height });
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const temporaryUrl = URL.createObjectURL(file);
    const objectId = add("image", {
      src: temporaryUrl,
      color: "transparent",
      w: 36,
      h: 36,
    });
    const form = new FormData();
    form.set("file", file);
    setSaveState("تصویر اضافه شد؛ در حال آپلود…");
    event.target.value = "";
    try {
      const result = await uploadDesignAssetAction(form);
      if (result.ok && result.url) {
        setObjects((current) => ({
          ...current,
          [activeKey]: (current[activeKey] || []).map((entry) =>
            entry.id === objectId
              ? {
                  ...entry,
                  src: result.url,
                  storageFileId: result.fileId,
                }
              : entry,
          ),
        }));
        setUploads((current) => [
          {
            id: result.fileId || crypto.randomUUID(),
            name: file.name,
            url: result.url!,
          },
          ...current.filter((item) => item.id !== result.fileId),
        ]);
        URL.revokeObjectURL(temporaryUrl);
        setSaveState("تصویر آپلود و ذخیره شد");
      } else setSaveState(`تصویر موقت است؛ ${result.message}`);
    } catch {
      setSaveState("تصویر روی بوم است اما آپلود ناموفق بود؛ دوباره تلاش کنید.");
    }
  };
  const drag = (
    event: ReactPointerEvent<HTMLDivElement>,
    target: ObjectItem,
  ) => {
    if (target.locked || tool !== "select") return;
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
                x: Math.max(
                  0,
                  Math.min(
                    100 - target.w,
                    ox + ((next.clientX - sx) / box.width) * 100,
                  ),
                ),
                y: Math.max(
                  0,
                  Math.min(
                    100 - target.h,
                    oy + ((next.clientY - sy) / box.height) * 100,
                  ),
                ),
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
      startW = target.w,
      startH = target.h;
    const move = (next: PointerEvent) => {
      const requestedScale =
        1 +
        ((next.clientX - startX) / box.width +
          (next.clientY - startY) / box.height) /
          2;
      const minimumScale = Math.max(12 / startW, 8 / startH);
      const maximumScale = Math.min(400 / startW, 400 / startH);
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
  const dragCrop = (
    event: ReactPointerEvent<HTMLSpanElement>,
    target: ObjectItem,
  ) => {
    if (!cropOpen || selected !== target.id || target.kind !== "image") return;
    event.preventDefault();
    event.stopPropagation();
    const box = event.currentTarget.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = target.cropX ?? 50;
    const originY = target.cropY ?? 50;
    const move = (next: PointerEvent) => {
      const cropX = Math.max(0, Math.min(100, originX - ((next.clientX - startX) / box.width) * 100));
      const cropY = Math.max(0, Math.min(100, originY - ((next.clientY - startY) / box.height) * 100));
      setObjects((current) => ({
        ...current,
        [activeKey]: (current[activeKey] || []).map((entry) =>
          entry.id === target.id ? { ...entry, cropX, cropY } : entry,
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
        target?.tagName === "SELECT";
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (
        !editing &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        remove();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  });
  const finish = async () => {
    setBlockingSave("در حال ذخیره نسخه نهایی طراحی…");
    const timeout = <T,>(promise: Promise<T>, milliseconds: number) =>
      Promise.race<T>([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), milliseconds),
        ),
      ]);
    let id = designId;
    try {
      if (id) {
        const [savedId, selection] = await Promise.all([
          timeout(persist(), 15000).catch(() => id),
          timeout(saveDesignMockupSelectionAction(id, selectedMockups), 10000),
        ]);
        if (!selection.ok) {
          setBlockingSave("");
          setSaveState(selection.message);
          return;
        }
        id = savedId || id;
      } else {
        id = await timeout(persist(), 15000);
        if (id) {
          const selection = await timeout(
            saveDesignMockupSelectionAction(id, selectedMockups),
            10000,
          );
          if (!selection.ok) {
            setBlockingSave("");
            setSaveState(selection.message);
            return;
          }
        }
      }
    } catch {
      if (designId) {
        location.assign(
          `/seller/dashboard/products/new?raw=${raw.id}&design=${designId}&supplier=${selectedSupplierOfferId}`,
        );
        return;
      }
      setBlockingSave("");
      setSaveState("ذخیره نهایی طول کشید؛ اتصال را بررسی و دوباره تلاش کنید.");
      return;
    }
    if (!id) {
      setBlockingSave("");
      return;
    }
    location.assign(
      `/seller/dashboard/products/new?raw=${raw.id}&design=${id}&supplier=${selectedSupplierOfferId}`,
    );
  };
  const renderConfiguredMockup = (mockup: (typeof data.mockups)[number]) => (
    <article className="configured-mockup" key={mockup.id}>
      <h3>
        {mockup.name}
        <small className={`mockup-side-badge ${mockup.side.toLowerCase()}`}>
          {mockup.side === "BACK" ? "نمای پشت" : "نمای جلو"}
        </small>
      </h3>
      <div className="configured-mockup-views">
        {mockup.views.map((mockupView) => {
          const rawView = raw.views.find(
            (view) => view.side === mockupView.side,
          );
          const requestedArtwork = rawView
            ? objects[`${rawView.id}:${mockup.color_id || colorId}`]
            : undefined;
          const activeColorArtwork = rawView
            ? objects[`${rawView.id}:${colorId}`]
            : undefined;
          const artwork = rawView
            ? requestedArtwork?.length
              ? requestedArtwork
              : activeColorArtwork?.length
                ? activeColorArtwork
                : Object.entries(objects).find(
                    ([key, entries]) =>
                      key.startsWith(`${rawView.id}:`) && entries.length > 0,
                  )?.[1] || []
            : [];
          return (
            <div className="configured-mockup-canvas" key={mockupView.id}>
              <img
                src={mockupView.backgroundUrl}
                alt={`${mockup.name} ${mockupView.side}`}
              />
              <WarpedArtwork
                points={mockupView.perspective_points}
                clip={mockupView.artwork_clip}
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
                      opacity: ((entry.opacity ?? 100) / 100) * 0.83,
                    }}
                  >
                    {entry.kind === "text" && entry.text}
                    {entry.kind === "image" && entry.src && (
                      <img
                        src={entry.src}
                        alt="طرح"
                        style={{
                          filter: `saturate(${entry.saturation ?? 100}%)`,
                          transform: `translate(${(50-(entry.cropX??50))*(((entry.cropScale??100)/100)-1)}%,${(50-(entry.cropY??50))*(((entry.cropScale??100)/100)-1)}%) scale(${(entry.cropScale??100)/100})`,
                          transformOrigin: "center",
                        }}
                      />
                    )}
                  </div>
                ))}
              </WarpedArtwork>
            </div>
          );
        })}
      </div>
    </article>
  );
  return (
    <main className="design-app" dir="rtl">
      <SavingOverlay visible={Boolean(blockingSave)} text={blockingSave} />
      <header className="design-top">
        <a href="/seller/dashboard/products/new">
          <ArrowRight />
          <span>بازگشت</span>
        </a>
        <div className="design-product">
          <i>◫</i>
          <div>
            <b>{raw.name}</b>
            <small>{raw.has_back ? "جلو و پشت" : "نمای جلو"}</small>
          </div>
        </div>
        <div className="design-context">
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
                onClick={() => {
                  setCropDraft({ scale: item.cropScale ?? 100, x: item.cropX ?? 50, y: item.cropY ?? 50 });
                  setCropOpen(true);
                }}
                title="برش تصویر"
              >
                <Crop />
              </button>
              {cropOpen && (
                <div className="crop-controls crop-mouse-hint">
                  تصویر را با ماوس روی بوم جابه‌جا کنید؛ برای بزرگ‌نمایی از چرخ ماوس استفاده کنید.
                </div>
              )}
            </>
          )}
          {item && (
            <>
              <button
                title="تکثیر"
                onClick={() => {
                  const { id: _id, ...copy } = item;
                  void _id;
                  add(item.kind, {
                    ...copy,
                    x: Math.min(100 - item.w, item.x + 3),
                    y: Math.min(100 - item.h, item.y + 3),
                  });
                }}
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
          <button onClick={() => setPhase("supplier")}>
            ادامه <ChevronLeft />
          </button>
        </div>
      </header>
      <aside className="design-side">
        <div className="design-side-tools">
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
            className={panel === "free" ? "active" : ""}
            onClick={() =>
              setPanel((value) => (value === "free" ? null : "free"))
            }
          >
            <Sparkles />
            <span>طرح رایگان</span>
          </button>
          <button
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
                    <img src={file.url} alt={file.name} />
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
            {data.freeDesigns.length ? (
              <div className="design-file-grid">
                {data.freeDesigns.map((file) => (
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
                    <img src={file.url} alt={file.title} />
                    <span>{file.title}</span>
                    <small>{file.style_name}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-files">
                <Sparkles />
                <p>هنوز طرح رایگانی منتشر نشده است.</p>
              </div>
            )}
          </div>
        )}
      </aside>
      <section
        className={`design-stage ${tool === "pan" ? "is-panning" : ""}`}
        onPointerDown={panStage}
      >
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
              <img
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
                  }}
                >
                  {entry.kind === "text" && entry.text}
                  {entry.kind === "image" && entry.src && (
                    <span
                      className="canvas-image-clip"
                      onPointerDown={(event) => dragCrop(event, entry)}
                      onWheel={(event) => {
                        if (!cropOpen || selected !== entry.id) return;
                        event.preventDefault();
                        event.stopPropagation();
                        const cropScale = Math.max(
                          100,
                          Math.min(300, (entry.cropScale ?? 120) - event.deltaY * 0.25),
                        );
                        setObjects((current) => ({
                          ...current,
                          [activeKey]: (current[activeKey] || []).map((object) =>
                            object.id === entry.id ? { ...object, cropScale } : object,
                          ),
                        }));
                      }}
                    >
                      <img
                        src={entry.src}
                        alt="design"
                        style={{
                          filter: `saturate(${entry.saturation ?? 100}%)`,
                          transform: `translate(${(50 - (entry.cropX ?? 50)) * (((entry.cropScale ?? 100) / 100) - 1)}%, ${(50 - (entry.cropY ?? 50)) * (((entry.cropScale ?? 100) / 100) - 1)}%) scale(${(entry.cropScale ?? 100) / 100})`,
                          transformOrigin: "center",
                        }}
                      />
                    </span>
                  )}
                  {selected === entry.id &&
                    (entry.kind === "text" || entry.kind === "image") &&
                    !entry.locked && (
                      <button
                        className="text-resize-handle"
                        onPointerDown={(event) => resize(event, entry)}
                        aria-label="تغییر اندازه کادر متن"
                        title="تغییر اندازه کادر متن"
                      />
                    )}
                </div>
              ))}
            </div>
            {overlay && (
              <img
                className="design-overlay"
                src={overlay}
                alt="لایه رویی محصول"
              />
            )}
          </div>
        </div>
        <div className="design-bottom">
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
                  onClick={() => setColorId(color.id)}
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
      {cropOpen && item?.kind === "image" && item.src && (
        <div className="crop-dialog-backdrop" onPointerDown={()=>setCropOpen(false)}>
          <section className="crop-dialog" onPointerDown={(event)=>event.stopPropagation()}>
            <header><div><Crop/><h2>برش تصویر</h2></div><button type="button" onClick={()=>setCropOpen(false)}>×</button></header>
            <div className="crop-dialog-preview"><img src={item.src} alt="تصویر اصلی برای برش" style={{transform:`translate(${(50-cropDraft.x)*((cropDraft.scale/100)-1)}%,${(50-cropDraft.y)*((cropDraft.scale/100)-1)}%) scale(${cropDraft.scale/100})`}}/></div>
            <label>بزرگ‌نمایی<input type="range" min="100" max="400" value={cropDraft.scale} onChange={e=>setCropDraft(value=>({...value,scale:Number(e.target.value)}))}/></label>
            <label>جابه‌جایی افقی<input type="range" min="0" max="100" value={cropDraft.x} onChange={e=>setCropDraft(value=>({...value,x:Number(e.target.value)}))}/></label>
            <label>جابه‌جایی عمودی<input type="range" min="0" max="100" value={cropDraft.y} onChange={e=>setCropDraft(value=>({...value,y:Number(e.target.value)}))}/></label>
            <footer><button type="button" onClick={()=>setCropOpen(false)}>انصراف</button><button type="button" onClick={()=>{update({cropScale:cropDraft.scale,cropX:cropDraft.x,cropY:cropDraft.y});setCropOpen(false)}}>اعمال برش</button></footer>
          </section>
        </div>
      )}
      {phase !== "design" && (
        <div className="design-flow-back">
          <section className={`design-flow ${phase === "review" ? "review-flow" : ""}`}>
            <button className="close" onClick={() => setPhase("design")}>
              ×
            </button>
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
                          {offer.variants.length} تنوع موجود · آماده‌سازی{" "}
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
                    تأمین‌کننده تأییدشده با موجودی مثبت برای این محصول وجود
                    ندارد.
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
                <span>تنوع‌های قابل فروش</span>
                <h2>رنگ و سایزها را انتخاب کن</h2>
                <p>
                  طرح روی همه انتخاب‌ها ثابت می‌ماند؛ فقط تصویر محصول تغییر
                  می‌کند.
                </p>
                {variantStep==="colors" ? <>
                  <h3>۱. رنگ‌های موردنظر را انتخاب کنید</h3>
                  <div className="variant-choice-list fixed-variant-list">{raw.colors.filter(color=>availableVariants.some(variant=>variant.color_id===color.id)).map(color=><label key={color.id}><input type="checkbox" checked={selectedColorIds.includes(color.id)} onChange={()=>{const next=selectedColorIds.includes(color.id)?selectedColorIds.filter(id=>id!==color.id):[...selectedColorIds,color.id];syncVariants(next,selectedSizeIds)}}/><span><i style={{background:color.hex||"#ddd"}}/>{color.name}<Check/></span></label>)}</div>
                  <button disabled={!selectedColorIds.length} onClick={()=>setVariantStep("sizes")}>ادامه و انتخاب سایز <ChevronLeft/></button>
                </> : <>
                  <h3>۲. سایزهای موردنظر را انتخاب کنید</h3>
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
                <h2>حداکثر سه موکاپ تک‌نما انتخاب کن</h2>
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
                  <label>جنسیت
                    <select value={mockupGenderFilter} onChange={(event) => setMockupGenderFilter(event.target.value)}>
                      <option value="ALL">همه</option>
                      <option value="MALE">مردانه</option>
                      <option value="FEMALE">زنانه</option>
                      <option value="UNISEX">یونیسکس</option>
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
                                : current.length < 6
                                  ? [...current, mockup.id]
                                  : current,
                            )
                          }
                        >
                          <div>
                            {mockup.views[0]?.backgroundUrl && (
                              <img
                                src={mockup.views[0].backgroundUrl}
                                alt={mockup.name}
                              />
                            )}
                          </div>
                          <b>{mockup.name}</b>
                          <small>{raw.colors.find((color) => color.id === mockup.color_id)?.name || "—"} · {mockup.gender === "MALE" ? "مردانه" : mockup.gender === "FEMALE" ? "زنانه" : "یونیسکس"}</small>
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
                <button onClick={finish}>
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
