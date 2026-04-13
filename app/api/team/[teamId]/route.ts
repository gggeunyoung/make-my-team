import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ teamId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { teamId } = await context.params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }

  return Response.json({
    team: {
      id: team.id,
      name: team.name,
      sportType: team.sport_type,
      logo: team.logo,
      color: team.color,
      accessCode: team.access_code,
      operator: team.operator,
      admins: team.admins,
      players: team.players,
      createdAt: team.createdAt,
    },
  });
}
