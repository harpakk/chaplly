"use client";

import Image, { type ImageProps } from "next/image";
import { type ImgHTMLAttributes, useEffect, useMemo, useRef, useState } from "react";

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

function retrySource(source: string, attempt: number) {
  if (!source || !attempt || source.startsWith("data:") || source.startsWith("blob:")) return source;
  const separator = source.includes("?") ? "&" : "?";
  return `${source}${separator}chapli_retry=${attempt}`;
}

function useImageRetry(source: string) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [source]);
  useEffect(() => {
    if (!failed) return;
    const retry = () => {
      if (timer.current) clearTimeout(timer.current);
      setAttempt((value) => value + 1);
      setFailed(false);
    };
    timer.current = setTimeout(retry, RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]);
    window.addEventListener("online", retry, { once: true });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("online", retry);
    };
  }, [attempt, failed]);
  return { src: useMemo(() => retrySource(source, attempt), [attempt, source]), retry: () => setFailed(true), loaded: () => setFailed(false) };
}

export function ResilientImage({ src, alt, onError, onLoad, ...props }: ImageProps) {
  const source =
    typeof src === "string"
      ? src
      : src instanceof Blob
        ? ""
        : "src" in src
          ? src.src
          : src.default.src;
  const retry = useImageRetry(source);
  return <Image {...props} src={retry.src || src} alt={alt} onError={(event) => { retry.retry(); onError?.(event); }} onLoad={(event) => { retry.loaded(); onLoad?.(event); }} />;
}

export function ResilientImg({ src = "", alt = "", onError, onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const retry = useImageRetry(typeof src === "string" ? src : "");
  // eslint-disable-next-line @next/next/no-img-element -- used by the rasterizing design renderer
  return <img {...props} src={retry.src || src} alt={alt} onError={(event) => { retry.retry(); onError?.(event); }} onLoad={(event) => { retry.loaded(); onLoad?.(event); }} />;
}
