import { prisma } from "@/lib/prisma";
import { buildFirstAttendanceDateByPlayer, overallAttendanceRate } from "@/lib/stats-utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")?.trim() ?? "";
  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, sport_type: true },
  });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }

  const [players, allTeamMatches] = await Promise.all([
    prisma.player.findMany({
      where: { teamId, isActive: true },
      select: {
        id: true,
        name: true,
        photo: true,
        style: true,
        position: true,
        createdAt: true,
      },
    }),
    prisma.match.findMany({
      where: { teamId },
      select: { date: true, attendees: true },
    }),
  ]);

  const firstAttendanceDateByPlayer = buildFirstAttendanceDateByPlayer(allTeamMatches);
  const overallRateByPlayer = new Map(
    players.map((p) => [
      p.id,
      overallAttendanceRate(
        p.id,
        firstAttendanceDateByPlayer.get(p.id) ?? null,
        allTeamMatches,
      ),
    ]),
  );

  const sortedPlayers = [...players].sort((a, b) => {
    const rateDiff = (overallRateByPlayer.get(b.id) ?? 0) - (overallRateByPlayer.get(a.id) ?? 0);
    if (rateDiff !== 0) return rateDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return Response.json({
    sportType: team.sport_type,
    players: sortedPlayers.map(({ id, name, photo, style, position }) => ({
      id,
      name,
      photo,
      style,
      position,
    })),
  });
}
