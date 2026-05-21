import { roundToOneDecimal } from "@/lib/player-period";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ tournamentId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  const { tournamentId } = await context.params;
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")?.trim() ?? "";

  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }

  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, teamId, is_completed: true },
    select: {
      id: true,
      tournament_name: true,
      tournament_result: true,
      start_date: true,
      finish_date: true,
      final_mvp: true,
    },
  });

  if (!tournament) {
    return Response.json({ message: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const [matches, tournamentStats, mvpPlayer] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId, teamId },
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
        stage: true,
        is_pso: true,
        pso_result: true,
        _count: { select: { games: true } },
        playerStats: {
          select: {
            playerId: true,
            goals: true,
            assist: true,
            player: { select: { name: true } },
          },
        },
      },
    }),
    prisma.player_Stat.findMany({
      where: { teamId, match: { tournamentId } },
      select: {
        playerId: true,
        goals: true,
        assist: true,
        player: { select: { id: true, name: true, photo: true } },
      },
    }),
    tournament.final_mvp
      ? prisma.player.findUnique({
          where: { id: tournament.final_mvp },
          select: { id: true, name: true, photo: true },
        })
      : Promise.resolve(null),
  ]);

  const matchCount = matches.length;
  const winMatches = matches.filter((m) => m.total_result === "WIN").length;
  const drawMatches = matches.filter((m) => m.total_result === "DRAW").length;
  const lossMatches = matches.filter((m) => m.total_result === "LOSS").length;

  const summary = {
    matchCount,
    winRate: roundToOneDecimal(matchCount > 0 ? (winMatches / matchCount) * 100 : 0),
    goalsScored: matches.reduce((sum, m) => sum + m.total_score_us, 0),
    goalsConceded: matches.reduce((sum, m) => sum + m.total_score_them, 0),
    winMatches,
    drawMatches,
    lossMatches,
  };

  const recordByPlayer = new Map<
    string,
    { id: string; name: string; photo: string | null; goals: number; assists: number }
  >();

  for (const stat of tournamentStats) {
    const existing = recordByPlayer.get(stat.playerId);
    if (existing) {
      existing.goals += stat.goals;
      existing.assists += stat.assist;
    } else {
      recordByPlayer.set(stat.playerId, {
        id: stat.player.id,
        name: stat.player.name,
        photo: stat.player.photo,
        goals: stat.goals,
        assists: stat.assist,
      });
    }
  }

  const playerRecords = [...recordByPlayer.values()]
    .filter((p) => p.goals > 0 || p.assists > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name, "ko"));

  let mvpGoals = 0;
  let mvpAssists = 0;
  if (tournament.final_mvp) {
    for (const stat of tournamentStats) {
      if (stat.playerId === tournament.final_mvp) {
        mvpGoals += stat.goals;
        mvpAssists += stat.assist;
      }
    }
  }

  const mapMatch = (m: (typeof matches)[number]) => ({
    id: m.id,
    stage: m.stage,
    opponentName: m.opponent_name,
    opponentLevel: m.opponent_level,
    date: m.date.toISOString(),
    totalScoreUs: m.total_score_us,
    totalScoreThem: m.total_score_them,
    totalResult: m.total_result,
    isPso: m.is_pso,
    psoResult: m.pso_result,
    countWin: m.count_win,
    countDraw: m.count_draw,
    countLoss: m.count_loss,
    gameCount: m._count.games,
    playerStats: m.playerStats
      .filter((s) => s.goals > 0 || s.assist > 0)
      .map((s) => ({
        playerId: s.playerId,
        playerName: s.player.name,
        goals: s.goals,
        assists: s.assist,
      })),
  });

  const mainMatches = matches.filter((m) => m.stage === "MAIN").map(mapMatch);
  const preliminaryMatches = matches
    .filter((m) => m.stage === "PRELIMINARY")
    .map(mapMatch);

  return Response.json({
    tournament: {
      id: tournament.id,
      tournamentName: tournament.tournament_name,
      tournamentResult: tournament.tournament_result,
      startDate: tournament.start_date?.toISOString() ?? null,
      finishDate: tournament.finish_date?.toISOString() ?? null,
    },
    summary,
    mvp: mvpPlayer
      ? {
          id: mvpPlayer.id,
          name: mvpPlayer.name,
          photo: mvpPlayer.photo,
          goals: mvpGoals,
          assists: mvpAssists,
        }
      : null,
    playerRecords,
    matches: {
      main: mainMatches,
      preliminary: preliminaryMatches,
    },
  });
}
