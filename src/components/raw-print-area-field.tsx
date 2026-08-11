/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ImagePlus, MoveDiagonal2 } from "lucide-react";

type Rect = { x: number; y: number; width: number; height: number };

export function RawPrintAreaField({
  side,
  label,
  initial,
  initialImageUrl,
  required = false,
}: {
  side: "front" | "back";
  label: string;
  initial?: Partial<Rect>;
  initialImageUrl?: string | null;
  required?: boolean;
}) {
  const [rect, setRect] = useState<Rect>({
    x: Number(initial?.x ?? 0.3),
    y: Number(initial?.y ?? 0.2),
    width: Number(initial?.width ?? 0.4),
    height: Number(initial?.height ?? 0.55),
  });
  const [preview, setPreview] = useState(initialImageUrl || "");
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPreview((current) =>
      current.startsWith("blob:") ? current : initialImageUrl || "",
    );
  }, [initialImageUrl]);
  useEffect(
    () => () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };
  const interact = (event: ReactPointerEvent, mode: "move" | "resize") => {
    const box = boxRef.current;
    if (!box) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const bounds = box.getBoundingClientRect(),
      startX = event.clientX,
      startY = event.clientY,
      start = rect;
    const move = (next: PointerEvent) => {
      const dx = (next.clientX - startX) / bounds.width,
        dy = (next.clientY - startY) / bounds.height;
      setRect(
        mode === "move"
          ? {
              ...start,
              x: Math.max(0, Math.min(1 - start.width, start.x + dx)),
              y: Math.max(0, Math.min(1 - start.height, start.y + dy)),
            }
          : {
              ...start,
              width: Math.max(0.08, Math.min(1 - start.x, start.width + dx)),
              height: Math.max(0.08, Math.min(1 - start.y, start.height + dy)),
            },
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <section className="raw-print-picker">
      <div className="raw-print-picker-head">
        <div>
          <b>{label}</b>
          <span>کادر بنفش همان محدوده قابل طراحی و چاپ است.</span>
        </div>
        <label>
          <ImagePlus /> انتخاب تصویر
          <input
            name={`${side}Background`}
            type="file"
            accept="image/*"
            required={required}
            onChange={pick}
          />
        </label>
      </div>
      <div
        ref={boxRef}
        className="raw-print-picker-canvas"
        style={{ aspectRatio: imageRatio || "3 / 4" }}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalWidth && image.naturalHeight)
                setImageRatio(image.naturalWidth / image.naturalHeight);
            }}
          />
        ) : (
          <div>
            <ImagePlus />
            <span>برای تنظیم دقیق، تصویر {label} را انتخاب کن</span>
          </div>
        )}
        <div
          className="raw-print-picker-rect"
          onPointerDown={(event) => interact(event, "move")}
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.width * 100}%`,
            height: `${rect.height * 100}%`,
          }}
        >
          <span>محدوده چاپ</span>
          <i
            onPointerDown={(event) => {
              event.stopPropagation();
              interact(event, "resize");
            }}
          >
            <MoveDiagonal2 />
          </i>
        </div>
      </div>
      <input type="hidden" name={`${side}X`} value={rect.x} />
      <input type="hidden" name={`${side}Y`} value={rect.y} />
      <input type="hidden" name={`${side}Width`} value={rect.width} />
      <input type="hidden" name={`${side}Height`} value={rect.height} />
    </section>
  );
}
