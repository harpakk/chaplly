/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ImagePlus, RotateCw } from "lucide-react";
import { DEFAULT_WARP_POINTS, parseArtworkClip, parseWarpPoints, type ArtworkClip, type WarpPoint } from "@/components/warped-artwork";

type Placement = {
  area_x: number;
  area_y: number;
  area_width: number;
  area_height: number;
  rotation_degrees: number;
  perspective_points?: unknown;
  artwork_clip?: unknown;
};

export function MockupPlacementField({
  label,
  ratio,
  initialImage,
  initial,
  resetImageSignal = 0,
}: {
  label: string;
  ratio: number;
  initialImage?: string | null;
  initial?: Placement;
  resetImageSignal?: number;
}) {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const maxWidth = Math.min(1.8, 1.8 * safeRatio);
  const initialWidth = Math.min(
    maxWidth,
    Math.max(Math.min(0.08, maxWidth), Number(initial?.area_width || 0.4)),
  );
  const initialHeight = initialWidth / safeRatio;
  const [rect, setRect] = useState({
    x: Math.max(-initialWidth, Math.min(Number(initial?.area_x ?? 0.3), 1)),
    y: Math.max(-initialHeight, Math.min(Number(initial?.area_y ?? 0.2), 1)),
    width: initialWidth,
    height: initialHeight,
  });
  const [preview, setPreview] = useState(initialImage || "");
  const [rotation, setRotation] = useState(
    Number(initial?.rotation_degrees || 0),
  );
  const [points, setPoints] = useState<WarpPoint[]>(() =>
    parseWarpPoints(initial?.perspective_points).map((point) => ({ ...point })),
  );
  const [artworkClip, setArtworkClip] = useState<ArtworkClip>(() =>
    parseArtworkClip(initial?.artwork_clip),
  );
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!resetImageSignal) return;
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }, [resetImageSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
    }
  };
  const drag = (event: ReactPointerEvent) => {
    const box = ref.current;
    if (!box) return;
    event.preventDefault();
    const bounds = box.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = rect;
    const move = (next: PointerEvent) =>
      setRect({
        ...start,
        x: Math.max(
          -start.width,
          Math.min(
            1,
            start.x + (next.clientX - startX) / bounds.width,
          ),
        ),
        y: Math.max(
          -start.height,
          Math.min(
            1,
            start.y + (next.clientY - startY) / bounds.height,
          ),
        ),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const scale = (width: number) => {
    const nextWidth = Math.max(
      Math.min(0.08, maxWidth),
      Math.min(maxWidth, width),
    );
    const nextHeight = nextWidth / safeRatio;
    setRect((current) => ({
      ...current,
      width: nextWidth,
      height: nextHeight,
      x: Math.max(-nextWidth, Math.min(current.x, 1)),
      y: Math.max(-nextHeight, Math.min(current.y, 1)),
    }));
  };
  const warp = (index: number, event: ReactPointerEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault(); event.stopPropagation();
    const area = (event.currentTarget as HTMLElement).closest(".mockup-warp-controls") as HTMLElement | null;
    if (!area) return;
    const bounds=area.getBoundingClientRect(),startX=event.clientX,startY=event.clientY,start=points[index],radians=-rotation*Math.PI/180;
    const ranges=[[-.35,.45,-.35,.45],[.15,.85,-.35,.45],[.55,1.35,-.35,.45],[.55,1.35,.15,.85],[.55,1.35,.55,1.35],[.15,.85,.55,1.35],[-.35,.45,.55,1.35],[-.35,.45,.15,.85]];
    const [minX,maxX,minY,maxY]=ranges[index];
    const move=(next:PointerEvent)=>{const sx=(next.clientX-startX)/bounds.width,sy=(next.clientY-startY)/bounds.height;const dx=sx*Math.cos(radians)-sy*Math.sin(radians),dy=sx*Math.sin(radians)+sy*Math.cos(radians);setPoints(current=>current.map((point,i)=>i===index?{x:Math.max(minX,Math.min(maxX,start.x+dx)),y:Math.max(minY,Math.min(maxY,start.y+dy))}:point))};
    const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)};
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);
  };
  const path=`M ${points[0].x*100} ${points[0].y*100} Q ${points[1].x*100} ${points[1].y*100} ${points[2].x*100} ${points[2].y*100} Q ${points[3].x*100} ${points[3].y*100} ${points[4].x*100} ${points[4].y*100} Q ${points[5].x*100} ${points[5].y*100} ${points[6].x*100} ${points[6].y*100} Q ${points[7].x*100} ${points[7].y*100} ${points[0].x*100} ${points[0].y*100} Z`;

  return (
    <section className="mockup-placement-field">
      <header>
        <div>
          <b>{label}</b>
          <small>
            نسبت دقیق محدوده چاپ محصول قفل است؛ فقط جابه‌جا یا بزرگ و کوچک کن.
          </small>
        </div>
        <label>
          <ImagePlus /> انتخاب تصویر موکاپ
          <input
            ref={fileRef}
            name="mockupImage"
            type="file"
            accept="image/*"
            required={!initialImage}
            onChange={pick}
          />
        </label>
      </header>
      <div className="mockup-placement-canvas" ref={ref}>
        {preview ? (
          <img src={preview} alt={label} />
        ) : (
          <span>تصویر موکاپ را انتخاب کن</span>
        )}
        <div
          className="mockup-placement-area"
          onPointerDown={drag}
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.width * 100}%`,
            height: `${rect.height * 100}%`,
            transform: `rotate(${rotation}deg)`,
            clipPath: {
              FULL: "none",
              TOP: "inset(0 0 50% 0)",
              BOTTOM: "inset(50% 0 0 0)",
              LEFT: "inset(0 50% 0 0)",
              RIGHT: "inset(0 0 0 50%)",
            }[artworkClip],
          }}
        >
          محل طرح
        </div>
        <div className="mockup-warp-controls" style={{left:`${rect.x*100}%`,top:`${rect.y*100}%`,width:`${rect.width*100}%`,height:`${rect.height*100}%`,transform:`rotate(${rotation}deg)`}}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d={path}/></svg>
          {points.map((point,index)=><button type="button" aria-label={`نقطه تغییر شکل ${index+1}`} title="Ctrl را نگه دارید و بکشید" key={index} onPointerDown={(event)=>warp(index,event)} style={{left:`${point.x*100}%`,top:`${point.y*100}%`}} />)}
        </div>
      </div>
      <div className="mockup-artwork-clip" role="group" aria-label="بخش قابل نمایش طرح">
        {([
          ["FULL", "کامل"],
          ["TOP", "نیمه بالا"],
          ["BOTTOM", "نیمه پایین"],
          ["LEFT", "نیمه چپ"],
          ["RIGHT", "نیمه راست"],
        ] as Array<[ArtworkClip, string]>).map(([value, text]) => (
          <button
            key={value}
            type="button"
            className={artworkClip === value ? "active" : ""}
            onClick={() => setArtworkClip(value)}
          >
            {text}
          </button>
        ))}
      </div>
      <label className="mockup-scale">
        اندازه محدوده
        <input
          type="range"
          min={Math.min(8, maxWidth * 100)}
          max={maxWidth * 100}
          step="0.1"
          value={rect.width * 100}
          onChange={(event) => scale(Number(event.target.value) / 100)}
        />
        <b>{Math.round(rect.width * 100)}%</b>
      </label>
      <label className="mockup-scale">
        <span>
          <RotateCw /> چرخش
        </span>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={rotation}
          onChange={(event) => setRotation(Number(event.target.value))}
        />
        <b>{rotation}°</b>
      </label>
      <input type="hidden" name="areaX" value={rect.x} />
      <input type="hidden" name="areaY" value={rect.y} />
      <input type="hidden" name="areaWidth" value={rect.width} />
      <input type="hidden" name="rotation" value={rotation} />
      <input type="hidden" name="perspectivePoints" value={JSON.stringify(points)} />
      <input type="hidden" name="artworkClip" value={artworkClip} />
      <small className="mockup-warp-help">برای خم‌کردن یا تغییر پرسپکتیو، Ctrl را نگه دارید و یکی از ۸ نقطه را بکشید.</small>
      <button className="mockup-warp-reset" type="button" onClick={()=>setPoints(DEFAULT_WARP_POINTS.map(point=>({...point})))}>بازنشانی پرسپکتیو</button>
    </section>
  );
}
