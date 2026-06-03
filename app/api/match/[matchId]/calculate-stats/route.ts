import type { AwardPeriod } from "@/app/generated/prisma/enums";
import { auth } from "@/auth";
import {
  calculateAwardsForPeriod,
  getPeriodDateRange,
  getSubPeriodLabel,
  saveAwards,
} from "@/lib/award-calculation";
import { persistMatchDerivedStats } from "@/lib/match-derived-stats";
import { prisma } from "@/lib/prisma";

const AWARD_PERIODS: AwardPeriod[] = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"];

export const maxDuration = 10;

type RouteContext = {
  params: Promise<{ matchId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { matchId } = await context.params;

  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json()) as { teamId?: string };
  const teamId = body.teamId?.trim() ?? "";
  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team: { select: { admins: true, sport_type: true } },
    },
  });

  if (!match || match.teamId !== teamId) {
    return Response.json({ message: "매치를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!match.team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const existingStat = await prisma.player_Stat.findFirst({
    where: { matchId },
    select: { id: true },
  });
  if (existingStat) {
    return Response.json({ success: true, skipped: true });
  }

  const [players, teamMatches, gamesWithGoals] = await Promise.all([
    prisma.player.findMany({
      where: { teamId, isActive: true },
      select: { id: true, name: true, style: true, createdAt: true },
    }),
    prisma.match.findMany({
      where: { teamId },
      select: { date: true, attendees: true },
    }),
    prisma.game.findMany({
      where: { matchId },
      orderBy: { createdAt: "asc" },
      include: {
        goal_events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    }),
  ]);

  await prisma.$transaction(
    async (tx) => {
      await persistMatchDerivedStats(tx, {
        matchId,
        teamId,
        attendees: match.attendees,
        players,
        teamMatches,
        sportType: match.team.sport_type,
        match: {
          is_tournament: match.is_tournament,
          opponent_level: match.opponent_level,
          date: match.date,
          stage: match.stage ?? null,
          match_format_futsal: match.match_format_futsal ?? null,
          is_pso: match.is_pso,
          pso_result: match.pso_result,
        },
        games: gamesWithGoals.map((g) => ({
          score_us: g.score_us,
          score_them: g.score_them,
          result: g.result,
          players_all: g.players_all,
          players_fw: g.players_fw,
          players_mf: g.players_mf,
          players_df: g.players_df,
          players_gk: g.players_gk,
          goal_events: g.goal_events.map((e) => ({
            id: e.id,
            createdAt: e.createdAt,
            scorer_id: e.scorer_id,
            scorer_type: e.scorer_type,
            assister_id: e.assister_id,
            assister_type: e.assister_type,
          })),
        })),
      });
    },
    { timeout: 9000 },
  );

  const now = new Date();
  for (const period of AWARD_PERIODS) {
    const subPeriod = getSubPeriodLabel(period, match.date);
    const range = getPeriodDateRange(period, subPeriod);
    if (!range || range.end > now) {
      continue;
    }

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
  }

  return Response.json({ success: true });
}
