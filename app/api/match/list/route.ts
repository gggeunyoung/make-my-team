import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")?.trim() ?? "";
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

  const matches = await prisma.match.findMany({
    where: { teamId, is_tournament: false },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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
      match_format_futsal: true,
      createdAt: true,
    },
  });

  return Response.json({ matches });
}
