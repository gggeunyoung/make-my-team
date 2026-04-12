import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 환경 변수가 설정되어 있지 않습니다.");
  }
  if (!globalForPrisma.pool) {
    // 서버리스(Vercel 등)에서는 인스턴스당 연결 수를 1로 두는 편이 안전합니다.
    globalForPrisma.pool = new Pool({
      connectionString,
      max: process.env.VERCEL ? 1 : 10,
    });
  }
  return globalForPrisma.pool;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(getPool()),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error", "warn"],
  });

// dev HMR 대비 + 프로덕션 웜 스타트에서도 동일 클라이언트 재사용
globalForPrisma.prisma = prisma;
