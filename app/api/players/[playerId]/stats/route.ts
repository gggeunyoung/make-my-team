import {
  parseSubPeriodRange,
  roundToOneDecimal,
  type PeriodType,
  PERIOD_TYPES,
} from "@/lib/player-period";
import { prisma } from "@/lib/prisma";
import type { OpponentLevel } from "@/app/generated/prisma/enums";

type RouteContext = {
  params: Promise<{ playerId: string }>;
};

const OPPONENT_LEVELS = new Set(["ALL", "TOP", "HIGH", "MID", "LOW"]);

export async function GET(req: Request, context: RouteContext) {
  const { playerId } = await context.params;
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")?.trim() ?? "";
  const period = searchParams.get("period")?.trim() ?? "";
  const subPeriod = searchParams.get("subPeriod")?.trim() ?? "";
  const opponentLevel = searchParams.get("opponentLevel")?.trim() ?? "ALL";

  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }
  if (!PERIOD_TYPES.includes(period as PeriodType)) {
    return Response.json({ message: "유효하지 않은 기간 유형입니다." }, { status: 400 });
  }
  if (!subPeriod) {
    return Response.json({ message: "세부 기간이 필요합니다." }, { status: 400 });
  }
  if (!OPPONENT_LEVELS.has(opponentLevel)) {
    return Response.json({ message: "유효하지 않은 상대팀 수준입니다." }, { status: 400 });
  }

  const range = parseSubPeriodRange(period as PeriodType, subPeriod);
  if (!range) {
    return Response.json({ message: "유효하지 않은 세부 기간입니다." }, { status: 400 });
  }

  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId, isActive: true },
    select: { id: true },
  });
  if (!player) {
    return Response.json({ message: "선수를 찾을 수 없습니다." }, { status: 404 });
  }

  const levelFilter =
    opponentLevel === "ALL" ? {} : { opponent_level: opponentLevel as OpponentLevel };

  const [playerStats, matches] = await Promise.all([
    prisma.player_Stat.findMany({
      where: {
        playerId,
        teamId,
        match_date: { gte: range.start, lte: range.end },
        ...levelFilter,
      },
      select: {
        goals: true,
        assist: true,
        attack_point: true,
        is_mom: true,
      },
    }),
    prisma.match.findMany({
      where: {
        teamId,
        date: { gte: range.start, lte: range.end },
        attendees: { has: playerId },
        ...levelFilter,
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        opponent_name: true,
        opponent_level: true,
        date: true,
        total_score_us: true,
        total_score_them: true,
        count_win: true,
        count_draw: true,
        count_loss: true,
        total_result: true,
        is_pso: true,
        pso_result: true,
        playerStats: {
          where: { playerId },
          select: { goals: true, assist: true, is_mom: true },
        },
      },
    }),
  ]);

  const matchCount = playerStats.length;
  const goals = playerStats.reduce((sum, s) => sum + s.goals, 0);
  const assists = playerStats.reduce((sum, s) => sum + s.assist, 0);
  const attackPoints = playerStats.reduce((sum, s) => sum + s.attack_point, 0);
  const momCount = playerStats.filter((s) => s.is_mom).length;

  const perMatchDivisor = matchCount > 0 ? matchCount : 1;

  const summary = {
    matchCount,
    goals,
    assists,
    attackPoints,
    momCount,
    goalsPerMatch: roundToOneDecimal(matchCount > 0 ? goals / perMatchDivisor : 0),
    assistsPerMatch: roundToOneDecimal(matchCount > 0 ? assists / perMatchDivisor : 0),
    attackPointsPerMatch: roundToOneDecimal(matchCount > 0 ? attackPoints / perMatchDivisor : 0),
  };

  const matchCards = matches.map((match) => {
    const statGoals = match.playerStats.reduce((sum, s) => sum + s.goals, 0);
    const statAssists = match.playerStats.reduce((sum, s) => sum + s.assist, 0);
    const isMom = match.playerStats.some((s) => s.is_mom);

    return {
      id: match.id,
      opponentName: match.opponent_name,
      opponentLevel: match.opponent_level,
      date: match.date.toISOString(),
      totalScoreUs: match.total_score_us,
      totalScoreThem: match.total_score_them,
      countWin: match.count_win,
      countDraw: match.count_draw,
      countLoss: match.count_loss,
      isPso: match.is_pso,
      totalResult: match.total_result,
      psoResult: match.pso_result,
      goals: statGoals,
      assists: statAssists,
      isMom,
    };
  });

  return Response.json({ summary, matchCards });
}
