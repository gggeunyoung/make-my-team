import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ tournamentId: string; matchId: string }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  const { tournamentId, matchId } = await context.params;

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
  if (tournament.is_completed) {
    return Response.json({ message: "등록이 완료된 대회의 매치는 삭제할 수 없습니다." }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });
  if (!match || match.tournamentId !== tournamentId) {
    return Response.json({ message: "매치를 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.match.delete({
    where: { id: matchId },
  });

  return Response.json({ ok: true });
}
