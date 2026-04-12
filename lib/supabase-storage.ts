import type { SupabaseClient } from "@supabase/supabase-js"

/** Supabase Storage bucket for site images (see migration + dashboard Storage). */
export const SUPABASE_FILES_BUCKET = "files" as const

function safeFileName(name: string) {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120)
  return base || "image.bin"
}

/**
 * Uploads a file to `files` and returns its public URL.
 * Requires CEO storage policies (see migration) and a public bucket.
 */
export async function uploadToFilesBucket(
  client: SupabaseClient,
  file: File,
  folderPath: string,
): Promise<string> {
  const folder = folderPath.replace(/^\/+|\/+$/g, "")
  const path = `${folder}/${Date.now()}-${safeFileName(file.name)}`
  const { data, error } = await client.storage
    .from(SUPABASE_FILES_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    })
  if (error) throw error
  const { data: pub } = client.storage
    .from(SUPABASE_FILES_BUCKET)
    .getPublicUrl(data.path)
  return pub.publicUrl
}
