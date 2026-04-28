/**
 * base64(data:image...) 팀 로고를 Supabase Storage(team-logos)로 옮기고 DB를 public URL로 갱신합니다.
 *
 * 실행(권장, Windows 포함): npx tsx scripts/migrate-logos.ts
 * 또는: npm run migrate:logos
 *
 * DB 연결 문자열 우선순위: MIGRATE_DATABASE_URL → DIRECT_URL → DATABASE_URL
 * (6543 풀러가 방화벽에서 막히면 DIRECT_URL·db.xxx.supabase.co 직접 연결을 쓰는 편이 안전합니다.)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

function getBucket() {
  return process.env.SUPABASE_TEAM_LOGO_BUCKET ?? "team-logos";
}

function getMigrateDatabaseUrl(): string {
  return (
    process.env.MIGRATE_DATABASE_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  );
}

function connectionLabel(url: string): string {
  try {
    const normalized = url.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:");
    const u = new URL(normalized);
    const port = u.port || "5432";
    return `${u.hostname}:${port}`;
  } catch {
    return "(URL 파싱 실패)";
  }
}

function parseDataImageLogo(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const match = dataUrl.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const mimeLower = match[1].toLowerCase();
  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0) {
    return null;
  }

  const extByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/avif": "avif",
  };
  const ext = extByMime[mimeLower] ?? "img";
  return { buffer, contentType: match[1], ext };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = getMigrateDatabaseUrl();
  const bucket = getBucket();

  if (!supabaseUrl || !serviceKey) {
    console.error("SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }
  if (!databaseUrl) {
    console.error("DB URL이 필요합니다. (MIGRATE_DATABASE_URL 또는 DIRECT_URL 또는 DATABASE_URL)");
    process.exit(1);
  }

  const source =
    process.env.MIGRATE_DATABASE_URL?.trim()
      ? "MIGRATE_DATABASE_URL"
      : process.env.DIRECT_URL?.trim()
        ? "DIRECT_URL"
        : "DATABASE_URL";
  console.log(`DB 연결 시도: ${connectionLabel(databaseUrl)} (${source})\n`);

  const pgClient = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 30_000,
  });
  await pgClient.connect();

  const supabase = createClient(supabaseUrl, serviceKey);

  const { rows: teams } = await pgClient.query<{ id: string; name: string; logo: string }>(
    `SELECT id, name, logo FROM "Team" WHERE logo IS NOT NULL AND logo LIKE 'data:image%'`,
  );

  console.log(`대상 팀: ${teams.length}개 (버킷: ${bucket})\n`);

  const succeeded: { id: string; name: string; publicUrl: string }[] = [];
  const failed: { id: string; name: string; reason: string }[] = [];

  for (const team of teams) {
    const parsed = parseDataImageLogo(team.logo);
    if (!parsed) {
      failed.push({ id: team.id, name: team.name, reason: "data:image base64 파싱 실패" });
      continue;
    }

    const objectPath = `migrated/${team.id}/${randomUUID()}.${parsed.ext}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, parsed.buffer, {
      contentType: parsed.contentType,
      upsert: false,
    });

    if (uploadError) {
      failed.push({
        id: team.id,
        name: team.name,
        reason: `Storage 업로드: ${uploadError.message}`,
      });
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(objectPath);

    try {
      await pgClient.query(`UPDATE "Team" SET logo = $1 WHERE id = $2`, [publicUrl, team.id]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push({ id: team.id, name: team.name, reason: `DB 업데이트: ${msg}` });
      continue;
    }

    succeeded.push({ id: team.id, name: team.name, publicUrl });
  }

  await pgClient.end();

  console.log("--- 성공 ---");
  if (succeeded.length === 0) {
    console.log("(없음)");
  } else {
    for (const row of succeeded) {
      console.log(`- ${row.name} (${row.id})\n  ${row.publicUrl}`);
    }
  }

  console.log("\n--- 실패 ---");
  if (failed.length === 0) {
    console.log("(없음)");
  } else {
    for (const row of failed) {
      console.log(`- ${row.name} (${row.id})\n  ${row.reason}`);
    }
  }

  console.log(`\n요약: 성공 ${succeeded.length}건, 실패 ${failed.length}건`);
  process.exit(failed.length > 0 ? 1 : 0);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
