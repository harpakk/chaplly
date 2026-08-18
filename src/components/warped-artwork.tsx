"use client";

import {
  CSSProperties,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toCanvas } from "html-to-image";

export type WarpPoint = { x: number; y: number };
export type ArtworkClip = "FULL" | "TOP" | "BOTTOM" | "LEFT" | "RIGHT";

export function parseArtworkClip(value: unknown): ArtworkClip {
  return ["TOP", "BOTTOM", "LEFT", "RIGHT"].includes(String(value))
    ? (String(value) as ArtworkClip)
    : "FULL";
}

const clipPathFor = (clip: ArtworkClip) =>
  ({
    FULL: "none",
    TOP: "inset(0 0 50% 0)",
    BOTTOM: "inset(50% 0 0 0)",
    LEFT: "inset(0 50% 0 0)",
    RIGHT: "inset(0 0 0 50%)",
  })[clip];

export const DEFAULT_WARP_POINTS: WarpPoint[] = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 0.5 },
  { x: 1, y: 1 },
  { x: 0.5, y: 1 },
  { x: 0, y: 1 },
  { x: 0, y: 0.5 },
];

const MAX_CONCURRENT_MOCKUP_RENDERS = 6;
let activeMockupRenders = 0;
const mockupRenderQueue: Array<() => void> = [];
const acquireMockupRenderSlot = () =>
  new Promise<() => void>((resolve) => {
    const start = () => {
      activeMockupRenders += 1;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        activeMockupRenders = Math.max(0, activeMockupRenders - 1);
        mockupRenderQueue.shift()?.();
      });
    };
    if (activeMockupRenders < MAX_CONCURRENT_MOCKUP_RENDERS) start();
    else mockupRenderQueue.push(start);
  });

export function parseWarpPoints(value: unknown): WarpPoint[] {
  let points = value;
  if (typeof points === "string") {
    try {
      points = JSON.parse(points);
    } catch {
      return DEFAULT_WARP_POINTS;
    }
  }
  if (!Array.isArray(points) || points.length !== 8) {
    return DEFAULT_WARP_POINTS;
  }
  const parsed = points.map((point) => ({
    x: Number(point?.x),
    y: Number(point?.y),
  }));
  return parsed.every(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  )
    ? parsed
    : DEFAULT_WARP_POINTS;
}

const quadratic = (a: WarpPoint, b: WarpPoint, c: WarpPoint, t: number) => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * b.x + t ** 2 * c.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * b.y + t ** 2 * c.y,
});

const surface = (points: WarpPoint[], u: number, v: number) => {
  const top = quadratic(points[0], points[1], points[2], u);
  const right = quadratic(points[2], points[3], points[4], v);
  const bottom = quadratic(points[6], points[5], points[4], u);
  const left = quadratic(points[0], points[7], points[6], v);
  const bilinear = {
    x:
      (1 - u) * (1 - v) * points[0].x +
      u * (1 - v) * points[2].x +
      u * v * points[4].x +
      (1 - u) * v * points[6].x,
    y:
      (1 - u) * (1 - v) * points[0].y +
      u * (1 - v) * points[2].y +
      u * v * points[4].y +
      (1 - u) * v * points[6].y,
  };
  return {
    x: (1 - v) * top.x + v * bottom.x + (1 - u) * left.x + u * right.x - bilinear.x,
    y: (1 - v) * top.y + v * bottom.y + (1 - u) * left.y + u * right.y - bilinear.y,
  };
};

function solve(matrix: number[][]) {
  for (let column = 0; column < 8; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 8; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) {
        pivot = row;
      }
    }
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    if (Math.abs(divisor) < 0.00000001) return null;
    for (let cell = column; cell < 9; cell += 1) matrix[column][cell] /= divisor;
    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let cell = column; cell < 9; cell += 1) {
        matrix[row][cell] -= factor * matrix[column][cell];
      }
    }
  }
  return matrix.map((row) => row[8]);
}

function homography(source: WarpPoint[], target: WarpPoint[]) {
  const rows: number[][] = [];
  for (let index = 0; index < 4; index += 1) {
    const { x, y } = source[index];
    const { x: targetX, y: targetY } = target[index];
    rows.push(
      [x, y, 1, 0, 0, 0, -targetX * x, -targetX * y, targetX],
      [0, 0, 0, x, y, 1, -targetY * x, -targetY * y, targetY],
    );
  }
  const values = solve(rows);
  if (!values) return "none";
  const [a, b, c, d, e, f, g, h] = values;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
}

const isWarped = (points: WarpPoint[]) =>
  points.some(
    (point, index) =>
      Math.abs(point.x - DEFAULT_WARP_POINTS[index].x) > 0.0001 ||
      Math.abs(point.y - DEFAULT_WARP_POINTS[index].y) > 0.0001,
  );

async function rasterizeArtwork(
  source: HTMLDivElement,
  width: number,
  height: number,
  clip: ArtworkClip,
) {
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  try {
    const snapshot = await toCanvas(source, {
      width,
      height,
      pixelRatio,
      cacheBust: false,
      backgroundColor: "transparent",
      style: {
        position: "relative",
        inset: "auto",
        zIndex: "0",
        opacity: "1",
        overflow: "hidden",
        clipPath: clipPathFor(clip),
      },
    });
    if (snapshot.width && snapshot.height) return snapshot;
  } catch {
    // The manual renderer below keeps previews available if DOM capture fails.
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.scale(pixelRatio, pixelRatio);
  context.beginPath();
  if (clip === "TOP") context.rect(0, 0, width, height / 2);
  else if (clip === "BOTTOM") context.rect(0, height / 2, width, height / 2);
  else if (clip === "LEFT") context.rect(0, 0, width / 2, height);
  else if (clip === "RIGHT") context.rect(width / 2, 0, width / 2, height);
  else context.rect(0, 0, width, height);
  context.clip();
  for (const object of Array.from(
    source.querySelectorAll<HTMLElement>(".configured-object"),
  )) {
    const objectStyle = getComputedStyle(object);
    const x = object.offsetLeft;
    const y = object.offsetTop;
    const objectWidth = object.offsetWidth;
    const objectHeight = object.offsetHeight;
    if (!objectWidth || !objectHeight) continue;
    context.save();
    context.globalAlpha = Number(objectStyle.opacity || 1);
    if (objectStyle.transform && objectStyle.transform !== "none") {
      const objectMatrix = new DOMMatrix(objectStyle.transform);
      context.translate(x + objectWidth / 2, y + objectHeight / 2);
      context.transform(
        objectMatrix.a,
        objectMatrix.b,
        objectMatrix.c,
        objectMatrix.d,
        objectMatrix.e,
        objectMatrix.f,
      );
      context.translate(-(x + objectWidth / 2), -(y + objectHeight / 2));
    }
    const image = object.querySelector<HTMLImageElement>("img");
    if (image?.src) {
      let bitmap: ImageBitmap | HTMLImageElement = image;
      let closeBitmap: () => void = () => {};
      try {
        const response = await fetch(image.currentSrc || image.src);
        if (!response.ok) throw new Error("WARP_IMAGE_FETCH_FAILED");
        const fetchedBitmap = await createImageBitmap(await response.blob());
        bitmap = fetchedBitmap;
        closeBitmap = () => fetchedBitmap.close();
      } catch {
        await image.decode().catch(() => undefined);
      }
      const bitmapWidth =
        bitmap instanceof ImageBitmap ? bitmap.width : bitmap.naturalWidth;
      const bitmapHeight =
        bitmap instanceof ImageBitmap ? bitmap.height : bitmap.naturalHeight;
      if (!bitmapWidth || !bitmapHeight) {
        context.restore();
        continue;
      }
      if (image.dataset.manualCrop === "true") {
        context.beginPath();
        context.rect(x, y, objectWidth, objectHeight);
        context.clip();
        context.filter = getComputedStyle(image).filter;
        context.drawImage(
          bitmap,
          x + image.offsetLeft,
          y + image.offsetTop,
          image.offsetWidth,
          image.offsetHeight,
        );
        closeBitmap();
        context.restore();
        continue;
      }
      const fit = Math.min(objectWidth / bitmapWidth, objectHeight / bitmapHeight);
      const drawWidth = bitmapWidth * fit;
      const drawHeight = bitmapHeight * fit;
      const drawX = x + (objectWidth - drawWidth) / 2;
      const drawY = y + (objectHeight - drawHeight) / 2;
      const cropWrapper = image.parentElement?.classList.contains(
        "cropped-artwork-image",
      )
        ? image.parentElement
        : null;
      const transformNode =
        cropWrapper && getComputedStyle(cropWrapper).transform !== "none"
          ? cropWrapper
          : image;
      const imageStyle = getComputedStyle(image);
      const transformStyle = getComputedStyle(transformNode).transform;
      context.filter = imageStyle.filter === "none" ? "none" : imageStyle.filter;
      if (transformStyle && transformStyle !== "none") {
        const matrix = new DOMMatrix(transformStyle);
        context.translate(x + objectWidth / 2, y + objectHeight / 2);
        context.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
        context.translate(-(x + objectWidth / 2), -(y + objectHeight / 2));
      }
      context.drawImage(bitmap, drawX, drawY, drawWidth, drawHeight);
      closeBitmap();
    } else if (object.textContent?.trim()) {
      context.fillStyle = objectStyle.color;
      context.font = `${objectStyle.fontSize} ${objectStyle.fontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        object.textContent.trim(),
        x + objectWidth / 2,
        y + objectHeight / 2,
        objectWidth,
      );
    } else if (
      objectStyle.backgroundColor &&
      objectStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
    ) {
      context.fillStyle = objectStyle.backgroundColor;
      context.fillRect(x, y, objectWidth, objectHeight);
    }
    context.restore();
  }
  return canvas;
}

function drawCurvedSurface(
  canvas: HTMLCanvasElement,
  textureCanvas: HTMLCanvasElement,
  points: WarpPoint[],
  width: number,
  height: number,
) {
  const padding = 0.35;
  const scale = 1 + padding * 2;
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(width * scale * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * scale * pixelRatio));
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    // Render the complete indexed mesh in one GPU draw. Shared vertices are
    // rasterized once, so no horizontal, vertical, or diagonal cell borders
    // can appear. Keep the canvas-triangle renderer below as a safe fallback.
    const meshCanvas = document.createElement("canvas");
    meshCanvas.width = canvas.width;
    meshCanvas.height = canvas.height;
    try {
      const gl = meshCanvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
      });
      if (gl) {
        const compile = (type: number, shaderSource: string) => {
          const shader = gl.createShader(type);
          if (!shader) return null;
          gl.shaderSource(shader, shaderSource);
          gl.compileShader(shader);
          return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
        };
        const vertex = compile(
          gl.VERTEX_SHADER,
          "attribute vec2 p;attribute vec2 t;varying vec2 v;void main(){gl_Position=vec4(p,0.,1.);v=t;}",
        );
        const fragment = compile(
          gl.FRAGMENT_SHADER,
          "precision mediump float;uniform sampler2D image;varying vec2 v;void main(){gl_FragColor=texture2D(image,v);}",
        );
        const program = vertex && fragment ? gl.createProgram() : null;
        if (program && vertex && fragment) {
          gl.attachShader(program, vertex);
          gl.attachShader(program, fragment);
          gl.linkProgram(program);
          if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.useProgram(program);
            const meshDivisions = 24;
            const vertices: number[] = [];
            const indexes: number[] = [];
            for (let row = 0; row <= meshDivisions; row += 1) {
              for (let column = 0; column <= meshDivisions; column += 1) {
                const u = column / meshDivisions;
                const v = row / meshDivisions;
                const warped = surface(points, u, v);
                const x = (warped.x + padding) / scale;
                const y = (warped.y + padding) / scale;
                vertices.push(x * 2 - 1, 1 - y * 2, u, 1 - v);
              }
            }
            for (let row = 0; row < meshDivisions; row += 1) {
              for (let column = 0; column < meshDivisions; column += 1) {
                const first = row * (meshDivisions + 1) + column;
                const next = first + meshDivisions + 1;
                indexes.push(first, next, first + 1, first + 1, next, next + 1);
              }
            }
            const vertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
            const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
            const positionLocation = gl.getAttribLocation(program, "p");
            const textureLocation = gl.getAttribLocation(program, "t");
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(textureLocation);
            gl.vertexAttribPointer(
              textureLocation,
              2,
              gl.FLOAT,
              false,
              stride,
              2 * Float32Array.BYTES_PER_ELEMENT,
            );
            const indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexes), gl.STATIC_DRAW);
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              gl.RGBA,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              textureCanvas,
            );
            gl.viewport(0, 0, meshCanvas.width, meshCanvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.disable(gl.BLEND);
            gl.drawElements(gl.TRIANGLES, indexes.length, gl.UNSIGNED_SHORT, 0);
            if (gl.getError() === gl.NO_ERROR) {
              context.drawImage(meshCanvas, 0, 0);
              return true;
            }
          }
        }
      }
    } catch {
      // Some cross-origin textures cannot be uploaded to WebGL; use the
      // expanded canvas mesh below without breaking the preview.
    }

    const divisions = 18;
    const sourceWidth = textureCanvas.width;
    const sourceHeight = textureCanvas.height;
    const destination = (u: number, v: number) => {
      const warped = surface(points, u, v);
      return {
        x: (warped.x + padding) * width * pixelRatio,
        y: (warped.y + padding) * height * pixelRatio,
      };
    };
    const drawTriangle = (
      source: Array<{ x: number; y: number }>,
      target: Array<{ x: number; y: number }>,
    ) => {
      const [s0, s1, s2] = source;
      const [t0, t1, t2] = target;
      const determinant =
        s0.x * (s1.y - s2.y) +
        s1.x * (s2.y - s0.y) +
        s2.x * (s0.y - s1.y);
      if (Math.abs(determinant) < 0.000001) return;
      const a =
        (t0.x * (s1.y - s2.y) + t1.x * (s2.y - s0.y) + t2.x * (s0.y - s1.y)) /
        determinant;
      const c =
        (t0.x * (s2.x - s1.x) + t1.x * (s0.x - s2.x) + t2.x * (s1.x - s0.x)) /
        determinant;
      const e =
        (t0.x * (s1.x * s2.y - s2.x * s1.y) +
          t1.x * (s2.x * s0.y - s0.x * s2.y) +
          t2.x * (s0.x * s1.y - s1.x * s0.y)) /
        determinant;
      const b =
        (t0.y * (s1.y - s2.y) + t1.y * (s2.y - s0.y) + t2.y * (s0.y - s1.y)) /
        determinant;
      const d =
        (t0.y * (s2.x - s1.x) + t1.y * (s0.x - s2.x) + t2.y * (s1.x - s0.x)) /
        determinant;
      const f =
        (t0.y * (s1.x * s2.y - s2.x * s1.y) +
          t1.y * (s2.x * s0.y - s0.x * s2.y) +
          t2.y * (s0.x * s1.y - s1.x * s0.y)) /
        determinant;
      context.save();
      const center = {
        x: (t0.x + t1.x + t2.x) / 3,
        y: (t0.y + t1.y + t2.y) / 3,
      };
      // Slightly overlap neighbouring mesh cells so browser sub-pixel rounding
      // cannot expose the horizontal, vertical, or diagonal triangle seams.
      const overlap = 1.2 * pixelRatio;
      const expanded = target.map((point) => {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        const length = Math.hypot(dx, dy) || 1;
        return {
          x: point.x + (dx / length) * overlap,
          y: point.y + (dy / length) * overlap,
        };
      });
      context.beginPath();
      context.moveTo(expanded[0].x, expanded[0].y);
      context.lineTo(expanded[1].x, expanded[1].y);
      context.lineTo(expanded[2].x, expanded[2].y);
      context.closePath();
      context.clip();
      // Every triangle samples the same texture. Replacing pixels inside the
      // expanded clip avoids dark double-alpha lines where triangles overlap.
      context.globalCompositeOperation = "copy";
      context.setTransform(a, b, c, d, e, f);
      context.drawImage(textureCanvas, 0, 0);
      context.restore();
    };
    for (let row = 0; row < divisions; row += 1) {
      for (let column = 0; column < divisions; column += 1) {
        const u0 = column / divisions;
        const u1 = (column + 1) / divisions;
        const v0 = row / divisions;
        const v1 = (row + 1) / divisions;
        const s00 = { x: u0 * sourceWidth, y: v0 * sourceHeight };
        const s10 = { x: u1 * sourceWidth, y: v0 * sourceHeight };
        const s01 = { x: u0 * sourceWidth, y: v1 * sourceHeight };
        const s11 = { x: u1 * sourceWidth, y: v1 * sourceHeight };
        const d00 = destination(u0, v0);
        const d10 = destination(u1, v0);
        const d01 = destination(u0, v1);
        const d11 = destination(u1, v1);
        drawTriangle([s00, s01, s10], [d00, d01, d10]);
        drawTriangle([s10, s01, s11], [d10, d01, d11]);
      }
    }
    return true;
  }
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) return false;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(
    gl.VERTEX_SHADER,
    "attribute vec2 p;attribute vec2 t;varying vec2 v;void main(){gl_Position=vec4(p,0.,1.);v=t;}",
  );
  const fragment = compile(
    gl.FRAGMENT_SHADER,
    "precision mediump float;uniform sampler2D image;varying vec2 v;void main(){gl_FragColor=texture2D(image,v);}",
  );
  if (!vertex || !fragment) return false;
  const program = gl.createProgram();
  if (!program) return false;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
  gl.useProgram(program);

  const divisions = 24;
  const vertices: number[] = [];
  const indexes: number[] = [];
  for (let row = 0; row <= divisions; row += 1) {
    for (let column = 0; column <= divisions; column += 1) {
      const u = column / divisions;
      const v = row / divisions;
      const warped = surface(points, u, v);
      const x = (warped.x + padding) / scale;
      const y = (warped.y + padding) / scale;
      vertices.push(x * 2 - 1, 1 - y * 2, u, 1 - v);
    }
  }
  for (let row = 0; row < divisions; row += 1) {
    for (let column = 0; column < divisions; column += 1) {
      const first = row * (divisions + 1) + column;
      const next = first + divisions + 1;
      indexes.push(first, next, first + 1, first + 1, next, next + 1);
    }
  }
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
  const positionLocation = gl.getAttribLocation(program, "p");
  const textureLocation = gl.getAttribLocation(program, "t");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(textureLocation);
  gl.vertexAttribPointer(
    textureLocation,
    2,
    gl.FLOAT,
    false,
    stride,
    2 * Float32Array.BYTES_PER_ELEMENT,
  );
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexes), gl.STATIC_DRAW);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    textureCanvas,
  );
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.BLEND);
  gl.drawElements(gl.TRIANGLES, indexes.length, gl.UNSIGNED_SHORT, 0);
  if (gl.getError() !== gl.NO_ERROR) return false;
  const renderedPixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(
    0,
    0,
    canvas.width,
    canvas.height,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    renderedPixels,
  );
  for (let index = 3; index < renderedPixels.length; index += 4) {
    if (renderedPixels[index] > 2) return true;
  }
  return false;
}

async function applyFabricShading(
  canvas: HTMLCanvasElement,
  artwork: HTMLDivElement,
  textureUrl: string,
) {
  try {
    const surface = artwork.offsetParent as HTMLElement | null;
    if (!surface || !textureUrl || !canvas.width || !canvas.height) return;
    let objectUrl = "";
    let textureImage = new Image();
    try {
      const response = await fetch(textureUrl);
      if (!response.ok) throw new Error("TEXTURE_FETCH_FAILED");
      objectUrl = URL.createObjectURL(await response.blob());
      textureImage.src = objectUrl;
      await textureImage.decode();
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = "";
      textureImage = new Image();
      textureImage.crossOrigin = "anonymous";
      textureImage.src = textureUrl;
      await textureImage.decode();
    }

    const texture = document.createElement("canvas");
    texture.width = canvas.width;
    texture.height = canvas.height;
    const textureContext = texture.getContext("2d", { willReadFrequently: true });
    const outputContext = canvas.getContext("2d", { willReadFrequently: true });
    if (!textureContext || !outputContext) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return;
    }

    const padding = 0.35;
    const scale = 1 + padding * 2;
    const artworkWidth = artwork.clientWidth;
    const artworkHeight = artwork.clientHeight;
    const surfaceWidth = surface.clientWidth;
    const surfaceHeight = surface.clientHeight;
    if (!artworkWidth || !artworkHeight || !surfaceWidth || !surfaceHeight) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return;
    }
    const pixelScale = canvas.width / (artworkWidth * scale);
    const transform = getComputedStyle(artwork).transform;
    const matrix = transform && transform !== "none" ? new DOMMatrix(transform) : null;
    const angle = matrix ? Math.atan2(matrix.b, matrix.a) : 0;
    const centerX = artwork.offsetLeft + artworkWidth / 2;
    const centerY = artwork.offsetTop + artworkHeight / 2;
    const background = Array.from(surface.children).find(
      (node): node is HTMLImageElement => node instanceof HTMLImageElement,
    );
    const objectFit = background ? getComputedStyle(background).objectFit : "contain";
    const fitScale =
      objectFit === "cover"
        ? Math.max(
            surfaceWidth / textureImage.naturalWidth,
            surfaceHeight / textureImage.naturalHeight,
          )
        : Math.min(
            surfaceWidth / textureImage.naturalWidth,
            surfaceHeight / textureImage.naturalHeight,
          );
    const drawWidth = textureImage.naturalWidth * fitScale;
    const drawHeight = textureImage.naturalHeight * fitScale;
    const drawX = (surfaceWidth - drawWidth) / 2;
    const drawY = (surfaceHeight - drawHeight) / 2;

    textureContext.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    textureContext.translate(
      (padding + 0.5) * artworkWidth,
      (padding + 0.5) * artworkHeight,
    );
    textureContext.rotate(-angle);
    textureContext.translate(-centerX, -centerY);
    textureContext.drawImage(textureImage, drawX, drawY, drawWidth, drawHeight);
    if (objectUrl) URL.revokeObjectURL(objectUrl);

    const blurred = document.createElement("canvas");
    blurred.width = canvas.width;
    blurred.height = canvas.height;
    const blurredContext = blurred.getContext("2d", { willReadFrequently: true });
    if (!blurredContext) return;
    blurredContext.filter = `blur(${Math.max(5, Math.round(artworkWidth * pixelScale * 0.04))}px)`;
    blurredContext.drawImage(texture, 0, 0);

    const fineBlurred = document.createElement("canvas");
    fineBlurred.width = canvas.width;
    fineBlurred.height = canvas.height;
    const fineBlurredContext = fineBlurred.getContext("2d", {
      willReadFrequently: true,
    });
    if (!fineBlurredContext) return;
    fineBlurredContext.filter = `blur(${Math.max(2, Math.round(artworkWidth * pixelScale * 0.006))}px)`;
    fineBlurredContext.drawImage(texture, 0, 0);

    const designPixels = outputContext.getImageData(0, 0, canvas.width, canvas.height);
    const texturePixels = textureContext.getImageData(0, 0, canvas.width, canvas.height).data;
    const blurredPixels = blurredContext.getImageData(0, 0, canvas.width, canvas.height).data;
    const fineBlurredPixels = fineBlurredContext.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    ).data;
    for (let index = 0; index < designPixels.data.length; index += 4) {
      if (designPixels.data[index + 3] < 3 || texturePixels[index + 3] < 3) continue;
      const luminance =
        texturePixels[index] * 0.2126 +
        texturePixels[index + 1] * 0.7152 +
        texturePixels[index + 2] * 0.0722;
      const localBase =
        blurredPixels[index] * 0.2126 +
        blurredPixels[index + 1] * 0.7152 +
        blurredPixels[index + 2] * 0.0722;
      const fineBase =
        fineBlurredPixels[index] * 0.2126 +
        fineBlurredPixels[index + 1] * 0.7152 +
        fineBlurredPixels[index + 2] * 0.0722;
      const wrinkleDetail = Math.max(
        -1,
        Math.min(1, (fineBase - localBase) / 12),
      );
      const fabricDetail = Math.max(-1, Math.min(1, (luminance - fineBase) / 18));
      const designLuminance =
        designPixels.data[index] * 0.2126 +
        designPixels.data[index + 1] * 0.7152 +
        designPixels.data[index + 2] * 0.0722;
      const brightness = designLuminance / 255;
      const strongestChannel = Math.max(
        designPixels.data[index],
        designPixels.data[index + 1],
        designPixels.data[index + 2],
      );
      // Saturated reds/blues may have a modest perceived luminance despite
      // looking bright. Include their strongest channel, while keeping truly
      // dark artwork at the previous safe intensity.
      const visualBrightness =
        (designLuminance * 0.65 + strongestChannel * 0.35) / 255;
      const brightProgress = Math.max(
        0,
        Math.min(1, (visualBrightness - 0.22) / 0.58),
      );
      const brightWeight =
        brightProgress * brightProgress * (3 - 2 * brightProgress);
      const whiteWeight = Math.max(
        0,
        Math.min(
          1,
          (Math.min(
            designPixels.data[index],
            designPixels.data[index + 1],
            designPixels.data[index + 2],
          ) - 190) / 55,
        ),
      );
      const shadowMap = Math.max(0, -wrinkleDetail);
      const highlightMap = Math.max(0, wrinkleDetail);
      const shadowAmount =
        shadowMap * (0.08 + brightWeight * 0.38 + whiteWeight * 0.26);
      const highlightAmount =
        highlightMap *
        (0.005 + brightness * 0.015 + brightWeight * 0.065 + whiteWeight * 0.035);
      const fabricFactor =
        1 +
        fabricDetail *
          (0.005 + brightWeight * 0.035 + whiteWeight * 0.025);
      designPixels.data[index] = Math.max(
        0,
        Math.min(
          255,
          (designPixels.data[index] * (1 - shadowAmount) +
            (255 - designPixels.data[index]) * highlightAmount) *
            fabricFactor,
        ),
      );
      designPixels.data[index + 1] = Math.max(
        0,
        Math.min(
          255,
          (designPixels.data[index + 1] * (1 - shadowAmount) +
            (255 - designPixels.data[index + 1]) * highlightAmount) *
            fabricFactor,
        ),
      );
      designPixels.data[index + 2] = Math.max(
        0,
        Math.min(
          255,
          (designPixels.data[index + 2] * (1 - shadowAmount) +
            (255 - designPixels.data[index + 2]) * highlightAmount) *
            fabricFactor,
        ),
      );
    }
    outputContext.putImageData(designPixels, 0, 0);
  } catch {
    // Realism is optional: a blocked/invalid texture must never break the mockup.
  }
}

export function WarpedArtwork({
  points: rawPoints,
  clip: rawClip,
  fabricTextureUrl,
  style,
  children,
}: {
  points?: unknown;
  clip?: unknown;
  fabricTextureUrl?: string | null;
  style: CSSProperties;
  children: ReactNode;
}) {
  const pointSignature = JSON.stringify(parseWarpPoints(rawPoints));
  const points = useMemo(
    () => parseWarpPoints(rawPoints),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pointSignature],
  );
  const clip = parseArtworkClip(rawClip);
  const ref = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [failed, setFailed] = useState(false);
  const warped = isWarped(points);
  const shouldRasterize = warped || Boolean(fabricTextureUrl);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let resizeTimer = 0;
    const update = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      setSize((current) =>
        Math.abs(current.width - width) < 0.5 &&
        Math.abs(current.height - height) < 0.5
          ? current
          : { width, height },
      );
    };
    update();
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(update, 60);
    });
    observer.observe(node);
    return () => {
      window.clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!shouldRasterize || !size.width || !size.height) return;
    const source = sourceRef.current;
    const canvas = canvasRef.current;
    if (!source || !canvas) return;
    canvas.dataset.warpReady = "false";
    let cancelled = false;
    let scheduleTimer = 0;
    let renderVersion = 0;
    const render = () => {
      const version = ++renderVersion;
      window.clearTimeout(scheduleTimer);
      setRendering(true);
      setFailed(false);
      canvas.dataset.warpReady = "false";
      scheduleTimer = window.setTimeout(async () => {
        const release = await acquireMockupRenderSlot();
        try {
          if (cancelled || version !== renderVersion) return;
          const images = Array.from(source.querySelectorAll("img"));
          await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
          await document.fonts.ready;
          if (cancelled || version !== renderVersion) return;
          const texture = await rasterizeArtwork(
            source,
            size.width,
            size.height,
            clip,
          );
          // Pixel inspection is only an empty-artwork guard. Cross-origin
          // images can taint a perfectly usable canvas, so that check must not
          // force the four-corner CSS fallback and discard the four midpoints.
          let hasVisiblePixel = source.childElementCount > 0;
          try {
            const textureContext = texture.getContext("2d");
            const texturePixels = textureContext?.getImageData(
              0,
              0,
              texture.width,
              texture.height,
            ).data;
            if (texturePixels) {
              hasVisiblePixel = false;
              for (let index = 3; index < texturePixels.length; index += 4) {
                if (texturePixels[index] > 2) {
                  hasVisiblePixel = true;
                  break;
                }
              }
            }
          } catch {
            // The raster can still be drawn by the eight-point canvas mesh.
          }
          if (!hasVisiblePixel) throw new Error("EMPTY_WARP_TEXTURE");
          if (drawCurvedSurface(canvas, texture, points, size.width, size.height)) {
            if (fabricTextureUrl)
              await applyFabricShading(canvas, ref.current!, fabricTextureUrl);
            if (cancelled || version !== renderVersion) return;
            if (cancelled || version !== renderVersion) return;
            setReady(true);
            setRendering(false);
            canvas.dataset.warpReady = "true";
            canvas.dispatchEvent(new Event("warpready"));
          } else throw new Error("WARP_RENDER_FAILED");
        } catch {
          if (!cancelled && version === renderVersion) {
            setReady(false);
            setRendering(false);
            setFailed(true);
            canvas.dataset.warpReady = "failed";
            canvas.dispatchEvent(new Event("warpready"));
          }
        } finally {
          release();
        }
      }, 30);
    };
    render();
    const observer = new MutationObserver(render);
    observer.observe(source, { attributes: true, childList: true, subtree: true, characterData: true });
    return () => {
      cancelled = true;
      renderVersion += 1;
      window.clearTimeout(scheduleTimer);
      observer.disconnect();
    };
  }, [clip, fabricTextureUrl, pointSignature, points, shouldRasterize, size.height, size.width]);

  return (
    <div ref={ref} className="configured-artwork" style={style}>
      {shouldRasterize ? (
        <>
          <div
            ref={sourceRef}
            className="artwork-warp-raster-source"
            style={{ width: size.width || "100%", height: size.height || "100%" }}
          >
            {children}
          </div>
          {rendering && (
            <div className="artwork-warp-loading" aria-label="در حال آماده‌سازی موکاپ">
              <i />
            </div>
          )}
          {failed && size.width > 0 && size.height > 0 && (
            <div
              className="artwork-warp-fallback"
              style={{
                width: size.width,
                height: size.height,
                clipPath: clipPathFor(clip),
                transform: homography(
                  [
                    { x: 0, y: 0 },
                    { x: size.width, y: 0 },
                    { x: size.width, y: size.height },
                    { x: 0, y: size.height },
                  ],
                  [points[0], points[2], points[4], points[6]].map((point) => ({
                    x: point.x * size.width,
                    y: point.y * size.height,
                  })),
                ),
              }}
            >
              {children}
            </div>
          )}
          {failed && (!size.width || !size.height) && children}
          <canvas
            ref={canvasRef}
            className="artwork-warp-canvas"
            style={{
              left: "-35%",
              top: "-35%",
              width: "170%",
              height: "170%",
              opacity: ready && !rendering ? 1 : 0,
            }}
          />
        </>
      ) : clip === "FULL" ? (
        children
      ) : (
        <div className="artwork-clip-window" style={{ clipPath: clipPathFor(clip) }}>
          {children}
        </div>
      )}
    </div>
  );
}
