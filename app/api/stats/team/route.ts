import {
  parseSubPeriodRange,
  roundToOneDecimal,
  type PeriodType,
  PERIOD_TYPES,
} from "@/lib/player-period";
import { prisma } from "@/lib/prisma";

const OPPONENT_LEVELS = ["TOP", "HIGH", "MID", "LOW"] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")?.trim() ?? "";
  const period = searchParams.get("period")?.trim() ?? "";
  const subPeriod = searchParams.get("subPeriod")?.trim() ?? "";

  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }
  if (!PERIOD_TYPES.includes(period as PeriodType)) {
    return Response.json({ message: "유효하지 않은 기간 유형입니다." }, { status: 400 });
  }
  if (!subPeriod) {
    return Response.json({ message: "세부 기간이 필요합니다." }, { status: 400 });
  }

  const range = parseSubPeriodRange(period as PeriodType, subPeriod);
  if (!range) {
    return Response.json({ message: "유효하지 않은 세부 기간입니다." }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }

  const matches = await prisma.match.findMany({
    where: {
      teamId,
      date: { gte: range.start, lte: range.end },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      opponent_name: true,
      opponent_level: true,
      date: true,
      total_score_us: true,
      total_score_them: true,
      total_result: true,
      count_win: true,
      count_draw: true,
      count_loss: true,
    },
  });

  const matchCount = matches.length;
  const winMatches = matches.filter((m) => m.total_result === "WIN").length;
  const goalsScored = matches.reduce((sum, m) => sum + m.total_score_us, 0);
  const goalsConceded = matches.reduce((sum, m) => sum + m.total_score_them, 0);
  const winTotal = matches.reduce((sum, m) => sum + m.count_win, 0);
  const drawTotal = matches.reduce((sum, m) => sum + m.count_draw, 0);
  const lossTotal = matches.reduce((sum, m) => sum + m.count_loss, 0);

  const summary = {
    matchCount,
    winRate: roundToOneDecimal(matchCount > 0 ? (winMatches / matchCount) * 100 : 0),
    goalsScored,
    goalsConceded,
    goalDifference: goalsScored - goalsConceded,
    winTotal,
    drawTotal,
    lossTotal,
  };

  const byOpponentLevel = OPPONENT_LEVELS.map((level) => {
    const levelMatches = matches.filter((m) => m.opponent_level === level);
    const levelMatchCount = levelMatches.length;
    const levelWinMatches = levelMatches.filter((m) => m.total_result === "WIN").length;
    const levelWinTotal = levelMatches.reduce((sum, m) => sum + m.count_win, 0);

    return {
      level,
      matchCount: levelMatchCount,
      winTotal: levelWinTotal,
      winRate: roundToOneDecimal(levelMatchCount > 0 ? (levelWinMatches / levelMatchCount) * 100 : 0),
    };
  });

  const recentMatches = matches.slice(0, 5).map((m) => ({
    id: m.id,
    opponentName: m.opponent_name,
    totalScoreUs: m.total_score_us,
    totalScoreThem: m.total_score_them,
    date: m.date.toISOString(),
    countWin: m.count_win,
    countDraw: m.count_draw,
    countLoss: m.count_loss,
    totalResult: m.total_result,
  }));

  return Response.json({ summary, byOpponentLevel, recentMatches });
}
