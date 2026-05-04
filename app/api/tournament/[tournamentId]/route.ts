import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPlayerIdsReferencedInTournamentMatches } from "@/lib/tournament-attendee-records";

type RouteContext = {
  params: Promise<{ tournamentId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { tournamentId } = await context.params;

  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      matches: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!tournament) {
    return Response.json({ message: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const team = await prisma.team.findUnique({ where: { id: tournament.teamId } });
  if (!team || !team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const attendeeRemovalBlockedIds = [...(await getPlayerIdsReferencedInTournamentMatches(prisma, tournamentId))];

  return Response.json({
    tournament: {
      id: tournament.id,
      teamId: tournament.teamId,
      tournament_name: tournament.tournament_name,
      tournament_result: tournament.tournament_result,
      start_date: tournament.start_date?.toISOString() ?? null,
      finish_date: tournament.finish_date?.toISOString() ?? null,
      attendees: tournament.attendees,
      pick_1st: tournament.pick_1st,
      pick_2nd: tournament.pick_2nd,
      pick_3rd: tournament.pick_3rd,
      v_score1: tournament.v_score1,
      v_score2: tournament.v_score2,
      v_score3: tournament.v_score3,
      v_score_others: tournament.v_score_others,
      final_mvp: tournament.final_mvp,
      is_completed: tournament.is_completed,
      matches: tournament.matches.map((m) => ({
        id: m.id,
        opponent_name: m.opponent_name,
        opponent_level: m.opponent_level,
        date: m.date.toISOString(),
        total_score_us: m.total_score_us,
        total_score_them: m.total_score_them,
        total_result: m.total_result,
        count_win: m.count_win,
        count_draw: m.count_draw,
        count_loss: m.count_loss,
        stage: m.stage,
        is_pso: m.is_pso,
        pso_result: m.pso_result,
      })),
      attendeeRemovalBlockedIds,
    },
  });
}

export async function DELETE(_: Request, context: RouteContext) {
  const { tournamentId } = await context.params;

  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { team: true },
  });
  if (!tournament) {
    return Response.json({ message: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!tournament.team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  await prisma.tournament.delete({
    where: { id: tournamentId },
  });

  return Response.json({ ok: true });
}
