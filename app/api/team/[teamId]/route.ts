import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateTeamNameUnits } from "@/lib/team";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

type RouteContext = {
  params: Promise<{ teamId: string }>;
};

function isHexColor(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

async function convertLogoToJpegDataUrl(logo: string) {
  const match = logo.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) {
    throw new Error("INVALID_IMAGE_DATA");
  }

  const imageBuffer = Buffer.from(match[1], "base64");
  const converted = await sharp(imageBuffer)
    .resize(1024, 1024, { fit: "cover" })
    .jpeg({ quality: 90 })
    .toBuffer();

  return `data:image/jpeg;base64,${converted.toString("base64")}`;
}

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

export async function PATCH(req: Request, context: RouteContext) {
  const { teamId } = await context.params;
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    logo?: string | null;
    color?: string;
  };

  const name = body.name?.trim() ?? "";
  const rawLogo = body.logo?.trim() || null;
  const color = body.color?.trim() ?? "";
  const units = calculateTeamNameUnits(name);

  if (units < 2 || units > 30) {
    return Response.json({ message: "팀 이름은 2~30 Unit이어야 합니다." }, { status: 400 });
  }
  if (!isHexColor(color)) {
    return Response.json({ message: "유효한 팀 색상을 선택해주세요." }, { status: 400 });
  }

  let logo: string | null = null;
  if (rawLogo) {
    try {
      logo = await convertLogoToJpegDataUrl(rawLogo);
    } catch {
      return Response.json({ message: "이미지 변환에 실패했습니다." }, { status: 400 });
    }
  }

  const updatedTeam = await prisma.team.update({
    where: { id: teamId },
    data: {
      name,
      logo,
      color,
    },
  });
  revalidatePath("/team/[teamId]", "page");

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
      players: updatedTeam.players,
      createdAt: updatedTeam.createdAt,
    },
  });
}
