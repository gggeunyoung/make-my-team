import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const teams = await prisma.team.findMany({
    where: {
      OR: [{ operator: email }, { admins: { has: email } }],
    },
    include: {
      players: {
        where: { isActive: true },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      sportType: team.sport_type,
      logo: team.logo,
      color: team.color,
      accessCode: team.access_code,
      operator: team.operator,
      admins: team.admins,
      playerCount: team.players.length,
      createdAt: team.createdAt,
    })),
  });
}
