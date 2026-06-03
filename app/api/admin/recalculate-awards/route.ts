import type { AwardPeriod } from "@/app/generated/prisma/enums";
import { auth } from "@/auth";
import {
  calculateAwardsForPeriod,
  getPastSubPeriods,
  getPeriodDateRange,
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

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const sessionUser = await resolveSessionUserRole(session);
  if (sessionUser?.role !== "SUPER_ADMIN") {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const searchParams = new URL(req.url).searchParams;
  const teamId = searchParams.get("teamId")?.trim() ?? "";
  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }

  const periodParam = searchParams.get("period")?.trim() ?? "";
  const periodsToProcess: AwardPeriod[] = periodParam
    ? (AWARD_PERIODS.includes(periodParam as AwardPeriod)
        ? [periodParam as AwardPeriod]
        : [])
    : AWARD_PERIODS;

  if (periodParam && periodsToProcess.length === 0) {
    return Response.json({ message: "유효하지 않은 기간 타입입니다." }, { status: 400 });
  }

  const subPeriodParam = searchParams.get("subPeriod")?.trim() ?? "";
  if (subPeriodParam && !periodParam) {
    return Response.json({ message: "기간 타입이 필요합니다." }, { status: 400 });
  }
  if (subPeriodParam && !getPeriodDateRange(periodParam as AwardPeriod, subPeriodParam)) {
    return Response.json({ message: "유효하지 않은 subPeriod입니다." }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true },
  });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }

  let processedCount = 0;

  for (const period of periodsToProcess) {
    const subPeriods = subPeriodParam ? [subPeriodParam] : await getPastSubPeriods(period, teamId, prisma);

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
      } catch (error) {
        console.error("Award 저장 실패:", period, subPeriod, error);
      }
    }
  }

  return Response.json({ success: true, processedCount });
}
