import { randomUUID } from "crypto";
import sharp from "sharp";
import {
  ensureBucketConfigured,
  getPlayerPhotoBucket,
  getSupabaseServiceRoleClient,
} from "@/lib/supabase-service";

type UploadPlayerPhotoInput = {
  teamId: string;
  rawPhoto: string;
};

async function convertPlayerPhotoToJpegBuffer(rawPhoto: string) {
  const match = rawPhoto.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) {
    throw new Error("INVALID_IMAGE_DATA");
  }

  const imageBuffer = Buffer.from(match[1], "base64");
  return sharp(imageBuffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(354, 472, { fit: "cover" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function uploadPlayerPhotoToSupabase({ teamId, rawPhoto }: UploadPlayerPhotoInput) {
  const supabase = getSupabaseServiceRoleClient();
  const bucket = getPlayerPhotoBucket();
  const buffer = await convertPlayerPhotoToJpegBuffer(rawPhoto);
  const filePath = `teams/${teamId}/${randomUUID()}.jpg`;

  await ensureBucketConfigured(supabase, bucket, "[player-photo]", { requirePublic: true });

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
