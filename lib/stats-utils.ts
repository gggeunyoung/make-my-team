export function roundToTwoDecimal(value: number) {
  return Math.round(value * 100) / 100;
}

export type TeamMatchForAttendance = {
  date: Date;
  attendees: string[];
};

export function overallAttendanceRate(
  playerId: string,
  playerCreatedAt: Date,
  teamMatches: TeamMatchForAttendance[],
): number {
  let total = 0;
  let attended = 0;
  for (const m of teamMatches) {
    if (m.date < playerCreatedAt) continue;
    total += 1;
    if (m.attendees.includes(playerId)) attended += 1;
  }
  return total === 0 ? 0 : attended / total;
}

export function periodAttendancePercent(
  playerId: string,
  playerCreatedAt: Date,
  periodMatches: TeamMatchForAttendance[],
): number {
  let total = 0;
  let attended = 0;
  for (const m of periodMatches) {
    if (m.date < playerCreatedAt) continue;
    total += 1;
    if (m.attendees.includes(playerId)) attended += 1;
  }
  return total === 0 ? 0 : Math.round((attended / total) * 100);
}

export type RankingPlayerBase = {
  id: string;
  name: string;
  photo: string | null;
  createdAt: Date;
};

export function compareRankingTiebreak(
  a: RankingPlayerBase,
  b: RankingPlayerBase,
  overallRateByPlayer: Map<string, number>,
): number {
  const rateA = overallRateByPlayer.get(a.id) ?? 0;
  const rateB = overallRateByPlayer.get(b.id) ?? 0;
  if (rateA !== rateB) return rateB - rateA;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function buildTopRankings<T extends RankingPlayerBase>(
  players: T[],
  getValue: (p: T) => number,
  overallRateByPlayer: Map<string, number>,
  limit = 5,
): Array<T & { rank: number; value: number }> {
  const sorted = [...players].sort((a, b) => {
    const diff = getValue(b) - getValue(a);
    if (diff !== 0) return diff;
    return compareRankingTiebreak(a, b, overallRateByPlayer);
  });

  const result: Array<T & { rank: number; value: number }> = [];
  for (let i = 0; i < sorted.length && result.length < limit; i += 1) {
    result.push({
      ...sorted[i]!,
      rank: result.length + 1,
      value: getValue(sorted[i]!),
    });
  }
  return result;
}
