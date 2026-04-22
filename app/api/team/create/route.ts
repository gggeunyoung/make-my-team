import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateTeamNameUnits, generateAccessCode, validateSportType } from "@/lib/team";
import sharp from "sharp";

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

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json()) as {
    name?: string;
    sportType?: string;
    logo?: string | null;
    color?: string;
  };

  const name = body.name?.trim() ?? "";
  const sportType = body.sportType?.trim() ?? "";
  const rawLogo = body.logo?.trim() || null;
  const color = body.color?.trim() ?? "";
  const units = calculateTeamNameUnits(name);

  if (units < 2 || units > 30) {
    return Response.json({ message: "팀 이름은 2~30 Unit이어야 합니다." }, { status: 400 });
  }
  if (!validateSportType(sportType)) {
    return Response.json({ message: "팀 유형을 선택해주세요." }, { status: 400 });
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

  for (let i = 0; i < 10; i += 1) {
    const accessCode = generateAccessCode(6);
    try {
      const team = await prisma.team.create({
        data: {
          name,
          sport_type: sportType,
          logo,
          color,
          access_code: accessCode,
          operator: email,
          admins: [email],
        },
      });

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
          playerCount: 0,
          createdAt: team.createdAt,
        },
      });
    } catch (error) {
      const prismaError = error as { code?: string };
      if (prismaError.code !== "P2002") {
        throw error;
      }
    }
  }

  return Response.json(
    { message: "액세스 코드 생성에 실패했습니다. 다시 시도해주세요." },
    { status: 500 },
  );
}
