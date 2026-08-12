"use client";

import {
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

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
    const image = object.querySelector<HTMLImageElement>("img");
    if (image?.src) {
      const response = await fetch(image.currentSrc || image.src);
      if (!response.ok) throw new Error("WARP_IMAGE_FETCH_FAILED");
      const bitmap = await createImageBitmap(await response.blob());
      const fit = Math.min(objectWidth / bitmap.width, objectHeight / bitmap.height);
      const drawWidth = bitmap.width * fit;
      const drawHeight = bitmap.height * fit;
      const drawX = x + (objectWidth - drawWidth) / 2;
      const drawY = y + (objectHeight - drawHeight) / 2;
      const transformNode = image.parentElement?.classList.contains(
        "cropped-artwork-image",
      )
        ? image.parentElement
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
      bitmap.close();
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

export function WarpedArtwork({
  points: rawPoints,
  clip: rawClip,
  style,
  children,
}: {
  points?: unknown;
  clip?: unknown;
  style: CSSProperties;
  children: ReactNode;
}) {
  const points = parseWarpPoints(rawPoints);
  const clip = parseArtworkClip(rawClip);
  const ref = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const warped = isWarped(points);
  const pointSignature = JSON.stringify(points);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () =>
      setSize({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!warped || !size.width || !size.height) return;
    const source = sourceRef.current;
    const canvas = canvasRef.current;
    if (!source || !canvas) return;
    let cancelled = false;
    let timer = 0;
    const render = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        try {
          const images = Array.from(source.querySelectorAll("img"));
          await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
          await document.fonts.ready;
          const texture = await rasterizeArtwork(
            source,
            size.width,
            size.height,
            clip,
          );
          const textureContext = texture.getContext("2d");
          const texturePixels = textureContext?.getImageData(
            0,
            0,
            texture.width,
            texture.height,
          ).data;
          let hasVisiblePixel = false;
          if (texturePixels) {
            for (let index = 3; index < texturePixels.length; index += 4) {
              if (texturePixels[index] > 2) {
                hasVisiblePixel = true;
                break;
              }
            }
          }
          if (!hasVisiblePixel) throw new Error("EMPTY_WARP_TEXTURE");
          if (!cancelled && drawCurvedSurface(canvas, texture, points, size.width, size.height)) {
            setReady(true);
            canvas.dataset.warpReady = "true";
            canvas.dispatchEvent(new Event("warpready"));
          }
        } catch {
          if (!cancelled) setReady(false);
        }
      }, 30);
    };
    render();
    const observer = new MutationObserver(render);
    observer.observe(source, { attributes: true, childList: true, subtree: true, characterData: true });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [clip, pointSignature, points, size.height, size.width, warped]);

  return (
    <div ref={ref} className="configured-artwork" style={style}>
      {warped ? (
        <>
          <div
            ref={sourceRef}
            className="artwork-warp-raster-source"
            style={{ width: size.width || "100%", height: size.height || "100%" }}
          >
            {children}
          </div>
          {!ready && size.width > 0 && size.height > 0 && (
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
          {!ready && (!size.width || !size.height) && children}
          <canvas
            ref={canvasRef}
            className="artwork-warp-canvas"
            style={{
              left: "-35%",
              top: "-35%",
              width: "170%",
              height: "170%",
              opacity: ready ? 1 : 0,
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
