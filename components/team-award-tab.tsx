"use client";

import { useEffect, useMemo, useState } from "react";
import type { AwardCategory, AwardPeriod } from "@/app/generated/prisma/enums";
import { getPeriodDateRange } from "@/lib/award-calculation";
import {
  periodTypeLabel,
  type PeriodOption,
  type PeriodType,
} from "@/lib/player-period";

type TeamAwardTabProps = {
  teamId: string;
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

function toAwardPeriod(period: PeriodType): AwardPeriod {
  return period === "YEARLY" ? "ANNUAL" : period;
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

const MEDAL_COLORS: Record<number, { disc: string; discDark: string }> = {
  1: { disc: "#fbbf24", discDark: "#b45309" },
  2: { disc: "#d4d4d8", discDark: "#71717a" },
  3: { disc: "#d0824a", discDark: "#92400e" },
};

function MedalIcon({ rank, size = "sm" }: { rank: number; size?: "sm" | "lg" }) {
  const colors = MEDAL_COLORS[rank];
  if (!colors) return null;

  return (
    <svg
      viewBox="0 0 24 28"
      className={`shrink-0 ${size === "lg" ? "h-9 w-9" : "h-6 w-6"}`}
      aria-hidden="true"
    >
      <path d="M8 1 L4 12 L9 12.5 Z" fill="#ef4444" />
      <path d="M16 1 L20 12 L15 12.5 Z" fill="#3b82f6" />
      <circle cx="12" cy="17" r="8" fill={colors.disc} stroke={colors.discDark} strokeWidth="1" />
      <text x="12" y="20.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="white">
        {rank}
      </text>
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 4h10v4a5 5 0 0 1-10 0V4zM7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3M9 15v2M15 15v2M8 21h8M9.5 17h5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1z"
      />
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

const CONFETTI_PIECES = [
  { left: "6%", top: "18%", size: 8, color: "#fbbf24", rotate: 15, shape: "square" as const },
  { left: "14%", top: "62%", size: 6, color: "#f472b6", rotate: -20, shape: "circle" as const },
  { left: "22%", top: "30%", size: 5, color: "#38bdf8", rotate: 40, shape: "square" as const },
  { left: "9%", top: "82%", size: 7, color: "#ffffff", rotate: -10, shape: "circle" as const },
  { left: "30%", top: "12%", size: 6, color: "#a78bfa", rotate: 25, shape: "square" as const },
  { left: "88%", top: "20%", size: 8, color: "#fbbf24", rotate: -25, shape: "circle" as const },
  { left: "80%", top: "70%", size: 6, color: "#38bdf8", rotate: 10, shape: "square" as const },
  { left: "92%", top: "55%", size: 5, color: "#ffffff", rotate: 30, shape: "circle" as const },
  { left: "70%", top: "14%", size: 7, color: "#f472b6", rotate: -15, shape: "square" as const },
  { left: "95%", top: "85%", size: 6, color: "#a78bfa", rotate: 20, shape: "circle" as const },
  { left: "45%", top: "8%", size: 5, color: "#ffffff", rotate: -30, shape: "square" as const },
  { left: "55%", top: "90%", size: 7, color: "#fbbf24", rotate: 12, shape: "circle" as const },
];

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

  const categories =
    period === "MONTHLY"
      ? ALWAYS_CATEGORIES
      : [...ALWAYS_CATEGORIES, ...QUARTERLY_PLUS_CATEGORIES];
  const gridCategories = categories.filter((category) => category !== "BEST_PLAYER");

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

export function TeamAwardTab({ teamId, teamColor }: TeamAwardTabProps) {
  const accentColor = teamColor ?? "#3f3f46";
  const [period, setPeriod] = useState<PeriodType>("MONTHLY");
  const [subPeriod, setSubPeriod] = useState("");
  const [periods, setPeriods] = useState<PeriodsResponse["periods"] | null>(null);
  const [awardsData, setAwardsData] = useState<AwardsResponse | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingAwards, setLoadingAwards] = useState(false);

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

  const subPeriodOptions = useMemo(
    () => filterCompletedSubPeriodOptions(period, periods?.[period] ?? []),
    [period, periods],
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6">
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
    </section>
  );
}
