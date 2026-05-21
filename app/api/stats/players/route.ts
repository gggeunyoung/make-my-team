import type { OpponentLevel } from "@/app/generated/prisma/enums";
import { parseSubPeriodRange, type PeriodType, PERIOD_TYPES } from "@/lib/player-period";
import { prisma } from "@/lib/prisma";
import {
  buildTopRankings,
  overallAttendanceRate,
  periodAttendancePercent,
  roundToTwoDecimal,
} from "@/lib/stats-utils";

const OPPONENT_LEVELS = new Set(["ALL", "TOP", "HIGH", "MID", "LOW"]);

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
  { key: "goals", title: "골 순위" },
  { key: "assists", title: "도움 순위" },
  { key: "attackPoints", title: "공격포인트 순위" },
  { key: "goalsPerMatch", title: "경기당 골 순위" },
  { key: "assistsPerMatch", title: "경기당 도움 순위" },
  { key: "attackPointsPerMatch", title: "경기당 공격포인트 순위" },
  { key: "attendanceRate", title: "출석률 순위" },
] as const;

export async function GET(req: Request) {
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

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }

  const levelFilter =
    opponentLevel === "ALL" ? {} : { opponent_level: opponentLevel as OpponentLevel };

  const [players, playerStats, periodMatches, allTeamMatches] = await Promise.all([
    prisma.player.findMany({
      where: { teamId, isActive: true },
      select: { id: true, name: true, photo: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.player_Stat.findMany({
      where: {
        teamId,
        match_date: { gte: range.start, lte: range.end },
        ...levelFilter,
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
        date: { gte: range.start, lte: range.end },
        ...(opponentLevel === "ALL" ? {} : { opponent_level: opponentLevel as OpponentLevel }),
      },
      select: { date: true, attendees: true },
    }),
    prisma.match.findMany({
      where: { teamId },
      select: { date: true, attendees: true },
    }),
  ]);

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

  const playerAggs: PlayerAgg[] = players.map((p) => {
    const agg = aggByPlayer.get(p.id)!;
    return { ...p, ...agg };
  });

  const overallRateByPlayer = new Map(
    players.map((p) => [p.id, overallAttendanceRate(p.id, p.createdAt, allTeamMatches)]),
  );

  const periodAttendanceByPlayer = new Map(
    players.map((p) => [p.id, periodAttendancePercent(p.id, p.createdAt, periodMatches)]),
  );

  const hasPeriodMatches = playerStats.length > 0;

  const rankings = RANKING_CATEGORIES.map((cat) => {
    if (!hasPeriodMatches) {
      return { key: cat.key, title: cat.title, items: [] as Array<never> };
    }

    let items: Array<{ rank: number; id: string; name: string; photo: string | null; value: number }>;

    if (cat.key === "attack") {
      items = buildTopRankings(playerAggs, (p) => p.perfAttack, overallRateByPlayer).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: roundToTwoDecimal(p.value),
      }));
    } else if (cat.key === "defense") {
      items = buildTopRankings(playerAggs, (p) => p.perfDefense, overallRateByPlayer).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: roundToTwoDecimal(p.value),
      }));
    } else if (cat.key === "goals") {
      items = buildTopRankings(playerAggs, (p) => p.goals, overallRateByPlayer).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: p.value,
      }));
    } else if (cat.key === "assists") {
      items = buildTopRankings(playerAggs, (p) => p.assists, overallRateByPlayer).map((p) => ({
        rank: p.rank,
        id: p.id,
        name: p.name,
        photo: p.photo,
        value: p.value,
      }));
    } else if (cat.key === "attackPoints") {
      items = buildTopRankings(playerAggs, (p) => p.attackPoints, overallRateByPlayer).map((p) => ({
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

  const table = playerAggs.map((p) => {
    const divisor = p.matchCount > 0 ? p.matchCount : 1;
    return {
      id: p.id,
      name: p.name,
      photo: p.photo,
      goals: p.goals,
      assists: p.assists,
      attackPoints: p.attackPoints,
      goalsPerMatch: roundToTwoDecimal(p.matchCount > 0 ? p.goals / divisor : 0),
      assistsPerMatch: roundToTwoDecimal(p.matchCount > 0 ? p.assists / divisor : 0),
      attackPointsPerMatch: roundToTwoDecimal(p.matchCount > 0 ? p.attackPoints / divisor : 0),
      attendanceRate: periodAttendanceByPlayer.get(p.id) ?? 0,
      perfAttack: roundToTwoDecimal(p.perfAttack),
      perfDefense: roundToTwoDecimal(p.perfDefense),
      matchCount: p.matchCount,
    };
  });

  return Response.json({ hasPeriodMatches, rankings, table });
}
