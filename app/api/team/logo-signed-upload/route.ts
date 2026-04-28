import { auth } from "@/auth";
import {
  ensureBucketConfigured,
  getSupabaseServiceRoleClient,
  getTeamLogoBucket,
} from "@/lib/supabase-service";
import { randomUUID } from "crypto";

function extensionFromUpload(payload: { contentType?: string; fileName?: string }) {
  const fromName = payload.fileName?.match(/\.([a-zA-Z0-9]{1,12})$/);
  if (fromName) {
    return fromName[1]!.toLowerCase();
  }

  const mime = payload.contentType?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/avif": "avif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
  };
  return map[mime] ?? "bin";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email?.trim()) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json()) as {
    contentType?: string;
    fileName?: string;
  };

  const ext = extensionFromUpload(body);
  const bucket = getTeamLogoBucket();
  const path = `draft/${randomUUID()}.${ext}`;

  let supabase;
  try {
    supabase = getSupabaseServiceRoleClient();
  } catch {
    return Response.json({ message: "스토리지 설정이 필요합니다." }, { status: 500 });
  }

  try {
    await ensureBucketConfigured(supabase, bucket, "[team-logo]", { requirePublic: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "BUCKET_NOT_PUBLIC") {
      return Response.json(
        { message: `${bucket} 버킷을 Public으로 설정한 뒤 다시 시도해주세요.` },
        { status: 500 },
      );
    }
    return Response.json({ message: "스토리지 버킷을 사용할 수 없습니다." }, { status: 500 });
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[team-logo] createSignedUploadUrl", error);
    return Response.json({ message: "업로드 URL을 만들 수 없습니다." }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return Response.json({
    bucket,
    path: data.path,
    token: data.token,
    publicUrl,
  });
}
