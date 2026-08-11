import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Records an uploaded object through Supabase's pooled REST API. Keeping this
 * helper's established name avoids touching upload callers while ensuring a
 * page request never opens a slow, direct PostgreSQL connection.
 */
export async function insertStorageFileDirect(input: {
  ownerUserId: string;
  bucket: string;
  path: string;
  kind:
    | Database["public"]["Enums"]["asset_kind"]
    | "FREE_DESIGN"
    | "REVIEW_IMAGE"
    | "SUPPLIER_LOGO"
    | "SUPPLIER_BANNER"
    | "CATEGORY_IMAGE"
    | "GRAPHIC_STYLE_IMAGE";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const { data, error } = await createSupabaseAdmin()
    .from("storage_files")
    .upsert(
      {
        owner_user_id: input.ownerUserId,
        bucket: input.bucket,
        path: input.path,
        kind: input.kind as Database["public"]["Tables"]["storage_files"]["Insert"]["kind"],
        original_name: input.originalName,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        state: "READY",
      },
      { onConflict: "bucket,path" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
