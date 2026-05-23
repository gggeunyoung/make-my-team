import type { AwardCategory, AwardPeriod } from "@/app/generated/prisma/enums";
import {
  calculateAwardsForPeriod,
  getPeriodDateRange,
  getSubPeriodLabel,
} from "@/lib/award-calculation";
import { PERIOD_TYPES, type PeriodType } from "@/lib/player-period";
import { prisma } from "@/lib/prisma";

const CATEGORY_ORDER: AwardCategory[] = [
  "BEST_PLAYER",
  "ATTACK_RANKING",
  "DEFENSE_RANKING",
  "ATTACK_COMBO",
  "TOP_SCORER",
  "TOP_ASSIST",
  "ATTACK_POINT",
  "STRONG_VS_TOP",
  "STRONG_VS_LOW",
  "ATTENDANCE",
];

const MONTHLY_HIDDEN_CATEGORIES = new Set<AwardCategory>([
  "STRONG_VS_TOP",
  "STRONG_VS_LOW",
  "ATTENDANCE",
]);

type AwardRankEntry = {
  rank: number;
  playerId: string;
  playerName: string;
  playerPhoto: string | null;
  statValue: number;
};

type AwardCategoryResult = {
  category: AwardCategory;
  ranks: AwardRankEntry[];
};

type AwardItem = AwardRankEntry & {
  category: AwardCategory;
};

function normalizeAwardPeriod(period: PeriodType): AwardPeriod {
  return period === "YEARLY" ? "ANNUAL" : period;
}

function buildCategoryResults(items: AwardItem[], period: AwardPeriod): AwardCategoryResult[] {
  const applicable = CATEGORY_ORDER.filter(
    (category) => period !== "MONTHLY" || !MONTHLY_HIDDEN_CATEGORIES.has(category),
  );

  const grouped = new Map<AwardCategory, AwardRankEntry[]>(
    applicable.map((category) => [category, []]),
  );

  for (const item of items) {
    const ranks = grouped.get(item.category);
    if (!ranks) continue;
    ranks.push({
      rank: item.rank,
      playerId: item.playerId,
      playerName: item.playerName,
      playerPhoto: item.playerPhoto,
      statValue: item.statValue,
    });
  }

  for (const ranks of grouped.values()) {
    ranks.sort(
      (a, b) => a.rank - b.rank || a.playerName.localeCompare(b.playerName, "ko"),
    );
  }

  return applicable.map((category) => ({
    category,
    ranks: grouped.get(category) ?? [],
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")?.trim() ?? "";
  const period = searchParams.get("period")?.trim() ?? "";
  const subPeriod = searchParams.get("subPeriod")?.trim() ?? "";

  if (!teamId) {
    return Response.json({ message: "팀 정보가 필요합니다." }, { status: 400 });
  }
  if (!PERIOD_TYPES.includes(period as PeriodType)) {
    return Response.json({ message: "유효하지 않은 기간 유형입니다." }, { status: 400 });
  }
  if (!subPeriod) {
    return Response.json({ message: "세부 기간이 필요합니다." }, { status: 400 });
  }

  const awardPeriod = normalizeAwardPeriod(period as PeriodType);
  const range = getPeriodDateRange(awardPeriod, subPeriod);
  if (!range) {
    return Response.json({ message: "유효하지 않은 세부 기간입니다." }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }

  const matchCount = await prisma.match.count({
    where: {
      teamId,
      date: { gte: range.start, lte: range.end },
    },
  });

  if (matchCount < 3) {
    return Response.json({ insufficient: true, awards: [] });
  }

  const isCurrentPeriod = subPeriod === getSubPeriodLabel(awardPeriod, new Date());
  let items: AwardItem[] = [];

  if (isCurrentPeriod) {
    const drafts = await prisma.$transaction((tx) =>
      calculateAwardsForPeriod(tx, teamId, awardPeriod, subPeriod),
    );

    const playerIds = [...new Set(drafts.map((draft) => draft.playerId))];
    const players =
      playerIds.length === 0
        ? []
        : await prisma.player.findMany({
            where: { id: { in: playerIds } },
            select: { id: true, name: true, photo: true },
          });
    const playerById = new Map(players.map((player) => [player.id, player]));

    items = drafts.map((draft) => ({
      category: draft.category,
      rank: draft.rank,
      statValue: draft.statValue,
      playerId: draft.playerId,
      playerName: playerById.get(draft.playerId)?.name ?? "",
      playerPhoto: playerById.get(draft.playerId)?.photo ?? null,
    }));
  } else {
    const dbAwards = await prisma.award.findMany({
      where: { teamId, period: awardPeriod, subPeriod },
      include: {
        player: { select: { name: true, photo: true } },
      },
      orderBy: [{ category: "asc" }, { rank: "asc" }],
    });

    items = dbAwards.map((award) => ({
      category: award.category,
      rank: award.rank,
      statValue: award.statValue,
      playerId: award.playerId,
      playerName: award.player.name,
      playerPhoto: award.player.photo,
    }));
  }

  return Response.json({
    insufficient: false,
    awards: buildCategoryResults(items, awardPeriod),
  });
}
