import type { CSSProperties } from "react";

type ArtworkCrop = {
  cropScale?: unknown;
  cropX?: unknown;
  cropY?: unknown;
  cropLeft?: unknown;
  cropTop?: unknown;
  cropWidth?: unknown;
  cropHeight?: unknown;
};

const number = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const hasManualArtworkCrop = (entry: ArtworkCrop) =>
  entry.cropLeft != null &&
  entry.cropTop != null &&
  entry.cropWidth != null &&
  entry.cropHeight != null &&
  number(entry.cropWidth, 0) > 0 &&
  number(entry.cropHeight, 0) > 0;

export function croppedArtworkImageStyle(entry: ArtworkCrop): CSSProperties {
  if (hasManualArtworkCrop(entry)) {
    const left = number(entry.cropLeft, 0);
    const top = number(entry.cropTop, 0);
    const width = number(entry.cropWidth, 100);
    const height = number(entry.cropHeight, 100);
    return {
      position: "absolute",
      maxWidth: "none",
      width: `${10000 / width}%`,
      height: `${10000 / height}%`,
      left: `${(-left / width) * 100}%`,
      top: `${(-top / height) * 100}%`,
      objectFit: "fill",
      transform: "none",
      transformOrigin: "center",
    };
  }
  const scale = number(entry.cropScale, 100) / 100;
  return {
    transform: `translate(${(50 - number(entry.cropX, 50)) * (scale - 1)}%, ${(50 - number(entry.cropY, 50)) * (scale - 1)}%) scale(${scale})`,
    transformOrigin: "center",
  };
}
