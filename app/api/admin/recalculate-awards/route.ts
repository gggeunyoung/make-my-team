import type { AwardPeriod } from "@/app/generated/prisma/enums";
import { auth } from "@/auth";
import {
  calculateAwardsForPeriod,
  getPastSubPeriods,
  saveAwards,
} from "@/lib/award-calculation";
import { prisma } from "@/lib/prisma";
import { getSessionIdentity } from "@/lib/session";

export const maxDuration = 10;

const AWARD_PERIODS: AwardPeriod[] = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"];

async function resolveSessionUserRole(
  session: {
    user?: {
      email?: string | null;
      provider?: string | null;
      providerAccountId?: string | null;
    } | null;
  } | null,
) {
  const { email, provider, providerAccountId } = getSessionIdentity(session);

  if (email) {
    return prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });
  }

  if (provider && providerAccountId) {
    return prisma.user.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      select: { role: true },
    });
  }

  return null;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const sessionUser = await resolveSessionUserRole(session);
  if (sessionUser?.role !== "SUPER_ADMIN") {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const teamId = new URL(req.url).searchParams.get("teamId")?.trim() ?? "";
  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true },
  });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }

  let processedCount = 0;

  for (const period of AWARD_PERIODS) {
    const subPeriods = await getPastSubPeriods(period, teamId, prisma);

    for (const subPeriod of subPeriods) {
      try {
        await prisma.$transaction(
          async (tx) => {
            await tx.award.deleteMany({
              where: { teamId, period, subPeriod },
            });
            const awards = await calculateAwardsForPeriod(tx, teamId, period, subPeriod);
            if (awards.length > 0) {
              await saveAwards(tx, awards);
            }
          },
          { timeout: 9000 },
        );
        processedCount += 1;
      } catch {
        // 실패해도 다음 기간 계속 진행
      }
    }
  }

  return Response.json({ success: true, processedCount });
}
