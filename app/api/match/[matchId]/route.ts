import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ matchId: string }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  const { matchId } = await context.params;

  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { team: true },
  });
  if (!match) {
    return Response.json({ message: "매치를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!match.team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  await prisma.match.delete({
    where: { id: match.id },
  });

  return Response.json({ ok: true });
}
