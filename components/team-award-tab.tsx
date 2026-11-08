"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AwardCategory, AwardPeriod } from "@/app/generated/prisma/enums";
import { renderAwardShareCard, type AwardShareCardData } from "@/components/award-share-card";
import {
  CONFETTI_PIECES,
  MEDAL_COLORS,
  MEDAL_RIBBONS,
  TROPHY_CUP_PATH,
  TROPHY_HANDLE_PATHS,
} from "@/components/award-theme";
import { KAKAO_SDK_SRC, KAKAO_TEXT_MAX_LENGTH, initKakaoSdk } from "@/components/kakao-sdk";
import { KakaoShareDialog, type KakaoShareDraft } from "@/components/kakao-share-dialog";
import { getPeriodDateRange } from "@/lib/award-calculation";
import { awardShareButtonLabel, formatAwardPeriodKorean } from "@/lib/award-period-label";
import {
  PERIOD_TYPES,
  periodTypeLabel,
  type PeriodOption,
  type PeriodType,
} from "@/lib/player-period";

type TeamAwardTabProps = {
  teamId: string;
  teamName: string;
  teamColor: string | null;
};

type PeriodsResponse = {
  periods: Record<PeriodType, PeriodOption[]>;
};

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

type AwardsResponse = {
  insufficient: boolean;
  awards: AwardCategoryResult[];
};

const AWARD_INFO: Record<
  AwardCategory,
  {
    name: string;
    description: string;
  }
> = {
  BEST_PLAYER: {
    name: "최우수 선수",
    description: "공격, 수비에서 종합적으로 가장 좋은 모습을 보여준 선수",
  },
  ATTACK_RANKING: {
    name: "공격 랭킹",
    description: "상대팀 수준별, 골, 도움에 대한 가중치를 달리하여 평가한 종합 공격 점수",
  },
  DEFENSE_RANKING: {
    name: "수비 랭킹",
    description: "상대팀 수준별, 경기결과, 실점에 대한 가중치를 달리하여 평가한 종합 수비 점수",
  },
  ATTACK_COMBO: {
    name: "공격 듀오",
    description: "골 - 도움 합작 수가 가장 높은 듀오",
  },
  STRONG_VS_TOP: {
    name: "큰경기에 강함",
    description: "강한 팀 상대로 좋은 플레이를 보여준 선수",
  },
  STRONG_VS_LOW: {
    name: "양학러",
    description: "약한 팀 상대로 확실한 플레이를 보여준 선수",
  },
  TOP_SCORER: {
    name: "득점왕",
    description: "골을 가장 많이 기록한 선수",
  },
  TOP_ASSIST: {
    name: "도움왕",
    description: "도움을 가장 많이 기록한 선수",
  },
  ATTACK_POINT: {
    name: "플레이메이커",
    description: "공격포인트(골+도움)을 가장 많이 기록한 선수",
  },
  ATTENDANCE: {
    name: "출석왕",
    description: "꾸준히 나와 성실함을 보여주는 선수. 팀에서 가장 중요한 선수",
  },
};

const PERIOD_TAB_ORDER: PeriodType[] = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "YEARLY"];

const ALWAYS_CATEGORIES: AwardCategory[] = [
  "BEST_PLAYER",
  "ATTACK_RANKING",
  "DEFENSE_RANKING",
  "ATTACK_COMBO",
  "TOP_SCORER",
  "TOP_ASSIST",
  "ATTACK_POINT",
];

const QUARTERLY_PLUS_CATEGORIES: AwardCategory[] = [
  "STRONG_VS_TOP",
  "STRONG_VS_LOW",
  "ATTENDANCE",
];

function categoriesForPeriod(period: PeriodType): AwardCategory[] {
  return period === "MONTHLY" ? ALWAYS_CATEGORIES : [...ALWAYS_CATEGORIES, ...QUARTERLY_PLUS_CATEGORIES];
}

function toAwardPeriod(period: PeriodType): AwardPeriod {
  return period === "YEARLY" ? "ANNUAL" : period;
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
      {message}
    </div>
  );
}

function parsePeriodParam(value: string | null): PeriodType | null {
  if (!value) return null;
  return PERIOD_TYPES.includes(value as PeriodType) ? (value as PeriodType) : null;
}

function getAwardShareUrl(teamId: string, period: PeriodType, subPeriod: string) {
  const params = new URLSearchParams({
    tab: "award",
    period,
    subPeriod,
  });
  return `${window.location.origin}/team/${teamId}?${params.toString()}`;
}

function filterCompletedSubPeriodOptions(period: PeriodType, options: PeriodOption[]): PeriodOption[] {
  const now = new Date();
  const awardPeriod = toAwardPeriod(period);

  return options.filter((option) => {
    const range = getPeriodDateRange(awardPeriod, option.value);
    if (!range) return false;
    return range.end <= now;
  });
}

function DefaultPlayerPhoto({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initial = name.trim().charAt(0) || "?";
  const cls = size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-8 w-8 text-sm" : "h-12 w-12 text-base";

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-500 ${cls}`}>
      {initial}
    </div>
  );
}

function PlayerAvatar({
  name,
  photo,
  size = "md",
}: {
  name: string;
  photo: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const cls = size === "lg" ? "h-20 w-20" : size === "sm" ? "h-8 w-8" : "h-12 w-12";

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={name} className={`shrink-0 rounded-full border-2 border-white object-cover shadow-sm ${cls}`} />
    );
  }

  return <DefaultPlayerPhoto name={name} size={size} />;
}

function MedalIcon({ rank, size = "sm" }: { rank: number; size?: "sm" | "lg" }) {
  const colors = MEDAL_COLORS[rank];
  if (!colors) return null;

  return (
    <svg
      viewBox="0 0 24 28"
      className={`shrink-0 ${size === "lg" ? "h-9 w-9" : "h-6 w-6"}`}
      aria-hidden="true"
    >
      {MEDAL_RIBBONS.map((ribbon) => (
        <path key={ribbon.d} d={ribbon.d} fill={ribbon.fill} />
      ))}
      <circle cx="12" cy="17" r="8" fill={colors.disc} stroke={colors.discDark} strokeWidth="1" />
      <text x="12" y="20.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="white">
        {rank}
      </text>
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={TROPHY_CUP_PATH} />
      {TROPHY_HANDLE_PATHS.map((d) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      ))}
    </svg>
  );
}

function shouldShowStatValue(category: AwardCategory) {
  return !(
    category === "ATTACK_RANKING" ||
    category === "DEFENSE_RANKING" ||
    category === "BEST_PLAYER" ||
    category === "STRONG_VS_TOP" ||
    category === "STRONG_VS_LOW"
  );
}

function formatStatValue(category: AwardCategory, value: number) {
  if (category === "TOP_SCORER" || category === "ATTACK_COMBO") return `${value}골`;
  if (category === "TOP_ASSIST") return `${value}도움`;
  if (category === "ATTACK_POINT") return `${value}P`;
  if (category === "ATTENDANCE") return `${value}%`;
  return String(value);
}

function groupEntriesByRank(entries: AwardRankEntry[]) {
  const map = new Map<number, AwardRankEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.rank) ?? [];
    list.push(entry);
    map.set(entry.rank, list);
  }
  return map;
}

function rankEntryLabel(entries: AwardRankEntry[]) {
  return entries.map((e) => e.playerName).join(" & ");
}

function ranksByCategoryOf(awards: AwardCategoryResult[]) {
  return new Map(awards.map((award) => [award.category, award.ranks]));
}

/** 부문 1위(공동 수상은 " & "로 묶음)와 화면에 보여주는 기록 */
function categoryWinner(category: AwardCategory, ranks: AwardRankEntry[]) {
  const winners = ranks.filter((entry) => entry.rank === 1);
  if (winners.length === 0) return null;
  return {
    names: rankEntryLabel(winners),
    value: shouldShowStatValue(category) ? formatStatValue(category, winners[0]!.statValue) : null,
  };
}

function shareLabel(category: AwardCategory) {
  return category === "BEST_PLAYER" ? "MVP" : AWARD_INFO[category].name;
}

/** 카카오톡 메시지 설명(최대 2줄 표시): 대표 부문 수상자만 */
function buildAwardShareSummary(awards: AwardCategoryResult[]) {
  const ranksByCategory = ranksByCategoryOf(awards);
  return (["BEST_PLAYER", "TOP_SCORER", "TOP_ASSIST"] as const)
    .flatMap((category) => {
      const winner = categoryWinner(category, ranksByCategory.get(category) ?? []);
      return winner ? [`${shareLabel(category)} ${winner.names}`] : [];
    })
    .join(" · ");
}

/** 공유 이미지에 그릴 내용: 그 기간 MVP 1~3위와 부문별 1위 */
function buildAwardShareCard(
  teamName: string,
  periodLabel: string,
  accentColor: string,
  period: PeriodType,
  awards: AwardCategoryResult[],
): AwardShareCardData {
  const ranksByCategory = ranksByCategoryOf(awards);
  const mvpByRank = groupEntriesByRank(ranksByCategory.get("BEST_PLAYER") ?? []);
  return {
    teamName,
    periodLabel,
    accentColor,
    podium: ([1, 2, 3] as const).map((rank) => ({
      rank,
      players: (mvpByRank.get(rank) ?? []).map((entry) => ({ name: entry.playerName, photo: entry.playerPhoto })),
    })),
    winners: categoriesForPeriod(period)
      .filter((category) => category !== "BEST_PLAYER")
      .map((category) => {
        const winner = categoryWinner(category, ranksByCategory.get(category) ?? []);
        return { label: AWARD_INFO[category].name, names: winner?.names ?? null, value: winner?.value ?? null };
      }),
  };
}

/** 이미지를 못 올렸을 때 보내는 텍스트 메시지. 200자 제한을 넘는 부문은 잘라낸다(전체 결과는 자세히 보기 링크). */
function buildAwardShareMessage(periodLabel: string, period: PeriodType, awards: AwardCategoryResult[]) {
  const ranksByCategory = ranksByCategoryOf(awards);
  const lines = categoriesForPeriod(period).flatMap((category) => {
    const winner = categoryWinner(category, ranksByCategory.get(category) ?? []);
    return winner ? [`${shareLabel(category)} : ${winner.names}${winner.value ? ` ${winner.value}` : ""}`] : [];
  });

  let message = `${periodLabel} 시상식 결과 나왔습니다!!`;
  if (lines.length === 0) return message;

  message += "\n----------------";
  for (const line of lines) {
    const next = `${message}\n${line}`;
    if (next.length > KAKAO_TEXT_MAX_LENGTH) break;
    message = next;
  }
  return message;
}

function ConfettiDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {CONFETTI_PIECES.map((piece, i) => (
        <span
          key={i}
          className={`absolute opacity-40 ${piece.shape === "circle" ? "rounded-full" : "rounded-[2px]"}`}
          style={{
            left: piece.left,
            top: piece.top,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function RankAvatars({ entries, size }: { entries: AwardRankEntry[]; size: "sm" | "md" | "lg" }) {
  if (entries.length === 0) return null;
  return (
    <div className="flex items-center justify-center -space-x-3">
      {entries.map((e) => (
        <PlayerAvatar key={e.playerId} name={e.playerName} photo={e.playerPhoto} size={size} />
      ))}
    </div>
  );
}

function AwardCategoryCard({
  category,
  ranks,
  accentColor,
}: {
  category: AwardCategory;
  ranks: AwardRankEntry[];
  accentColor: string;
}) {
  const info = AWARD_INFO[category];
  const showValue = shouldShowStatValue(category);
  const ranksByNumber = useMemo(() => groupEntriesByRank(ranks), [ranks]);
  const rank1 = ranksByNumber.get(1) ?? [];
  const rank2 = ranksByNumber.get(2) ?? [];
  const rank3 = ranksByNumber.get(3) ?? [];
  const hasAny = rank1.length + rank2.length + rank3.length > 0;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-2 border-l-2 pl-3" style={{ borderColor: accentColor }}>
        <div>
          <h3 className="text-base font-bold text-zinc-900">{info.name}</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{info.description}</p>
        </div>
      </div>

      {!hasAny ? (
        <p className="mt-4 flex-1 rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
          수상자 없음
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-col items-center rounded-xl bg-zinc-50 p-4 text-center">
            <div className="relative">
              <RankAvatars entries={rank1} size={rank1.length > 1 ? "md" : "lg"} />
              <span className="absolute -bottom-1.5 -right-1.5">
                <MedalIcon rank={1} size="lg" />
              </span>
            </div>
            <p className="mt-3 truncate text-sm font-bold text-zinc-900">{rankEntryLabel(rank1)}</p>
            {showValue ? (
              <p className="mt-0.5 text-xs font-semibold text-amber-600">
                {formatStatValue(category, rank1[0]!.statValue)}
              </p>
            ) : null}
          </div>

          {rank2.length > 0 || rank3.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {rank2.length > 0 ? (
                <li className="flex items-center gap-2">
                  <MedalIcon rank={2} />
                  <RankAvatars entries={rank2} size="sm" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                    {rankEntryLabel(rank2)}
                  </p>
                  {showValue ? (
                    <span className="shrink-0 text-xs font-semibold text-zinc-600">
                      {formatStatValue(category, rank2[0]!.statValue)}
                    </span>
                  ) : null}
                </li>
              ) : null}
              {rank3.length > 0 ? (
                <li className="flex items-center gap-2">
                  <MedalIcon rank={3} />
                  <RankAvatars entries={rank3} size="sm" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                    {rankEntryLabel(rank3)}
                  </p>
                  {showValue ? (
                    <span className="shrink-0 text-xs font-semibold text-zinc-600">
                      {formatStatValue(category, rank3[0]!.statValue)}
                    </span>
                  ) : null}
                </li>
              ) : null}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

function BestPlayerHero({ ranks, accentColor }: { ranks: AwardRankEntry[]; accentColor: string }) {
  const info = AWARD_INFO.BEST_PLAYER;
  const ranksByNumber = useMemo(() => groupEntriesByRank(ranks), [ranks]);
  const rank1 = ranksByNumber.get(1) ?? [];
  const rank2 = ranksByNumber.get(2) ?? [];
  const rank3 = ranksByNumber.get(3) ?? [];
  const hasAny = rank1.length + rank2.length + rank3.length > 0;

  return (
    <div
      className="relative mb-4 overflow-hidden rounded-3xl p-6 text-white shadow-sm sm:p-8"
      style={{ background: `linear-gradient(135deg, ${accentColor} 0%, #18181b 100%)` }}
    >
      <ConfettiDecoration />

      <div className="relative z-10 text-center">
        <p className="text-xs font-bold tracking-[0.2em] text-white/60">MVP</p>
        <h3 className="mt-1 flex items-center justify-center gap-2 text-xl font-bold">
          <TrophyIcon className="h-6 w-6 shrink-0 text-amber-300" />
          {info.name}
          <TrophyIcon className="h-6 w-6 shrink-0 text-amber-300" />
        </h3>
        <p className="mt-1 text-sm text-white/70">{info.description}</p>
      </div>

      {!hasAny ? (
        <p className="relative z-10 mt-6 rounded-lg border border-dashed border-white/20 py-10 text-center text-sm text-white/50">
          수상자 없음
        </p>
      ) : (
        <div className="relative z-10 mt-6 flex flex-wrap items-end justify-center gap-6 sm:gap-10">
          {rank2.length > 0 ? (
            <div className="flex flex-col items-center">
              <div className="relative">
                <RankAvatars entries={rank2} size="md" />
                <span className="absolute -bottom-1 -right-1">
                  <MedalIcon rank={2} />
                </span>
              </div>
              <p className="mt-2 max-w-[8rem] truncate text-sm font-semibold text-white/90">
                {rankEntryLabel(rank2)}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col items-center">
            <div className="relative">
              <span className="absolute inset-0 -z-10 rounded-full bg-white/20 blur-xl" aria-hidden="true" />
              <RankAvatars entries={rank1} size="lg" />
              <span className="absolute -bottom-2 -right-2">
                <MedalIcon rank={1} size="lg" />
              </span>
            </div>
            <p className="mt-3 max-w-[10rem] truncate text-base font-bold">{rankEntryLabel(rank1)}</p>
          </div>

          {rank3.length > 0 ? (
            <div className="flex flex-col items-center">
              <div className="relative">
                <RankAvatars entries={rank3} size="md" />
                <span className="absolute -bottom-1 -right-1">
                  <MedalIcon rank={3} />
                </span>
              </div>
              <p className="mt-2 max-w-[8rem] truncate text-sm font-semibold text-white/90">
                {rankEntryLabel(rank3)}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AwardTabContent({
  data,
  loading,
  period,
  accentColor,
}: {
  data: AwardsResponse | null;
  loading: boolean;
  period: PeriodType;
  accentColor: string;
}) {
  if (loading) {
    return <p className="text-sm text-zinc-500">시상식 데이터를 불러오는 중...</p>;
  }

  if (!data) {
    return <p className="text-sm text-zinc-500">시상식 데이터를 불러오지 못했습니다.</p>;
  }

  if (data.insufficient) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-zinc-100 py-10 text-center">
        <TrophyIcon className="h-8 w-8 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-500">경기 부족으로 이번 기간엔 시상식이 열리지 않아요</p>
        <p className="text-xs text-zinc-400">해당 기간 팀 매치가 3경기 이상 모이면 시상식이 열려요</p>
      </div>
    );
  }

  const gridCategories = categoriesForPeriod(period).filter((category) => category !== "BEST_PLAYER");

  const awardsByCategory = new Map(data.awards.map((award) => [award.category, award.ranks]));

  return (
    <>
      <BestPlayerHero ranks={awardsByCategory.get("BEST_PLAYER") ?? []} accentColor={accentColor} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gridCategories.map((category) => (
          <AwardCategoryCard
            key={category}
            category={category}
            ranks={awardsByCategory.get(category) ?? []}
            accentColor={accentColor}
          />
        ))}
      </div>
    </>
  );
}

export function TeamAwardTab({ teamId, teamName, teamColor }: TeamAwardTabProps) {
  const accentColor = teamColor ?? "#3f3f46";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [period, setPeriod] = useState<PeriodType>(() => {
    return parsePeriodParam(searchParams.get("period")) ?? "MONTHLY";
  });
  const [subPeriod, setSubPeriod] = useState(() => searchParams.get("subPeriod")?.trim() ?? "");
  const [periods, setPeriods] = useState<PeriodsResponse["periods"] | null>(null);
  const [awardsData, setAwardsData] = useState<AwardsResponse | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingAwards, setLoadingAwards] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shareDraft, setShareDraft] = useState<KakaoShareDraft | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPeriods() {
      setLoadingPeriods(true);
      try {
        const res = await fetch(`/api/players/periods?teamId=${encodeURIComponent(teamId)}`);
        const json = (await res.json()) as PeriodsResponse | { message?: string };
        if (cancelled) return;
        if (!res.ok || !("periods" in json)) {
          setPeriods(null);
          return;
        }
        setPeriods(json.periods);
      } finally {
        if (!cancelled) setLoadingPeriods(false);
      }
    }

    void loadPeriods();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    if (!periods) return;
    const options = filterCompletedSubPeriodOptions(period, periods[period] ?? []);
    if (options.length === 0) {
      setSubPeriod("");
      return;
    }
    if (!options.some((option) => option.value === subPeriod)) {
      setSubPeriod(options[0]!.value);
    }
  }, [period, periods, subPeriod]);

  useEffect(() => {
    if (!subPeriod) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "award");
    params.set("period", period);
    params.set("subPeriod", subPeriod);

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;

    router.replace(`${pathname}?${nextQuery}`, { scroll: false });
  }, [period, subPeriod, pathname, router, searchParams]);

  useEffect(() => {
    if (!subPeriod) {
      setAwardsData(null);
      return;
    }

    let cancelled = false;

    async function loadAwards() {
      setLoadingAwards(true);
      try {
        const params = new URLSearchParams({
          teamId,
          period,
          subPeriod,
        });
        const res = await fetch(`/api/awards?${params.toString()}`);
        const json = (await res.json()) as AwardsResponse | { message?: string };
        if (cancelled) return;
        if (!res.ok || !("insufficient" in json)) {
          setAwardsData(null);
          return;
        }
        setAwardsData(json);
      } finally {
        if (!cancelled) setLoadingAwards(false);
      }
    }

    void loadAwards();
    return () => {
      cancelled = true;
    };
  }, [teamId, period, subPeriod]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const subPeriodOptions = useMemo(
    () => filterCompletedSubPeriodOptions(period, periods?.[period] ?? []),
    [period, periods],
  );

  const canShareAwards =
    Boolean(subPeriod) &&
    !loadingAwards &&
    !loadingPeriods &&
    awardsData !== null &&
    !awardsData.insufficient;

  const openShareDialog = () => {
    if (!canShareAwards || !subPeriod || !awardsData) return;
    const periodLabel = formatAwardPeriodKorean(period, subPeriod);
    const card = buildAwardShareCard(teamName, periodLabel, accentColor, period, awardsData.awards);
    setShareDraft({
      heading: "시상식 공유",
      url: getAwardShareUrl(teamId, period, subPeriod),
      imageKey: JSON.stringify(card),
      renderImage: () => renderAwardShareCard(card),
      title: `${periodLabel} 시상식 결과 나왔습니다!!`,
      description: buildAwardShareSummary(awardsData.awards),
      fallbackText: buildAwardShareMessage(periodLabel, period, awardsData.awards),
      fileName: `${teamName} ${periodLabel} 시상식.jpg`.replace(/[\\/:*?"<>|]/g, ""),
    });
  };

  const closeShareDialog = useCallback(() => setShareDraft(null), []);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6">
      <Script src={KAKAO_SDK_SRC} strategy="afterInteractive" onReady={initKakaoSdk} />
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-900">🏆 시상식</h2>
        <p className="mt-1 text-sm text-zinc-500">기간별 팀 시상 부문 수상자를 확인하세요</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-zinc-200 bg-white p-0.5">
          {PERIOD_TAB_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${period === p ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
            >
              {periodTypeLabel(p)}
            </button>
          ))}
        </div>
        <select
          value={subPeriod}
          onChange={(e) => setSubPeriod(e.target.value)}
          disabled={loadingPeriods || subPeriodOptions.length === 0}
          className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm shadow-sm"
        >
          {subPeriodOptions.length === 0 ? (
            <option value="">경기 데이터가 없습니다</option>
          ) : (
            subPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          )}
        </select>
        {canShareAwards ? (
          <button
            type="button"
            onClick={openShareDialog}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="h-4 w-4 text-zinc-500">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"
              />
            </svg>
            {awardShareButtonLabel(period)}
          </button>
        ) : null}
      </div>

      {!loadingPeriods && subPeriodOptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-zinc-100 py-10 text-center">
          <TrophyIcon className="h-8 w-8 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-500">해당 기간엔 진행한 매치가 없어요</p>
          <p className="text-xs text-zinc-400">매치를 등록하면 여기에 시상식이 표시돼요</p>
        </div>
      ) : (
        <AwardTabContent
          data={awardsData}
          loading={loadingAwards || loadingPeriods}
          period={period}
          accentColor={accentColor}
        />
      )}

      {shareDraft ? (
        <KakaoShareDialog draft={shareDraft} onClose={closeShareDialog} onToast={setToastMessage} />
      ) : null}
      {toastMessage ? <Toast message={toastMessage} /> : null}
    </section>
  );
}
