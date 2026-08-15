import "server-only";
import sharp from "sharp";

type UploadedStorageImage = {
  path: string;
  mimeType: "image/webp";
  sizeBytes: number;
};

function storageObjectUrls(bucket: string, objectPath: string) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) throw new Error("Supabase URL is missing");
  const projectRef = new URL(projectUrl).hostname.split(".")[0];
  const encodedPath = objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const objectUrl = `/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;
  return [
    `${projectUrl.replace(/\/$/, "")}${objectUrl}`,
    `https://${projectRef}.storage.supabase.co${objectUrl}`,
  ];
}

function webpPath(objectPath: string) {
  return /\.[a-z0-9]+$/i.test(objectPath)
    ? objectPath.replace(/\.[a-z0-9]+$/i, ".webp")
    : `${objectPath}.webp`;
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const tusValue = (value: string) => Buffer.from(value).toString("base64");

async function uploadResumable(
  body: Buffer,
  bucket: string,
  path: string,
  secretKey: string,
) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) throw new Error("Supabase URL is missing");
  const projectRef = new URL(projectUrl).hostname.split(".")[0];
  const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  const authHeaders = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Tus-Resumable": "1.0.0",
    "x-upsert": "true",
  };
  const creation = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Upload-Length": String(body.length),
      "Upload-Metadata": [
        `bucketName ${tusValue(bucket)}`,
        `objectName ${tusValue(path)}`,
        `contentType ${tusValue("image/webp")}`,
        `cacheControl ${tusValue("3600")}`,
      ].join(","),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!creation.ok) {
    throw new Error(
      `Resumable upload initialization failed (${creation.status}): ${(await creation.text()).slice(0, 300)}`,
    );
  }
  const location = creation.headers.get("location");
  if (!location) throw new Error("Resumable upload URL was not returned");
  const uploadUrl = new URL(location, endpoint).toString();
  // This deployment path resets Node/Undici sockets for request bodies around
  // 32 KB. Small TUS chunks avoid that transport limit while retaining resume.
  const chunkSize = 8 * 1024;
  let offset = 0;
  let failures = 0;

  while (offset < body.length) {
    const chunk = body.subarray(offset, Math.min(offset + chunkSize, body.length));
    try {
      const response = await fetch(uploadUrl, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/offset+octet-stream",
          "Content-Length": String(chunk.length),
          "Upload-Offset": String(offset),
        },
        body: new Uint8Array(chunk),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok)
        throw new Error(
          `Resumable upload failed (${response.status}): ${(await response.text()).slice(0, 300)}`,
        );
      offset = Number(response.headers.get("upload-offset") || offset + chunk.length);
      failures = 0;
    } catch (error) {
      failures += 1;
      if (failures > 5) throw error;
      await wait([0, 3_000, 5_000, 10_000, 20_000][failures - 1]);
      try {
        const status = await fetch(uploadUrl, {
          method: "HEAD",
          headers: authHeaders,
          signal: AbortSignal.timeout(30_000),
        });
        if (status.ok)
          offset = Number(status.headers.get("upload-offset") || offset);
      } catch {
        // Retry the current chunk when even the offset check is unavailable.
      }
    }
  }
}

/**
 * Raw-product media is display/mockup media rather than a printable source file.
 * Keeping it under a predictable size avoids long-running server actions and
 * connection resets on slow upload links, while 1800px remains crisp in the UI.
 */
export async function uploadStorageImage(
  file: File,
  bucket: string,
  objectPath: string,
  options: { maxDimension?: number; quality?: number; lossless?: boolean } = {},
): Promise<UploadedStorageImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("فایل انتخاب‌شده باید تصویر باشد.");
  }

  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Supabase secret key is missing");

  const pipeline = sharp(Buffer.from(await file.arrayBuffer())).rotate();
  if (!options.lossless)
    pipeline.resize({
      width: options.maxDimension ?? 1800,
      height: options.maxDimension ?? 1800,
      fit: "inside",
      withoutEnlargement: true,
    });
  const optimized = await pipeline
    .webp(options.lossless ? { lossless: true, effort: 6 } : { quality: options.quality ?? 80, effort: 4 })
    .toBuffer();

  const path = webpPath(objectPath);
  try {
    await uploadResumable(optimized, bucket, path, secretKey);
    return { path, mimeType: "image/webp", sizeBytes: optimized.length };
  } catch (resumableError) {
    // Keep the standard endpoint as a compatibility fallback for projects
    // where resumable uploads are disabled.
    console.warn("Resumable storage upload failed; using standard upload", resumableError);
  }
  const urls = storageObjectUrls(bucket, path);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(urls[attempt % urls.length], {
        method: "POST",
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "image/webp",
          "Content-Length": String(optimized.length),
          Connection: "close",
          "cache-control": "3600",
          // The path contains a UUID. Upsert makes a retry safe when Supabase
          // stored the object but the response connection was interrupted.
          "x-upsert": "true",
        },
        body: optimized,
        // Supabase storage can take longer on a cold/slow project connection.
        // The image is already resized above, so allow the request to finish
        // instead of reporting a false failure after the metadata was saved.
        signal: AbortSignal.timeout(120_000),
      });
      if (response.ok) {
        return { path, mimeType: "image/webp", sizeBytes: optimized.length };
      }
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Storage upload failed (${response.status}): ${detail}`);
    } catch (error) {
      if (error instanceof Error) {
        const cause = error.cause as
          | { code?: string; message?: string }
          | undefined;
        const detail = cause?.code || cause?.message;
        lastError = new Error(
          detail ? `Storage upload failed: ${detail}` : error.message,
        );
      } else {
        lastError = new Error("Storage upload failed");
      }
      if (attempt < 2) await wait(500 * 2 ** attempt);
    }
  }

  throw lastError || new Error("Storage upload failed");
}
