import { getCurrentQuarterInfo } from "@/lib/player-period";
import { prisma } from "@/lib/prisma";
import {
  buildFirstAttendanceDateByPlayer,
  buildTopRankings,
  overallAttendanceRate,
  periodAttendancePercent,
  roundToTwoDecimal,
} from "@/lib/stats-utils";

type PlayerAgg = {
  id: string;
  name: string;
  photo: string | null;
  createdAt: Date;
  matchCount: number;
  goals: number;
  assists: number;
  attackPoints: number;
  perfAttack: number;
  perfDefense: number;
};

const RANKING_CATEGORIES = [
  { key: "attack", title: "공격수 랭킹" },
  { key: "defense", title: "수비수 랭킹" },
  { key: "goals", title: "골" },
  { key: "assists", title: "도움" },
  { key: "attackPoints", title: "공격포인트" },
  { key: "attendanceRate", title: "출석률" },
  { key: "goalsPerMatch", title: "경기당 골" },
  { key: "assistsPerMatch", title: "경기당 도움" },
  { key: "attackPointsPerMatch", title: "경기당 공격포인트" },
] as const;

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

  const quarterInfo = getCurrentQuarterInfo();
  const { start, end } = quarterInfo.range;

  const [players, playerStats, quarterMatches, allTeamMatches, recentMatchesRaw] = await Promise.all([
    prisma.player.findMany({
      where: { teamId, isActive: true },
      select: { id: true, name: true, photo: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.player_Stat.findMany({
      where: {
        teamId,
        match_date: { gte: start, lte: end },
      },
      select: {
        playerId: true,
        goals: true,
        assist: true,
        attack_point: true,
        perf_attack: true,
        perf_defense: true,
      },
    }),
    prisma.match.findMany({
      where: {
        teamId,
        date: { gte: start, lte: end },
      },
      select: { date: true, attendees: true },
    }),
    prisma.match.findMany({
      where: { teamId },
      select: { date: true, attendees: true },
    }),
    prisma.match.findMany({
      where: { teamId, is_tournament: false },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
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
    }),
  ]);

  const hasQuarterMatches = quarterMatches.length > 0;

  const aggByPlayer = new Map<string, Omit<PlayerAgg, "id" | "name" | "photo" | "createdAt">>();
  for (const player of players) {
    aggByPlayer.set(player.id, {
      matchCount: 0,
      goals: 0,
      assists: 0,
      attackPoints: 0,
      perfAttack: 0,
      perfDefense: 0,
    });
  }

  for (const stat of playerStats) {
    const agg = aggByPlayer.get(stat.playerId);
    if (!agg) continue;
    agg.matchCount += 1;
    agg.goals += stat.goals;
    agg.assists += stat.assist;
    agg.attackPoints += stat.attack_point;
    agg.perfAttack += stat.perf_attack;
    agg.perfDefense += stat.perf_defense;
  }

  const playerAggs: PlayerAgg[] = players.map((player) => ({
    ...player,
    ...aggByPlayer.get(player.id)!,
  }));

  const firstAttendanceDateByPlayer = buildFirstAttendanceDateByPlayer(allTeamMatches);
  const overallRateByPlayer = new Map(
    players.map((player) => [
      player.id,
      overallAttendanceRate(
        player.id,
        firstAttendanceDateByPlayer.get(player.id) ?? null,
        allTeamMatches,
      ),
    ]),
  );

  const periodAttendanceByPlayer = new Map(
    players.map((player) => [
      player.id,
      periodAttendancePercent(
        player.id,
        firstAttendanceDateByPlayer.get(player.id) ?? null,
        quarterMatches,
      ),
    ]),
  );

  const rankings = RANKING_CATEGORIES.map((cat) => {
    if (!hasQuarterMatches) {
      return { key: cat.key, title: cat.title, items: [] as Array<never> };
    }

    let items: Array<{ rank: number; id: string; name: string; photo: string | null; value: number }>;

    if (cat.key === "attack") {
      items = buildTopRankings(playerAggs, (p) => p.perfAttack, overallRateByPlayer, 5).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: roundToTwoDecimal(p.value),
      }));
    } else if (cat.key === "defense") {
      items = buildTopRankings(playerAggs, (p) => p.perfDefense, overallRateByPlayer, 5).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: roundToTwoDecimal(p.value),
      }));
    } else if (cat.key === "goals") {
      items = buildTopRankings(playerAggs, (p) => p.goals, overallRateByPlayer, 5).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: p.value,
      }));
    } else if (cat.key === "assists") {
      items = buildTopRankings(playerAggs, (p) => p.assists, overallRateByPlayer, 5).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: p.value,
      }));
    } else if (cat.key === "attackPoints") {
      items = buildTopRankings(playerAggs, (p) => p.attackPoints, overallRateByPlayer, 5).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: p.value,
      }));
    } else if (cat.key === "goalsPerMatch") {
      items = buildTopRankings(
        playerAggs.filter((p) => p.matchCount > 0),
        (p) => p.goals / p.matchCount,
        overallRateByPlayer,
        5,
      ).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: roundToTwoDecimal(p.value),
      }));
    } else if (cat.key === "assistsPerMatch") {
      items = buildTopRankings(
        playerAggs.filter((p) => p.matchCount > 0),
        (p) => p.assists / p.matchCount,
        overallRateByPlayer,
        5,
      ).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: roundToTwoDecimal(p.value),
      }));
    } else if (cat.key === "attackPointsPerMatch") {
      items = buildTopRankings(
        playerAggs.filter((p) => p.matchCount > 0),
        (p) => p.attackPoints / p.matchCount,
        overallRateByPlayer,
        5,
      ).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: roundToTwoDecimal(p.value),
      }));
    } else {
      items = buildTopRankings(
        playerAggs,
        (p) => periodAttendanceByPlayer.get(p.id) ?? 0,
        overallRateByPlayer,
        5,
      ).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: p.value,
      }));
    }

    return { key: cat.key, title: cat.title, items };
  });

  const momIds = [
    ...new Set(recentMatchesRaw.map((match) => match.mom).filter((id): id is string => Boolean(id))),
  ];
  const momPlayers =
    momIds.length > 0
      ? await prisma.player.findMany({
          where: { id: { in: momIds } },
          select: { id: true, name: true },
        })
      : [];
  const momNameById = new Map(momPlayers.map((player) => [player.id, player.name]));

  const recentMatches = recentMatchesRaw.map((match) => ({
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
    momName: match.mom ? (momNameById.get(match.mom) ?? null) : null,
  }));

  return Response.json({
    quarterLabel: quarterInfo.label,
    hasQuarterMatches,
    rankings,
    recentMatches,
  });
}
