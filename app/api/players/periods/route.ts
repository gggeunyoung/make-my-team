import { buildPeriodOptionsFromDates } from "@/lib/player-period";
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

  const matches = await prisma.match.findMany({
    where: { teamId },
    select: { date: true },
    orderBy: { date: "desc" },
  });

  const periods = buildPeriodOptionsFromDates(matches.map((m) => m.date));

  return Response.json({ periods });
}
