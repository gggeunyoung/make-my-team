import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uploadPlayerPhotoToSupabase } from "@/lib/player-server";
import { isPlayerStyle, normalizePlayerName, parsePlayerPositions } from "@/lib/player";

type CreatePlayerBody = {
  teamId?: string;
  name?: string;
  photo?: string | null;
  style?: string;
  position?: string[];
};

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json()) as CreatePlayerBody;
  const teamId = body.teamId?.trim() ?? "";
  const name = normalizePlayerName(body.name ?? "");
  const rawPhoto = body.photo?.trim() || null;
  const style = body.style?.trim() ?? "";
  const positions = parsePlayerPositions(body.position);

  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }
  if (!name) {
    return Response.json({ message: "선수 이름은 필수입니다." }, { status: 400 });
  }
  if (!isPlayerStyle(style)) {
    return Response.json({ message: "선수 스타일을 선택해주세요." }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const duplicated = await prisma.player.findFirst({
    where: {
      teamId,
      isActive: true,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (duplicated) {
    return Response.json({ message: "같은 팀 내에 동일한 선수 이름이 이미 존재합니다." }, { status: 409 });
  }

  let photo: string | null = null;
  if (rawPhoto) {
    try {
      photo = await uploadPlayerPhotoToSupabase({
        teamId,
        rawPhoto,
      });
    } catch (error) {
      console.error("[player-create] Photo upload failed.", {
        teamId,
        message: error instanceof Error ? error.message : String(error),
      });
      return Response.json({ message: "선수 사진 업로드에 실패했습니다." }, { status: 400 });
    }
  }

  const player = await prisma.player.create({
    data: {
      teamId,
      name,
      photo,
      style,
      position: team.sport_type === "SOCCER" ? positions : [],
      isActive: true,
    },
  });

  return Response.json({
    player: {
      id: player.id,
      name: player.name,
      photo: player.photo,
      style: player.style,
      position: player.position,
      teamId: player.teamId,
      isActive: player.isActive,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
    },
  });
}
