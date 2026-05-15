import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateTournamentCompletePayload } from "@/lib/tournament-complete-validation";

type RouteContext = {
  params: Promise<{ tournamentId: string }>;
};

function sumPerfByPlayer(
  matches: { playerStats: { playerId: string; perf_total: number }[] }[],
): Map<string, number> {
  const perfByPlayer = new Map<string, number>();
  for (const match of matches) {
    for (const stat of match.playerStats) {
      perfByPlayer.set(
        stat.playerId,
        (perfByPlayer.get(stat.playerId) ?? 0) + stat.perf_total,
      );
    }
  }
  return perfByPlayer;
}

function calcVScore(
  pickId: string | null,
  perfByPlayer: Map<string, number>,
  multiplier: number,
): number | null {
  if (!pickId) return null;
  return (perfByPlayer.get(pickId) ?? 0) * multiplier;
}

function calcVScoreOthers(
  attendees: string[],
  pickIds: Set<string>,
  perfByPlayer: Map<string, number>,
): { vScoreOthers: number | null; playerId: string | null } {
  let bestPerf: number | null = null;
  let bestPlayerId: string | null = null;

  for (const playerId of attendees) {
    if (pickIds.has(playerId)) continue;
    const perf = perfByPlayer.get(playerId) ?? 0;
    if (bestPerf === null || perf > bestPerf) {
      bestPerf = perf;
      bestPlayerId = playerId;
    }
  }

  return { vScoreOthers: bestPerf, playerId: bestPlayerId };
}

function calcFinalMvp(
  vScore1: number | null,
  pick1st: string | null,
  vScore2: number | null,
  pick2nd: string | null,
  vScore3: number | null,
  pick3rd: string | null,
  vScoreOthers: number | null,
  othersPlayerId: string | null,
): string | null {
  const candidates: { score: number; playerId: string }[] = [];

  if (vScore1 !== null && pick1st) {
    candidates.push({ score: vScore1, playerId: pick1st });
  }
  if (vScore2 !== null && pick2nd) {
    candidates.push({ score: vScore2, playerId: pick2nd });
  }
  if (vScore3 !== null && pick3rd) {
    candidates.push({ score: vScore3, playerId: pick3rd });
  }
  if (vScoreOthers !== null && othersPlayerId) {
    candidates.push({ score: vScoreOthers, playerId: othersPlayerId });
  }

  if (candidates.length === 0) return null;

  return candidates.reduce((best, candidate) =>
    candidate.score > best.score ? candidate : best,
  ).playerId;
}

export async function POST(_: Request, context: RouteContext) {
  const { tournamentId } = await context.params;

  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      team: true,
      matches: {
        include: {
          playerStats: {
            select: { playerId: true, perf_total: true },
          },
        },
      },
    },
  });

  if (!tournament) {
    return Response.json({ message: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!tournament.team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }
  if (tournament.is_completed) {
    return Response.json({ message: "이미 등록이 완료된 대회입니다." }, { status: 400 });
  }

  const message = validateTournamentCompletePayload({
    tournament_name: tournament.tournament_name,
    tournament_result: tournament.tournament_result,
    start_date: tournament.start_date,
    finish_date: tournament.finish_date,
    attendees: tournament.attendees,
    pick_1st: tournament.pick_1st,
    pick_2nd: tournament.pick_2nd,
    pick_3rd: tournament.pick_3rd,
    matches: tournament.matches.map((m) => ({
      date: m.date,
      stage: m.stage,
    })),
  });

  if (message) {
    return Response.json({ message }, { status: 400 });
  }

  const perfByPlayer = sumPerfByPlayer(tournament.matches);
  const pickIds = new Set(
    [tournament.pick_1st, tournament.pick_2nd, tournament.pick_3rd].filter(
      (id): id is string => id !== null,
    ),
  );

  const v_score1 = calcVScore(tournament.pick_1st, perfByPlayer, 1.5);
  const v_score2 = calcVScore(tournament.pick_2nd, perfByPlayer, 1.3);
  const v_score3 = calcVScore(tournament.pick_3rd, perfByPlayer, 1.1);
  const { vScoreOthers: v_score_others, playerId: othersPlayerId } =
    calcVScoreOthers(tournament.attendees, pickIds, perfByPlayer);
  const final_mvp = calcFinalMvp(
    v_score1,
    tournament.pick_1st,
    v_score2,
    tournament.pick_2nd,
    v_score3,
    tournament.pick_3rd,
    v_score_others,
    othersPlayerId,
  );

  const updated = await prisma.$transaction(async (tx) => {
    return tx.tournament.update({
      where: { id: tournamentId },
      data: {
        is_completed: true,
        v_score1,
        v_score2,
        v_score3,
        v_score_others,
        final_mvp,
      },
    });
  });

  return Response.json({ ok: true, tournamentId: updated.id });
}
