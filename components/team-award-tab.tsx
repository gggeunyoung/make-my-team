"use client";

import { useEffect, useMemo, useState } from "react";
import type { AwardCategory } from "@/app/generated/prisma/enums";
import {
  formatHalfLabel,
  formatMonthLabel,
  formatQuarterLabel,
  formatYearLabel,
  getHalfFromDate,
  getQuarterFromDate,
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
    name: "공격수 랭킹",
    description:
      "강한 팀에 넣은 한골과 약한 팀에 넣은 한골은 그 값어치가 다르다. 상대팀 수준별, 골, 도움에 대한 가중치를 달리하여 평가한 공격 점수",
  },
  DEFENSE_RANKING: {
    name: "수비수 랭킹",
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

function getCurrentSubPeriodOption(period: PeriodType, now = new Date()): PeriodOption {
  const year = now.getFullYear();

  if (period === "MONTHLY") {
    const month = now.getMonth() + 1;
    return {
      value: `${year}-${String(month).padStart(2, "0")}`,
      label: formatMonthLabel(year, month),
    };
  }

  if (period === "QUARTERLY") {
    const quarter = getQuarterFromDate(now);
    return {
      value: `${year}-Q${quarter}`,
      label: formatQuarterLabel(year, quarter),
    };
  }

  if (period === "SEMIANNUAL") {
    const half = getHalfFromDate(now);
    return {
      value: `${year}-H${half}`,
      label: formatHalfLabel(year, half),
    };
  }

  return {
    value: String(year),
    label: formatYearLabel(year),
  };
}

function mergeSubPeriodOptions(period: PeriodType, options: PeriodOption[]): PeriodOption[] {
  const current = getCurrentSubPeriodOption(period);
  if (options.some((option) => option.value === current.value)) {
    return options;
  }
  return [current, ...options];
}

function DefaultPlayerPhoto({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initial = name.trim().charAt(0) || "?";
  const cls =
    size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-10 w-10 text-sm" : "h-14 w-14 text-lg";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-700 font-semibold text-zinc-200 ${cls}`}
    >
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
  const cls =
    size === "lg" ? "h-20 w-20" : size === "sm" ? "h-10 w-10" : "h-14 w-14";

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={name} className={`shrink-0 rounded-full object-cover ${cls}`} />
    );
  }

  return <DefaultPlayerPhoto name={name} size={size} />;
}

function formatStatValue(category: AwardCategory, value: number) {
  if (category === "ATTENDANCE") return `${value}%`;
  if (
    category === "ATTACK_RANKING" ||
    category === "DEFENSE_RANKING" ||
    category === "BEST_PLAYER" ||
    category === "STRONG_VS_TOP" ||
    category === "STRONG_VS_LOW"
  ) {
    return value.toFixed(2);
  }
  return String(value);
}

function medalStyles(rank: 1 | 2 | 3) {
  if (rank === 1) {
    return {
      ring: "ring-2 ring-amber-300/80",
      badge: "bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-amber-950",
      label: "🥇 1위",
    };
  }
  if (rank === 2) {
    return {
      ring: "ring-1 ring-zinc-300/70",
      badge: "bg-gradient-to-br from-zinc-200 via-zinc-300 to-zinc-400 text-zinc-800",
      label: "🥈 2위",
    };
  }
  return {
    ring: "ring-1 ring-orange-400/60",
    badge: "bg-gradient-to-br from-orange-300 via-amber-600 to-orange-700 text-orange-950",
    label: "🥉 3위",
  };
}

function RankSlot({
  rank,
  entries,
  category,
  isFirstPlace,
}: {
  rank: 1 | 2 | 3;
  entries: AwardRankEntry[];
  category: AwardCategory;
  isFirstPlace: boolean;
}) {
  const styles = medalStyles(rank);
  const hideStatValue = category === "ATTACK_RANKING" || category === "DEFENSE_RANKING";

  if (entries.length === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed border-white/10 bg-white/5 px-3 py-4 text-center ${isFirstPlace ? "min-h-[180px]" : "min-h-[140px]"}`}
      >
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles.badge}`}>
          {styles.label}
        </span>
        <p className="mt-3 text-sm text-zinc-500">수상자 없음</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/5 px-3 py-4 ${styles.ring} ${
        isFirstPlace ? "min-h-[180px] shadow-[0_0_30px_rgba(251,191,36,0.15)]" : "min-h-[140px]"
      } ${hideStatValue ? "flex flex-col justify-center" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles.badge}`}>
          {styles.label}
        </span>
        {isFirstPlace ? (
          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-200">
            MVP
          </span>
        ) : null}
      </div>

      <div className={`mt-3 space-y-3 ${hideStatValue ? "flex flex-col justify-center" : ""}`}>
        {entries.map((entry) =>
          hideStatValue ? (
            <div
              key={`${entry.rank}-${entry.playerId}`}
              className="flex items-center justify-center gap-3"
            >
              <PlayerAvatar
                name={entry.playerName}
                photo={entry.playerPhoto}
                size={isFirstPlace ? "lg" : rank === 2 ? "md" : "sm"}
              />
              <p className={`font-semibold text-white ${isFirstPlace ? "text-base" : "text-sm"}`}>
                {entry.playerName}
              </p>
            </div>
          ) : (
            <div key={`${entry.rank}-${entry.playerId}`} className="flex flex-col items-center text-center">
              <PlayerAvatar
                name={entry.playerName}
                photo={entry.playerPhoto}
                size={isFirstPlace ? "lg" : rank === 2 ? "md" : "sm"}
              />
              <p className={`mt-2 font-semibold text-white ${isFirstPlace ? "text-base" : "text-sm"}`}>
                {entry.playerName}
              </p>
              <p className={`mt-0.5 font-medium text-amber-200/90 ${isFirstPlace ? "text-sm" : "text-xs"}`}>
                {formatStatValue(category, entry.statValue)}
              </p>
            </div>
          ),
        )}
      </div>
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
  const ranksByNumber = useMemo(() => {
    const map = new Map<number, AwardRankEntry[]>();
    for (const entry of ranks) {
      const list = map.get(entry.rank) ?? [];
      list.push(entry);
      map.set(entry.rank, list);
    }
    return map;
  }, [ranks]);

  return (
    <article
      className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-xl"
      style={{ boxShadow: `0 20px 40px -20px ${accentColor}55` }}
    >
      <header
        className="border-b border-white/10 px-4 py-4"
        style={{ background: `linear-gradient(135deg, ${accentColor}33 0%, transparent 100%)` }}
      >
        <h3 className="text-lg font-bold text-white">{info.name}</h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{info.description}</p>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <RankSlot
          rank={1}
          entries={ranksByNumber.get(1) ?? []}
          category={category}
          isFirstPlace
        />
        <div className="grid grid-cols-2 gap-3">
          <RankSlot
            rank={2}
            entries={ranksByNumber.get(2) ?? []}
            category={category}
            isFirstPlace={false}
          />
          <RankSlot
            rank={3}
            entries={ranksByNumber.get(3) ?? []}
            category={category}
            isFirstPlace={false}
          />
        </div>
      </div>
    </article>
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
    return <p className="text-sm text-zinc-400">시상식 데이터를 불러오는 중...</p>;
  }

  if (!data) {
    return <p className="text-sm text-zinc-400">시상식 데이터를 불러오지 못했습니다.</p>;
  }

  if (data.insufficient) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-8 py-12 text-center">
        <p className="text-2xl">🏟️</p>
        <p className="mt-4 text-lg font-semibold text-amber-100">경기 부족으로 시상식이 열리지 않습니다</p>
        <p className="mt-2 text-sm text-amber-200/70">해당 기간 팀 매치가 3경기 이상 필요합니다.</p>
      </div>
    );
  }

  const categories =
    period === "MONTHLY"
      ? ALWAYS_CATEGORIES
      : [...ALWAYS_CATEGORIES, ...QUARTERLY_PLUS_CATEGORIES];

  const awardsByCategory = new Map(data.awards.map((award) => [award.category, award.ranks]));

  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4">
      {categories.map((category) => (
        <AwardCategoryCard
          key={category}
          category={category}
          ranks={awardsByCategory.get(category) ?? []}
          accentColor={accentColor}
        />
      ))}
    </div>
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
    const options = mergeSubPeriodOptions(period, periods[period] ?? []);
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
    () => mergeSubPeriodOptions(period, periods?.[period] ?? []),
    [period, periods],
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium tracking-[0.3em] text-amber-400/80">TEAM AWARDS</p>
        <h2 className="mt-2 text-3xl font-bold text-zinc-900">🏆 시상식</h2>
        <p className="mt-2 text-sm text-zinc-500">기간별 팀 시상 부문 수상자를 확인하세요</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5">
          {PERIOD_TAB_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                period === p ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
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
          className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
        >
          {subPeriodOptions.length === 0 ? (
            <option value="">기간 없음</option>
          ) : (
            subPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <AwardTabContent
          data={awardsData}
          loading={loadingAwards || loadingPeriods}
          period={period}
          accentColor={accentColor}
        />
      </div>
    </section>
  );
}
