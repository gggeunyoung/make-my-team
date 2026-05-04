import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type RouteContext = {
  params: Promise<{ playerId: string }>;
};

export async function PUT(_: Request, context: RouteContext) {
  const { playerId } = await context.params;
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: true },
  });
  if (!player || !player.isActive) {
    return Response.json({ message: "선수를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!player.team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const deactivated = await prisma.player.update({
    where: { id: playerId },
    data: { isActive: false },
  });

  revalidatePath("/team/[teamId]", "page");
  revalidatePath("/team/[teamId]/manager", "page");

  return Response.json({
    player: {
      id: deactivated.id,
      isActive: deactivated.isActive,
    },
  });
}
