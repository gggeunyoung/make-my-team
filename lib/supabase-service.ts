import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseServiceRoleClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("[supabase] Service env is missing.", {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasNextPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  return createClient(url, serviceRoleKey);
}

export function getPlayerPhotoBucket() {
  return process.env.SUPABASE_PLAYER_PHOTO_BUCKET ?? "player-photos";
}

/** Supabase Storage 버킷 이름(대시보드에서 생성한 이름과 동일해야 함). */
export function getTeamLogoBucket() {
  return process.env.SUPABASE_TEAM_LOGO_BUCKET ?? "team-logos";
}

export async function ensureBucketConfigured(
  supabase: SupabaseClient,
  bucket: string,
  contextLabel = "[storage]",
  options?: { requirePublic?: boolean },
) {
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (error) {
    console.error(`${contextLabel} Failed to read bucket.`, {
      bucket,
      message: error.message,
      statusCode: error.statusCode,
      error: error.name,
    });
    throw new Error("BUCKET_READ_FAILED");
  }
  if (!data) {
    console.error(`${contextLabel} Bucket not found.`, { bucket });
    throw new Error("BUCKET_NOT_FOUND");
  }
  if (!data.public) {
    console.error(`${contextLabel} Bucket is not public.`, { bucket });
    if (options?.requirePublic) {
      throw new Error("BUCKET_NOT_PUBLIC");
    }
  }
}
