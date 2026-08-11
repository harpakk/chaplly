import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"])
  if (!process.env[key]) throw new Error(`${key} is required`);

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { data: media, error } = await db
  .from("raw_product_media")
  .select(
    "file_id,file:storage_files!raw_product_media_file_id_fkey(bucket,path,mime_type)",
  )
  .eq("is_primary", true);
if (error) throw error;

const files = new Map();
for (const row of media || []) {
  const file = Array.isArray(row.file) ? row.file[0] : row.file;
  if (file) files.set(row.file_id, file);
}
const retry = async (operation) => {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const result = await operation();
      if (!result.error) return result;
      lastError = result.error;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 4)
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  throw lastError;
};

for (const [fileId, file] of files) {
  if (file.bucket === "product-images") continue;
  const { data: source } = await retry(() =>
    db.storage.from(file.bucket).download(file.path),
  );
  const optimized = await sharp(Buffer.from(await source.arrayBuffer()))
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
  const sourceName = file.path.split("/").at(-1) || fileId;
  const fileName = `${sourceName.replace(/\.[^.]+$/, "")}.webp`;
  const path = `raw-main-images/${fileId}/${fileName}`;
  await retry(() =>
    db.storage.from("product-images").upload(path, optimized, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    }),
  );
  await retry(() =>
    db
      .from("storage_files")
      .update({ bucket: "product-images", path })
      .eq("id", fileId),
  );
  console.log(`migrated=${fileId}`);
}
