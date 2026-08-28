import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Company logo storage, backed by a public Supabase Storage bucket.
 *
 * Uploads use the service-role key, so this module must never be imported from a
 * client component — the key stays server-side.
 */

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "branding";

export function storageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Logo upload needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function safeName(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "logo";
}

export async function uploadLogo(file: File): Promise<string> {
  const supabase = client();
  const path = `logos/${Date.now()}-${safeName(file.name)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(
      error.message.includes("not found")
        ? `Storage bucket "${BUCKET}" doesn't exist. Create it (public) in the Supabase dashboard.`
        : `Logo upload failed: ${error.message}`,
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
