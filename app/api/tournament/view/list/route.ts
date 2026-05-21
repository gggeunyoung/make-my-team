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

  const tournaments = await prisma.tournament.findMany({
    where: { teamId, is_completed: true },
    orderBy: [{ finish_date: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      tournament_name: true,
      tournament_result: true,
      start_date: true,
      finish_date: true,
      final_mvp: true,
    },
  });

  const mvpIds = [...new Set(tournaments.map((t) => t.final_mvp).filter((id): id is string => !!id))];
  const mvpPlayers =
    mvpIds.length > 0
      ? await prisma.player.findMany({
          where: { id: { in: mvpIds } },
          select: { id: true, name: true },
        })
      : [];
  const mvpNameById = new Map(mvpPlayers.map((p) => [p.id, p.name]));

  return Response.json({
    tournaments: tournaments.map((t) => ({
      id: t.id,
      tournamentName: t.tournament_name,
      tournamentResult: t.tournament_result,
      startDate: t.start_date?.toISOString() ?? null,
      finishDate: t.finish_date?.toISOString() ?? null,
      mvpName: t.final_mvp ? (mvpNameById.get(t.final_mvp) ?? null) : null,
    })),
  });
}
