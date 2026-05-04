import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateTournamentCompletePayload } from "@/lib/tournament-complete-validation";

type RouteContext = {
  params: Promise<{ tournamentId: string }>;
};

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
      matches: true,
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

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      is_completed: true,
    },
  });

  return Response.json({ ok: true, tournamentId: updated.id });
}
