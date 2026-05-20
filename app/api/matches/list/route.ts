import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")?.trim() ?? "";
  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }

  const matches = await prisma.match.findMany({
    where: { teamId, is_tournament: false },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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
      mom: true,
    },
  });

  const momIds = [...new Set(matches.map((m) => m.mom).filter((id): id is string => Boolean(id)))];
  const momPlayers =
    momIds.length > 0
      ? await prisma.player.findMany({
          where: { id: { in: momIds } },
          select: { id: true, name: true },
        })
      : [];
  const momNameById = new Map(momPlayers.map((p) => [p.id, p.name]));

  return Response.json({
    matches: matches.map((m) => ({
      id: m.id,
      opponentName: m.opponent_name,
      opponentLevel: m.opponent_level,
      date: m.date.toISOString(),
      totalScoreUs: m.total_score_us,
      totalScoreThem: m.total_score_them,
      totalResult: m.total_result,
      countWin: m.count_win,
      countDraw: m.count_draw,
      countLoss: m.count_loss,
      momName: m.mom ? (momNameById.get(m.mom) ?? null) : null,
    })),
  });
}
