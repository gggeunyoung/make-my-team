import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ matchId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  const { matchId } = await context.params;
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")?.trim() ?? "";
  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, teamId, is_tournament: false },
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
      is_pso: true,
      pso_result: true,
      mom: true,
    },
  });

  if (!match) {
    return Response.json({ message: "매치를 찾을 수 없습니다." }, { status: 404 });
  }

  const [games, playerStats] = await Promise.all([
    prisma.game.findMany({
      where: { matchId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        score_us: true,
        score_them: true,
        result: true,
      },
    }),
    prisma.player_Stat.findMany({
      where: { matchId, teamId },
      select: {
        playerId: true,
        goals: true,
        assist: true,
        player: { select: { name: true, photo: true } },
      },
    }),
  ]);

  const statByPlayer = new Map<string, { goals: number; assists: number; name: string; photo: string | null }>();
  for (const stat of playerStats) {
    const existing = statByPlayer.get(stat.playerId);
    if (existing) {
      existing.goals += stat.goals;
      existing.assists += stat.assist;
    } else {
      statByPlayer.set(stat.playerId, {
        goals: stat.goals,
        assists: stat.assist,
        name: stat.player.name,
        photo: stat.player.photo,
      });
    }
  }

  let momPlayer: {
    id: string;
    name: string;
    photo: string | null;
    goals: number;
    assists: number;
  } | null = null;

  if (match.mom) {
    const momStat = statByPlayer.get(match.mom);
    if (momStat) {
      momPlayer = {
        id: match.mom,
        name: momStat.name,
        photo: momStat.photo,
        goals: momStat.goals,
        assists: momStat.assists,
      };
    } else {
      const player = await prisma.player.findUnique({
        where: { id: match.mom },
        select: { id: true, name: true, photo: true },
      });
      if (player) {
        momPlayer = { id: player.id, name: player.name, photo: player.photo, goals: 0, assists: 0 };
      }
    }
  }

  const statEntries = [...statByPlayer.entries()]
    .map(([playerId, s]) => ({
      playerId,
      playerName: s.name,
      goals: s.goals,
      assists: s.assists,
    }))
    .filter((s) => s.goals > 0 || s.assists > 0)
    .sort((a, b) => a.playerName.localeCompare(b.playerName, "ko"));

  return Response.json({
    match: {
      id: match.id,
      opponentName: match.opponent_name,
      opponentLevel: match.opponent_level,
      date: match.date.toISOString(),
      totalScoreUs: match.total_score_us,
      totalScoreThem: match.total_score_them,
      totalResult: match.total_result,
      countWin: match.count_win,
      countDraw: match.count_draw,
      countLoss: match.count_loss,
      isPso: match.is_pso,
      psoResult: match.pso_result,
    },
    games: games.map((g, index) => ({
      id: g.id,
      gameNumber: index + 1,
      scoreUs: g.score_us,
      scoreThem: g.score_them,
      result: g.result,
    })),
    momPlayer,
    statEntries,
  });
}
