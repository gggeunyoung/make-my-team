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

export async function uploadPlayerPhotoToSupabase({ teamId, rawPhoto }: UploadPlayerPhotoInput) {
  const supabase = getSupabaseServerClient();
  const bucket = getPlayerPhotoBucket();
  const buffer = await convertPlayerPhotoToJpegBuffer(rawPhoto);
  const filePath = `teams/${teamId}/${randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) {
    throw new Error("PHOTO_UPLOAD_FAILED");
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}
