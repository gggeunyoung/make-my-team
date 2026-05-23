import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import type { AwardCategory, AwardPeriod } from "@/app/generated/prisma/enums";
import {
  getHalfFromDate,
  getHalfRange,
  getMonthRange,
  getQuarterFromDate,
  getQuarterRange,
  getYearRange,
} from "@/lib/player-period";
import {
  compareRankingTiebreak,
  overallAttendanceRate,
  periodAttendancePercent,
  roundToTwoDecimal,
  type RankingPlayerBase,
  type TeamMatchForAttendance,
} from "@/lib/stats-utils";

type Tx = Prisma.TransactionClient;
type DbClient = PrismaClient | Tx;

export type PeriodDateRange = {
  start: Date;
  end: Date;
};

export type AwardDraft = {
  playerId: string;
  teamId: string;
  period: AwardPeriod;
  subPeriod: string;
  category: AwardCategory;
  rank: number;
  statValue: number;
};

export type PastSubPeriod = {
  period: AwardPeriod;
  subPeriod: string;
};

const AWARD_PERIODS: AwardPeriod[] = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"];

const MONTHLY_SKIP_CATEGORIES = new Set<AwardCategory>([
  "STRONG_VS_TOP",
  "STRONG_VS_LOW",
  "ATTENDANCE",
]);

function newAwardId() {
  return crypto.randomUUID();
}

export function getSubPeriodLabel(period: AwardPeriod, date: Date): string {
  const year = date.getFullYear();

  if (period === "MONTHLY") {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  if (period === "QUARTERLY") {
    return `${year}-Q${getQuarterFromDate(date)}`;
  }

  if (period === "SEMIANNUAL") {
    return `${year}-H${getHalfFromDate(date)}`;
  }

  return String(year);
}

export function getPeriodDateRange(period: AwardPeriod, subPeriod: string): PeriodDateRange | null {
  if (period === "MONTHLY") {
    const match = /^(\d{4})-(\d{2})$/.exec(subPeriod);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    return getMonthRange(year, month);
  }

  if (period === "QUARTERLY") {
    const match = /^(\d{4})-Q([1-4])$/.exec(subPeriod);
    if (!match) return null;
    return getQuarterRange(Number(match[1]), Number(match[2]));
  }

  if (period === "SEMIANNUAL") {
    const match = /^(\d{4})-H([12])$/.exec(subPeriod);
    if (!match) return null;
    return getHalfRange(Number(match[1]), Number(match[2]) as 1 | 2);
  }

  if (period === "ANNUAL") {
    const match = /^(\d{4})$/.exec(subPeriod);
    if (!match) return null;
    return getYearRange(Number(match[1]));
  }

  return null;
}

function startOfSubPeriod(period: AwardPeriod, date: Date): Date {
  const label = getSubPeriodLabel(period, date);
  const range = getPeriodDateRange(period, label);
  return range?.start ?? date;
}

function advanceDateForPeriod(period: AwardPeriod, date: Date): Date {
  const next = new Date(date);

  if (period === "MONTHLY") {
    next.setMonth(next.getMonth() + 1, 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  if (period === "QUARTERLY") {
    next.setMonth(next.getMonth() + 3, 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  if (period === "SEMIANNUAL") {
    next.setMonth(next.getMonth() + 6, 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  next.setFullYear(next.getFullYear() + 1, 0, 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function generateSubPeriodLabels(period: AwardPeriod, from: Date, to: Date): string[] {
  const labels: string[] = [];
  let cursor = startOfSubPeriod(period, from);
  const endTime = to.getTime();

  while (cursor.getTime() <= endTime) {
    labels.push(getSubPeriodLabel(period, cursor));
    cursor = advanceDateForPeriod(period, cursor);
  }

  return labels;
}

export async function getPastSubPeriods(
  period: AwardPeriod,
  teamId: string,
  prisma: DbClient,
  now = new Date(),
): Promise<string[]> {
  const oldestMatch = await prisma.match.findFirst({
    where: { teamId },
    orderBy: { date: "asc" },
    select: { date: true },
  });

  if (!oldestMatch) {
    return [];
  }

  const currentLabel = getSubPeriodLabel(period, now);
  const seen = new Set<string>();

  return generateSubPeriodLabels(period, oldestMatch.date, now).filter((label) => {
    if (label === currentLabel || seen.has(label)) {
      return false;
    }
    seen.add(label);
    return true;
  });
}

type AwardPlayer = RankingPlayerBase & {
  isActive: boolean;
};

type RankedAwardCandidate = RankingPlayerBase & {
  rank: number;
  value: number;
};

type ComboPairCandidate = {
  playerAId: string;
  playerBId: string;
  value: number;
  tiebreakPlayer: RankingPlayerBase;
};

function buildAwardRankings<T extends RankingPlayerBase>(
  candidates: T[],
  getValue: (candidate: T) => number,
  overallRateByPlayer: Map<string, number>,
  limit = 3,
): RankedAwardCandidate[] {
  const sorted = candidates
    .filter((candidate) => getValue(candidate) > 0)
    .sort((a, b) => {
      const diff = getValue(b) - getValue(a);
      if (diff !== 0) return diff;
      return compareRankingTiebreak(a, b, overallRateByPlayer);
    });

  const result: RankedAwardCandidate[] = [];
  for (let i = 0; i < sorted.length && result.length < limit; i += 1) {
    const candidate = sorted[i]!;
    result.push({
      id: candidate.id,
      name: candidate.name,
      photo: candidate.photo,
      createdAt: candidate.createdAt,
      rank: result.length + 1,
      value: getValue(candidate),
    });
  }

  return result;
}

function buildComboPairRankings(
  pairs: ComboPairCandidate[],
  overallRateByPlayer: Map<string, number>,
  limit = 3,
): Array<ComboPairCandidate & { rank: number }> {
  const sorted = pairs
    .filter((pair) => pair.value > 0)
    .sort((a, b) => {
      const diff = b.value - a.value;
      if (diff !== 0) return diff;
      return compareRankingTiebreak(a.tiebreakPlayer, b.tiebreakPlayer, overallRateByPlayer);
    });

  const result: Array<ComboPairCandidate & { rank: number }> = [];
  for (let i = 0; i < sorted.length && result.length < limit; i += 1) {
    result.push({
      ...sorted[i]!,
      rank: result.length + 1,
    });
  }

  return result;
}

function canonicalizePair(
  scorerId: string,
  assisterId: string,
  nameById: Map<string, string>,
): [string, string] {
  const scorerName = nameById.get(scorerId) ?? "";
  const assisterName = nameById.get(assisterId) ?? "";
  return scorerName.localeCompare(assisterName, "ko") <= 0
    ? [scorerId, assisterId]
    : [assisterId, scorerId];
}

function toAwardDrafts(
  teamId: string,
  period: AwardPeriod,
  subPeriod: string,
  category: AwardCategory,
  ranked: RankedAwardCandidate[],
  roundStatValue = false,
): AwardDraft[] {
  return ranked.map((item) => ({
    playerId: item.id,
    teamId,
    period,
    subPeriod,
    category,
    rank: item.rank,
    statValue: roundStatValue ? roundToTwoDecimal(item.value) : item.value,
  }));
}

function shouldSkipCategory(period: AwardPeriod, category: AwardCategory) {
  return period === "MONTHLY" && MONTHLY_SKIP_CATEGORIES.has(category);
}

export async function calculateAwardsForPeriod(
  tx: Tx,
  teamId: string,
  period: AwardPeriod,
  subPeriod: string,
): Promise<AwardDraft[]> {
  const range = getPeriodDateRange(period, subPeriod);
  if (!range) {
    return [];
  }

  const periodMatches = await tx.match.findMany({
    where: {
      teamId,
      date: { gte: range.start, lte: range.end },
    },
    select: { id: true, date: true, attendees: true },
  });

  if (periodMatches.length < 3) {
    return [];
  }

  const [players, playerStats, allTeamMatches, periodGoalEvents] = await Promise.all([
    tx.player.findMany({
      where: { teamId },
      select: { id: true, name: true, photo: true, createdAt: true, isActive: true },
    }),
    tx.player_Stat.findMany({
      where: {
        teamId,
        match_date: { gte: range.start, lte: range.end },
      },
      select: {
        playerId: true,
        goals: true,
        assist: true,
        attack_point: true,
        perf_attack: true,
        perf_defense: true,
        perf_total: true,
        opponent_level: true,
      },
    }),
    tx.match.findMany({
      where: { teamId },
      select: { date: true, attendees: true },
    }),
    tx.goalEvent.findMany({
      where: {
        matchId: { in: periodMatches.map((match) => match.id) },
        scorer_type: "PLAYER",
        assister_type: "PLAYER",
      },
      select: {
        scorer_id: true,
        assister_id: true,
      },
    }),
  ]);

  const playerById = new Map(players.map((player) => [player.id, player]));
  const awards: AwardDraft[] = [];
  const teamMatchesForAttendance: TeamMatchForAttendance[] = allTeamMatches;
  const periodMatchesForAttendance: TeamMatchForAttendance[] = periodMatches;
  const overallRateByPlayer = new Map(
    players.map((player) => [
      player.id,
      overallAttendanceRate(player.id, player.createdAt, teamMatchesForAttendance),
    ]),
  );

  const sumByPlayer = (
    selector: (stat: (typeof playerStats)[number]) => number,
    filter?: (stat: (typeof playerStats)[number]) => boolean,
  ) => {
    const totals = new Map<string, number>();
    for (const stat of playerStats) {
      if (filter && !filter(stat)) continue;
      totals.set(stat.playerId, (totals.get(stat.playerId) ?? 0) + selector(stat));
    }
    return totals;
  };

  const countByPlayer = (filter: (stat: (typeof playerStats)[number]) => boolean) => {
    const counts = new Map<string, number>();
    for (const stat of playerStats) {
      if (!filter(stat)) continue;
      counts.set(stat.playerId, (counts.get(stat.playerId) ?? 0) + 1);
    }
    return counts;
  };

  const playersForRanking = (playerIds: Iterable<string>): AwardPlayer[] =>
    [...playerIds]
      .map((playerId) => playerById.get(playerId))
      .filter((player): player is AwardPlayer => player !== undefined);

  const attackTotals = sumByPlayer((stat) => stat.perf_attack);
  awards.push(
    ...toAwardDrafts(
      teamId,
      period,
      subPeriod,
      "ATTACK_RANKING",
      buildAwardRankings(
        playersForRanking(attackTotals.keys()),
        (player) => attackTotals.get(player.id) ?? 0,
        overallRateByPlayer,
      ),
      true,
    ),
  );

  const defenseTotals = sumByPlayer((stat) => stat.perf_defense);
  awards.push(
    ...toAwardDrafts(
      teamId,
      period,
      subPeriod,
      "DEFENSE_RANKING",
      buildAwardRankings(
        playersForRanking(defenseTotals.keys()),
        (player) => defenseTotals.get(player.id) ?? 0,
        overallRateByPlayer,
      ),
      true,
    ),
  );

  if (!shouldSkipCategory(period, "ATTACK_COMBO")) {
    const nameById = new Map(players.map((player) => [player.id, player.name]));
    const pairCounts = new Map<string, number>();

    for (const event of periodGoalEvents) {
      const scorerId = event.scorer_id;
      const assisterId = event.assister_id;
      if (!scorerId || !assisterId) continue;

      const [playerAId, playerBId] = canonicalizePair(scorerId, assisterId, nameById);
      const pairKey = `${playerAId}:${playerBId}`;
      pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
    }

    const comboCandidates: ComboPairCandidate[] = [...pairCounts.entries()].map(([pairKey, value]) => {
      const [playerAId, playerBId] = pairKey.split(":");
      const tiebreakPlayer = playerById.get(playerAId)!;
      return {
        playerAId: playerAId!,
        playerBId: playerBId!,
        value,
        tiebreakPlayer: {
          id: tiebreakPlayer.id,
          name: tiebreakPlayer.name,
          photo: tiebreakPlayer.photo,
          createdAt: tiebreakPlayer.createdAt,
        },
      };
    });

    for (const pair of buildComboPairRankings(comboCandidates, overallRateByPlayer)) {
      for (const playerId of [pair.playerAId, pair.playerBId]) {
        awards.push({
          playerId,
          teamId,
          period,
          subPeriod,
          category: "ATTACK_COMBO",
          rank: pair.rank,
          statValue: pair.value,
        });
      }
    }
  }

  const goalTotals = sumByPlayer((stat) => stat.goals);
  awards.push(
    ...toAwardDrafts(
      teamId,
      period,
      subPeriod,
      "TOP_SCORER",
      buildAwardRankings(
        playersForRanking(goalTotals.keys()),
        (player) => goalTotals.get(player.id) ?? 0,
        overallRateByPlayer,
      ),
    ),
  );

  const assistTotals = sumByPlayer((stat) => stat.assist);
  awards.push(
    ...toAwardDrafts(
      teamId,
      period,
      subPeriod,
      "TOP_ASSIST",
      buildAwardRankings(
        playersForRanking(assistTotals.keys()),
        (player) => assistTotals.get(player.id) ?? 0,
        overallRateByPlayer,
      ),
    ),
  );

  const attackPointTotals = sumByPlayer((stat) => stat.attack_point);
  awards.push(
    ...toAwardDrafts(
      teamId,
      period,
      subPeriod,
      "ATTACK_POINT",
      buildAwardRankings(
        playersForRanking(attackPointTotals.keys()),
        (player) => attackPointTotals.get(player.id) ?? 0,
        overallRateByPlayer,
      ),
    ),
  );

  if (!shouldSkipCategory(period, "STRONG_VS_TOP")) {
    const strongVsTopTotals = sumByPlayer(
      (stat) => stat.perf_total,
      (stat) => stat.opponent_level === "TOP" || stat.opponent_level === "HIGH",
    );
    const strongVsTopMatchCounts = countByPlayer(
      (stat) => stat.opponent_level === "TOP" || stat.opponent_level === "HIGH",
    );

    awards.push(
      ...toAwardDrafts(
        teamId,
        period,
        subPeriod,
        "STRONG_VS_TOP",
        buildAwardRankings(
          playersForRanking(strongVsTopTotals.keys()).filter(
            (player) => (strongVsTopMatchCounts.get(player.id) ?? 0) >= 1,
          ),
          (player) => strongVsTopTotals.get(player.id) ?? 0,
          overallRateByPlayer,
        ),
        true,
      ),
    );
  }

  if (!shouldSkipCategory(period, "STRONG_VS_LOW")) {
    const strongVsLowTotals = sumByPlayer(
      (stat) => stat.perf_total,
      (stat) => stat.opponent_level === "LOW",
    );
    const strongVsLowMatchCounts = countByPlayer((stat) => stat.opponent_level === "LOW");

    awards.push(
      ...toAwardDrafts(
        teamId,
        period,
        subPeriod,
        "STRONG_VS_LOW",
        buildAwardRankings(
          playersForRanking(strongVsLowTotals.keys()).filter(
            (player) => (strongVsLowMatchCounts.get(player.id) ?? 0) >= 1,
          ),
          (player) => strongVsLowTotals.get(player.id) ?? 0,
          overallRateByPlayer,
        ),
        true,
      ),
    );
  }

  if (!shouldSkipCategory(period, "ATTENDANCE")) {
    const activePlayers = players.filter((player) => player.isActive);
    awards.push(
      ...toAwardDrafts(
        teamId,
        period,
        subPeriod,
        "ATTENDANCE",
        buildAwardRankings(
          activePlayers,
          (player) =>
            periodAttendancePercent(player.id, player.createdAt, periodMatchesForAttendance),
          overallRateByPlayer,
        ),
      ),
    );
  }

  const bestPlayerTotals = sumByPlayer((stat) => stat.perf_total);
  awards.push(
    ...toAwardDrafts(
      teamId,
      period,
      subPeriod,
      "BEST_PLAYER",
      buildAwardRankings(
        playersForRanking(bestPlayerTotals.keys()),
        (player) => bestPlayerTotals.get(player.id) ?? 0,
        overallRateByPlayer,
      ),
      true,
    ),
  );

  return awards;
}

export async function saveAwards(tx: Tx, awards: AwardDraft[]): Promise<void> {
  for (const award of awards) {
    if (award.category === "ATTACK_COMBO") {
      const existing = await tx.award.findFirst({
        where: {
          teamId: award.teamId,
          period: award.period,
          subPeriod: award.subPeriod,
          category: award.category,
          rank: award.rank,
          playerId: award.playerId,
        },
      });

      if (existing) {
        await tx.award.update({
          where: { id: existing.id },
          data: { statValue: award.statValue },
        });
      } else {
        await tx.award.create({
          data: {
            id: newAwardId(),
            ...award,
          },
        });
      }
      continue;
    }

    await tx.award.upsert({
      where: {
        teamId_period_subPeriod_category_rank: {
          teamId: award.teamId,
          period: award.period,
          subPeriod: award.subPeriod,
          category: award.category,
          rank: award.rank,
        },
      },
      create: {
        id: newAwardId(),
        ...award,
      },
      update: {
        playerId: award.playerId,
        statValue: award.statValue,
      },
    });
  }
}

async function hasSavedAwards(
  tx: Tx,
  teamId: string,
  period: AwardPeriod,
  subPeriod: string,
): Promise<boolean> {
  const existing = await tx.award.findFirst({
    where: { teamId, period, subPeriod },
    select: { id: true },
  });
  return existing !== null;
}

export async function processPastAwardsAllTeams(prisma: PrismaClient): Promise<void> {
  const teams = await prisma.team.findMany({
    select: { id: true },
  });

  for (const team of teams) {
    await prisma.$transaction(async (tx) => {
      for (const period of AWARD_PERIODS) {
        const subPeriods = await getPastSubPeriods(period, team.id, tx);

        for (const subPeriod of subPeriods) {
          if (await hasSavedAwards(tx, team.id, period, subPeriod)) {
            continue;
          }

          const awards = await calculateAwardsForPeriod(tx, team.id, period, subPeriod);
          if (awards.length === 0) {
            continue;
          }

          await saveAwards(tx, awards);
        }
      }
    });
  }
}
