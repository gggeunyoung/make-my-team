import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSessionIdentity } from "@/lib/session";

export async function POST(req: Request) {
  const session = await auth();
  const { email, provider, providerAccountId } = getSessionIdentity(session);
  const resolvedEmail =
    email ??
    (
      provider && providerAccountId
        ? (
            await prisma.user.findUnique({
              where: {
                provider_providerAccountId: {
                  provider,
                  providerAccountId,
                },
              },
              select: { email: true },
            })
          )?.email?.trim()
        : undefined
    );
  if (!resolvedEmail) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json()) as { accessCode?: string };
  const accessCode = body.accessCode?.trim().toUpperCase() ?? "";

  if (!accessCode || accessCode.length !== 6) {
    return Response.json({ message: "6자리 운영자 코드를 입력해주세요." }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { access_code: accessCode },
  });

  if (!team) {
    return Response.json(
      { message: "유효하지 않은 코드입니다.", reason: "INVALID_CODE" },
      { status: 404 },
    );
  }

  const isMember = team.operator === resolvedEmail || team.admins.includes(resolvedEmail);

  if (isMember) {
    return Response.json(
      { message: "이미 있는 팀입니다.", reason: "ALREADY_MEMBER" },
      { status: 409 },
    );
  }

  const updatedTeam = await prisma.team.update({
    where: { id: team.id },
    data: {
      admins: {
        push: resolvedEmail,
      },
    },
  });
  const playerCount = await prisma.player.count({
    where: {
      teamId: updatedTeam.id,
      isActive: true,
    },
  });

  return Response.json({
    team: {
      id: updatedTeam.id,
      name: updatedTeam.name,
      sportType: updatedTeam.sport_type,
      logo: updatedTeam.logo,
      color: updatedTeam.color,
      accessCode: updatedTeam.access_code,
      operator: updatedTeam.operator,
      admins: updatedTeam.admins,
      playerCount,
      createdAt: updatedTeam.createdAt,
    },
  });
}
