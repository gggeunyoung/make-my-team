import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  teamId?: string;
};

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const teamId = body.teamId?.trim() ?? "";
  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const created = await prisma.tournament.create({
    data: {
      teamId,
      attendees: [],
    },
  });

  return Response.json({ tournamentId: created.id });
}
