import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uploadPlayerPhotoToSupabase } from "@/lib/player-server";
import { isPlayerStyle, normalizePlayerName, parsePlayerPositions } from "@/lib/player";
import { revalidatePath } from "next/cache";

type RouteContext = {
  params: Promise<{ playerId: string }>;
};

type UpdatePlayerBody = {
  name?: string;
  photo?: string | null;
  style?: string;
  position?: string[];
};

export async function PUT(req: Request, context: RouteContext) {
  const { playerId } = await context.params;
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const existingPlayer = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: true },
  });
  if (!existingPlayer || !existingPlayer.isActive) {
    return Response.json({ message: "선수를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!existingPlayer.team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json()) as UpdatePlayerBody;
  const name = normalizePlayerName(body.name ?? "");
  const rawPhoto = typeof body.photo === "string" ? body.photo.trim() : body.photo;
  const style = body.style?.trim() ?? "";
  const positions = parsePlayerPositions(body.position);

  if (!name) {
    return Response.json({ message: "선수 이름은 필수입니다." }, { status: 400 });
  }
  if (!isPlayerStyle(style)) {
    return Response.json({ message: "선수 스타일을 선택해주세요." }, { status: 400 });
  }

  const duplicated = await prisma.player.findFirst({
    where: {
      id: { not: existingPlayer.id },
      teamId: existingPlayer.teamId,
      isActive: true,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (duplicated) {
    return Response.json({ message: "같은 팀 내에 동일한 선수 이름이 이미 존재합니다." }, { status: 409 });
  }

  let photo: string | null = existingPlayer.photo;
  if (rawPhoto === null) {
    photo = null;
  } else if (typeof rawPhoto === "string" && rawPhoto.startsWith("data:image/")) {
    try {
      photo = await uploadPlayerPhotoToSupabase({
        teamId: existingPlayer.teamId,
        rawPhoto,
      });
    } catch (error) {
      console.error("[player-update] Photo upload failed.", {
        playerId: existingPlayer.id,
        teamId: existingPlayer.teamId,
        message: error instanceof Error ? error.message : String(error),
      });
      return Response.json({ message: "선수 사진 업로드에 실패했습니다." }, { status: 400 });
    }
  } else if (rawPhoto === "") {
    photo = null;
  } else if (typeof rawPhoto === "string" && rawPhoto) {
    photo = rawPhoto;
  }

  const player = await prisma.player.update({
    where: { id: existingPlayer.id },
    data: {
      name,
      photo,
      style,
      position: existingPlayer.team.sport_type === "SOCCER" ? positions : [],
    },
  });

  revalidatePath("/team/[teamId]", "page");
  revalidatePath("/team/[teamId]/manager", "page");

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
