import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

type UploadPlayerPhotoInput = {
  teamId: string;
  rawPhoto: string;
};

function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("[player-photo] Supabase env is missing.", {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasNextPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  return createClient(url, serviceRoleKey);
}

function getPlayerPhotoBucket() {
  return process.env.SUPABASE_PLAYER_PHOTO_BUCKET ?? "player-photos";
}

async function convertPlayerPhotoToJpegBuffer(rawPhoto: string) {
  const match = rawPhoto.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) {
    throw new Error("INVALID_IMAGE_DATA");
  }

  const imageBuffer = Buffer.from(match[1], "base64");
  return sharp(imageBuffer).resize(354, 472, { fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
}

async function ensureBucketConfigured(supabase: ReturnType<typeof getSupabaseServerClient>, bucket: string) {
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (error) {
    console.error("[player-photo] Failed to read bucket.", {
      bucket,
      message: error.message,
      statusCode: error.statusCode,
      error: error.name,
    });
    throw new Error("BUCKET_READ_FAILED");
  }
  if (!data) {
    console.error("[player-photo] Bucket not found.", { bucket });
    throw new Error("BUCKET_NOT_FOUND");
  }
  if (!data.public) {
    console.error("[player-photo] Bucket is not public.", { bucket });
  }
}

export async function uploadPlayerPhotoToSupabase({ teamId, rawPhoto }: UploadPlayerPhotoInput) {
  const supabase = getSupabaseServerClient();
  const bucket = getPlayerPhotoBucket();
  const buffer = await convertPlayerPhotoToJpegBuffer(rawPhoto);
  const filePath = `teams/${teamId}/${randomUUID()}.jpg`;

  await ensureBucketConfigured(supabase, bucket);

  try {
    const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) {
      console.error("[player-photo] Upload failed error object:", JSON.stringify(error));
      throw new Error("PHOTO_UPLOAD_FAILED");
    }
  } catch (error) {
    console.error("[player-photo] Upload threw error object:", JSON.stringify(error));
    throw new Error("PHOTO_UPLOAD_FAILED");
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}
