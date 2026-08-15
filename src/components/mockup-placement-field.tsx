/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { CheckCircle2, Eye, ImagePlus, LoaderCircle, RotateCw, TestTube2 } from "lucide-react";
import { DEFAULT_WARP_POINTS, parseArtworkClip, parseWarpPoints, WarpedArtwork, type ArtworkClip, type WarpPoint } from "@/components/warped-artwork";
import { saveAdminMockupTestImageAction } from "@/app/actions/dashboard";

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
  initialImage,
  initialTestImage,
  initial,
  resetImageSignal = 0,
}: {
  label: string;
  initialImage?: string | null;
  initialTestImage?: string | null;
  initial?: Placement;
  resetImageSignal?: number;
}) {
  const maxWidth = 1.8;
  const initialWidth = Math.min(
    maxWidth,
    Math.max(Math.min(0.08, maxWidth), Number(initial?.area_width || 0.4)),
  );
  const initialHeight = Number(initial?.area_height || 0.4);
  const [rect, setRect] = useState({
    x: Math.max(-initialWidth, Math.min(Number(initial?.area_x ?? 0.3), 1)),
    y: Math.max(-initialHeight, Math.min(Number(initial?.area_y ?? 0.2), 1)),
    width: initialWidth,
    height: initialHeight,
  });
  const [preview, setPreview] = useState(initialImage || "");
  const [imageData, setImageData] = useState("");
  const [testImage, setTestImage] = useState(initialTestImage || "");
  const [showTest, setShowTest] = useState(Boolean(initialTestImage));
  const [testMessage, setTestMessage] = useState("");
  const [savingTest, startSavingTest] = useTransition();
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
    setImageData("");
    if (fileRef.current) fileRef.current.value = "";
  }, [resetImageSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      const reader = new FileReader();
      reader.onload = () => setImageData(String(reader.result || ""));
      reader.readAsDataURL(file);
    }
  };
  const pickTest = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = event.target.files?.[0];
    if (!file) return;
    const temporary = URL.createObjectURL(file);
    setTestImage(temporary);
    setShowTest(true);
    setTestMessage("در حال ذخیره تصویر تست…");
    const formData = new FormData();
    const reader = new FileReader();
    reader.onload = () => {
      formData.set("testImageData", String(reader.result || ""));
      formData.set("testImageName", file.name);
      formData.set("testImageType", file.type);
      startSavingTest(async () => {
        const result = await saveAdminMockupTestImageAction(formData);
        if (result.ok && result.url) {
          setTestImage(result.url);
          setTestMessage(result.message);
          URL.revokeObjectURL(temporary);
        } else {
          setTestMessage(result.message);
        }
        input.value = "";
      });
    };
    reader.readAsDataURL(file);
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
    setRect((current) => {
      const nextHeight = Math.max(
        0.02,
        nextWidth * (current.height / current.width),
      );
      return {
        ...current,
        width: nextWidth,
        height: nextHeight,
        x: Math.max(-nextWidth, Math.min(current.x, 1)),
        y: Math.max(-nextHeight, Math.min(current.y, 1)),
      };
    });
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
            محدوده چاپ را جابه‌جا یا بزرگ و کوچک کن و نقاط پرسپکتیو را تنظیم کن.
          </small>
        </div>
        <div className="mockup-upload-actions">
          <label>
            <ImagePlus /> انتخاب تصویر موکاپ
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              required={!initialImage}
              onChange={pick}
            />
          </label>
          <label className="mockup-test-picker">
            {savingTest ? <LoaderCircle className="spin" /> : <TestTube2 />} تصویر تست
            <input type="file" accept="image/*" onChange={pickTest} disabled={savingTest} />
          </label>
        </div>
      </header>
      <div className="mockup-ratio-status">
        {testImage && <button type="button" onClick={() => setShowTest((value) => !value)}><Eye /> {showTest ? "پنهان‌کردن تست" : "نمایش تست"}</button>}
        {testMessage && <small>{savingTest ? <LoaderCircle className="spin" /> : <CheckCircle2 />}{testMessage}</small>}
      </div>
      <div className="mockup-placement-canvas" ref={ref}>
        {preview ? (
          <img src={preview} alt={label} />
        ) : (
          <span>تصویر موکاپ را انتخاب کن</span>
        )}
        <div
          className={`mockup-placement-area ${showTest && testImage ? "has-test" : ""}`}
          onPointerDown={drag}
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.width * 100}%`,
            height: `${rect.height * 100}%`,
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {showTest && testImage ? (
            <WarpedArtwork
              points={points}
              clip={artworkClip}
              style={{ inset: 0, width: "100%", height: "100%" }}
            >
              <div
                className="configured-object"
                style={{ inset: 0, width: "100%", height: "100%" }}
              >
                <img src={testImage} alt="پیش‌نمایش تصویر تست در محدوده طرح" />
              </div>
            </WarpedArtwork>
          ) : "محل طرح"}
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
      <input type="hidden" name="mockupImageData" value={imageData} />
      <input type="hidden" name="areaY" value={rect.y} />
      <input type="hidden" name="areaWidth" value={rect.width} />
      <input type="hidden" name="areaHeight" value={rect.height} />
      <input type="hidden" name="rotation" value={rotation} />
      <input type="hidden" name="perspectivePoints" value={JSON.stringify(points)} />
      <input type="hidden" name="artworkClip" value={artworkClip} />
      <small className="mockup-warp-help">برای خم‌کردن یا تغییر پرسپکتیو، Ctrl را نگه دارید و یکی از ۸ نقطه را بکشید.</small>
      <button className="mockup-warp-reset" type="button" onClick={()=>setPoints(DEFAULT_WARP_POINTS.map(point=>({...point})))}>بازنشانی پرسپکتیو</button>
    </section>
  );
}
