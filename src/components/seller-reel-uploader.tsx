"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Film, Link2, UploadCloud } from "lucide-react";

type Product = { id: string; title: string; slug: string };
type ExistingReel = { id: string; caption: string; status: string; media: string; productTitle: string; rejection_reason?: string | null };
type VideoMeta = { duration: number; width: number; height: number };

function videoMetadata(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => { const meta = { duration: video.duration, width: video.videoWidth, height: video.videoHeight }; URL.revokeObjectURL(url); resolve(meta); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("اطلاعات ویدیو خوانده نشد.")); };
    video.src = url;
  });
}

async function prepareVideo(source: File, meta: VideoMeta): Promise<{ file: File; meta: VideoMeta }> {
  if (meta.width <= 720 && meta.height <= 1280) return { file: source, meta };
  if (typeof MediaRecorder === "undefined") throw new Error("این مرورگر امکان آماده‌سازی این ویدیو را ندارد؛ از Chrome یا Edge جدید استفاده کنید.");
  const video = document.createElement("video");
  const url = URL.createObjectURL(source);
  video.src = url; video.preload = "auto"; video.muted = true; video.playsInline = true;
  await new Promise<void>((resolve, reject) => { video.oncanplay = () => resolve(); video.onerror = () => reject(new Error("ویدیو قابل پردازش نیست.")); });
  const scale = Math.min(720 / meta.width, 1280 / meta.height);
  const width = Math.max(2, Math.round(meta.width * scale / 2) * 2), height = Math.max(2, Math.round(meta.height * scale / 2) * 2);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d"); if (!context) throw new Error("آماده‌سازی ویدیو ممکن نیست.");
  const stream = canvas.captureStream(30);
  const capture = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
  capture?.getAudioTracks().forEach((track) => stream.addTrack(track));
  const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error("آماده‌سازی ویدیو کامل نشد."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
  });
  let frame = 0;
  const draw = () => { context.drawImage(video, 0, 0, width, height); if (!video.ended) frame = requestAnimationFrame(draw); };
  recorder.start(1000); await video.play(); draw();
  await new Promise<void>((resolve) => { video.onended = () => resolve(); });
  cancelAnimationFrame(frame); if (recorder.state !== "inactive") recorder.stop();
  const blob = await finished; stream.getTracks().forEach((track) => track.stop()); URL.revokeObjectURL(url);
  return { file: new File([blob], source.name.replace(/\.[^.]+$/, "") + ".webm", { type: "video/webm" }), meta: { duration: meta.duration, width, height } };
}

function uploadWithProgress(url: string, file: File, progress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open("PUT", url); xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) progress(event.loaded * 100 / event.total); };
    xhr.onerror = () => reject(new Error("ارتباط هنگام آپلود قطع شد."));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`آپلود ناموفق بود (کد ${xhr.status}).`));
    const data = new FormData(); data.append("cacheControl", "3600"); data.append("", file); xhr.send(data);
  });
}

export function SellerReelUploader({ products, reels }: { products: Product[]; reels: ExistingReel[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [phase, setPhase] = useState(""), [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (!busy) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [busy]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return; setMessage("");
    const form = event.currentTarget, source = (form.elements.namedItem("video") as HTMLInputElement).files?.[0];
    const productIds = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="productIds"]:checked')).map((item) => item.value);
    if (!source || !productIds.length) { setMessage("یک ویدیو و حداقل یک محصول انتخاب کنید."); return; }
    if (productIds.length > 10) { setMessage("حداکثر ۱۰ محصول را می‌توانید به یک ویدیو متصل کنید."); return; }
    if (source.size > 100 * 1024 * 1024) { setMessage("حجم ویدیو نباید بیشتر از ۱۰۰ مگابایت باشد."); return; }
    setBusy(true); setProgress(2); setPhase("در حال آماده‌سازی ویدیو…");
    try {
      const originalMeta = await videoMetadata(source);
      if (!(originalMeta.duration > 0 && originalMeta.duration <= 60.5)) throw new Error("مدت ویدیو باید کمتر از یک دقیقه باشد.");
      if (originalMeta.height <= originalMeta.width) throw new Error("ویدیو باید عمودی باشد.");
      const prepared = await prepareVideo(source, originalMeta); setProgress(20); setPhase("در حال آپلود؛ لطفاً این صفحه را نبندید…");
      const tokenResponse = await fetch("/api/reels/upload-token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: prepared.file.name, type: prepared.file.type, size: prepared.file.size }) });
      const token = await tokenResponse.json() as { signedUrl?: string; path?: string; message?: string };
      if (!tokenResponse.ok || !token.signedUrl || !token.path) throw new Error(token.message || "مسیر آپلود ساخته نشد.");
      await uploadWithProgress(token.signedUrl, prepared.file, (value) => setProgress(20 + value * .75));
      setProgress(96); setPhase("در حال ثبت نهایی…");
      const completeResponse = await fetch("/api/reels/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        path: token.path, productIds, caption: new FormData(form).get("caption"),
        tags: String(new FormData(form).get("tags") || "").split(/[،,]/), socialUrl: new FormData(form).get("socialUrl"),
        ...prepared.meta, size: prepared.file.size, mimeType: prepared.file.type, originalName: prepared.file.name,
      }) });
      const result = await completeResponse.json() as { message?: string };
      if (!completeResponse.ok) throw new Error(result.message || "ثبت نهایی انجام نشد.");
      setProgress(100); setPhase("ارسال شد"); setMessage(result.message || "ویدیو برای بررسی ارسال شد."); form.reset(); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "آپلود انجام نشد."); setProgress(0); setPhase(""); }
    finally { setBusy(false); }
  };
  return <div className="seller-reels-manager"><section className="seller-reel-upload-card"><div className="reel-upload-title"><UploadCloud/><div><h2>آپلود ویدیوی عمودی</h2><p>کمتر از یک دقیقه، حداکثر ۱۰۰ مگابایت</p></div></div><form ref={formRef} onSubmit={submit} className="seller-reel-form">
    <label className="reel-file-picker"><Film/><span>انتخاب ویدیو</span><small>MP4، MOV یا WebM · ویدیوی عمودی</small><input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" required disabled={busy}/></label>
    <label><span>توضیح کوتاه <small>(اختیاری)</small></span><textarea name="caption" maxLength={1500} rows={3}/></label>
    <label><span>تگ‌ها <small>(اختیاری، با ویرگول جدا کنید)</small></span><input name="tags" maxLength={400} placeholder="تیشرت، طراحی، هدیه"/></label>
    <label><span>لینک شبکه اجتماعی <small>(اختیاری)</small></span><div className="reel-social-input"><Link2/><input name="socialUrl" type="url" placeholder="https://instagram.com/..."/></div><small>افزودن لینک، شانس دیده‌شدن ویدیوی شما در چاپلی را بیشتر می‌کند.</small></label>
    <fieldset><legend>محصولات داخل ویدیو *</legend><p>حداقل یک محصول و حداکثر ۱۰ محصول انتخاب کنید.</p><div className="reel-product-checks">{products.map((product) => <label key={product.id}><input type="checkbox" name="productIds" value={product.id}/><span>{product.title}</span></label>)}</div></fieldset>
    {busy && <div className="reel-upload-progress" role="status"><div><i style={{ width: `${progress}%` }}/></div><b>{Math.round(progress).toLocaleString("fa-IR")}٪</b><span>{phase}</span><small>تا پایان کار این صفحه را نبندید یا تازه‌سازی نکنید.</small></div>}
    {message && <p className={progress === 100 ? "reel-upload-message success" : "reel-upload-message"}>{progress === 100 && <CheckCircle2/>}{message}</p>}
    <button className="sd-primary" disabled={busy || !products.length}>{busy ? "در حال ارسال…" : "ارسال برای بررسی"}</button>
  </form></section><section className="seller-reel-list"><h2>ویدیوهای شما</h2>{reels.length ? reels.map((reel) => <article key={reel.id}><video src={reel.media} muted playsInline preload="metadata"/><div><b>{reel.caption || reel.productTitle}</b><span>{reel.productTitle}</span><em className={`reel-status ${reel.status.toLowerCase()}`}>{reel.status === "PENDING" ? "در انتظار بررسی" : reel.status === "PUBLISHED" ? "منتشرشده" : reel.status === "REJECTED" ? "ردشده" : reel.status}</em>{reel.rejection_reason && <small>{reel.rejection_reason}</small>}</div></article>) : <p>هنوز ویدیویی ارسال نکرده‌اید.</p>}</section></div>;
}
