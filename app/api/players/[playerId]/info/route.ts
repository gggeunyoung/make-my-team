import { getCurrentQuarterInfo } from "@/lib/player-period";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ playerId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  const { playerId } = await context.params;
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")?.trim() ?? "";
  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }

  const [team, player] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, sport_type: true },
    }),
    prisma.player.findFirst({
      where: { id: playerId, teamId, isActive: true },
      select: {
        id: true,
        name: true,
        photo: true,
        style: true,
        position: true,
        createdAt: true,
      },
    }),
  ]);

  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!player) {
    return Response.json({ message: "선수를 찾을 수 없습니다." }, { status: 404 });
  }

  const quarterInfo = getCurrentQuarterInfo();
  const attendanceFrom =
    player.createdAt > quarterInfo.range.start ? player.createdAt : quarterInfo.range.start;

  const [momMatches, quarterMatches, awards] = await Promise.all([
    prisma.match.findMany({
      where: { teamId, mom: playerId },
      orderBy: { date: "desc" },
      select: {
        id: true,
        opponent_name: true,
        date: true,
      },
    }),
    prisma.match.findMany({
      where: {
        teamId,
        date: {
          gte: attendanceFrom,
          lte: quarterInfo.range.end,
        },
      },
      select: { attendees: true },
    }),
    prisma.award.findMany({
      where: { playerId, teamId, rank: 1 },
      select: {
        period: true,
        subPeriod: true,
        category: true,
        rank: true,
        statValue: true,
      },
      orderBy: { subPeriod: "desc" },
    }),
  ]);

  const totalQuarterMatches = quarterMatches.length;
  const attendedQuarterMatches = quarterMatches.filter((m) => m.attendees.includes(playerId)).length;
  const attendanceRate =
    totalQuarterMatches === 0 ? 0 : Math.round((attendedQuarterMatches / totalQuarterMatches) * 100);

  const { createdAt: _playerCreatedAt, ...playerResponse } = player;

  return Response.json({
    sportType: team.sport_type,
    player: playerResponse,
    momMatches: momMatches.map((m) => ({
      id: m.id,
      opponentName: m.opponent_name,
      date: m.date.toISOString(),
    })),
    attendanceRate,
    quarterLabel: quarterInfo.label,
    awards: awards.map((award) => ({
      period: award.period,
      subPeriod: award.subPeriod,
      category: award.category,
      rank: award.rank,
      statValue: award.statValue,
    })),
  });
}
