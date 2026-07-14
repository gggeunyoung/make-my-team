"use client";

import { useEffect, useState } from "react";
import {
  formatMatchDate,
  matchResultLabel,
  opponentLevelBadgeClass,
  opponentLevelLabel,
  type OpponentLevelValue,
} from "@/lib/player-display";

type MatchResult = "WIN" | "DRAW" | "LOSS";

type RankingItem = {
  rank: number;
  id: string;
  name: string;
  photo: string | null;
  value: number;
};

type RankingCategory = {
  key: string;
  title: string;
  items: RankingItem[];
};

type RecentMatchItem = {
  id: string;
  opponentName: string;
  opponentLevel: OpponentLevelValue;
  date: string;
  totalScoreUs: number;
  totalScoreThem: number;
  totalResult: MatchResult;
  countWin: number;
  countDraw: number;
  countLoss: number;
  momName: string | null;
};

type HomeResponse = {
  quarterLabel: string;
  hasQuarterMatches: boolean;
  rankings: RankingCategory[];
  recentMatches: RecentMatchItem[];
};

type TeamHomeTabProps = {
  teamId: string;
  teamColor: string | null;
  onMatchClick: (matchId: string) => void;
};

function DefaultPlayerPhoto({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initial = name.trim().charAt(0) || "?";
  const cls = size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-base";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-500 ${cls}`}
    >
      {initial}
    </div>
  );
}

function formatRankingTitle(title: string) {
  return title.replace(/경기당/g, "매치당");
}

function formatRankingValue(key: string, value: number) {
  if (key === "attack" || key === "defense") return value.toFixed(2);
  if (key === "goals" || key === "goalsPerMatch") {
    const n = key === "goalsPerMatch" ? value.toFixed(2) : String(value);
    return `${n}골`;
  }
  if (key === "assists" || key === "assistsPerMatch") {
    const n = key === "assistsPerMatch" ? value.toFixed(2) : String(value);
    return `${n}도움`;
  }
  if (key === "attackPoints" || key === "attackPointsPerMatch") {
    const n = key === "attackPointsPerMatch" ? value.toFixed(2) : String(value);
    return `${n}P`;
  }
  if (key === "attendanceRate") return `${value}%`;
  return String(value);
}

function resultAccent(result: MatchResult) {
  if (result === "WIN") {
    return { bar: "bg-emerald-500", badgeBg: "bg-emerald-50", badgeText: "text-emerald-600" };
  }
  if (result === "DRAW") {
    return { bar: "bg-zinc-300", badgeBg: "bg-zinc-100", badgeText: "text-zinc-600" };
  }
  return { bar: "bg-rose-500", badgeBg: "bg-rose-50", badgeText: "text-rose-600" };
}

export function TeamHomeTab({ teamId, teamColor, onMatchClick }: TeamHomeTabProps) {
  const accent = teamColor ?? "#3f3f46";
  const [data, setData] = useState<HomeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/home?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" });
        const json = (await res.json()) as HomeResponse | { message?: string };
        if (cancelled) return;
        if (!res.ok || !("rankings" in json)) {
          setData(null);
          return;
        }
        setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">홈 정보를 불러오는 중...</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">
          홈 정보를 불러오지 못했습니다.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 space-y-10">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">이번 분기 선수 스탯 순위</h2>
        <p className="mb-4 text-sm text-zinc-500">{data.quarterLabel}</p>

        {!data.hasQuarterMatches ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-zinc-100 py-10 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
              className="h-8 w-8 text-zinc-300"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.5V21h3v-7.5H3zm7.5-6V21h3V7.5h-3zM18 3v18h3V3h-3z"
              />
            </svg>
            <p className="text-sm font-medium text-zinc-500">이번 분기엔 아직 기록된 매치가 없어요</p>
            <p className="text-xs text-zinc-400">매치를 등록하면 여기에 선수 순위가 표시돼요</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {data.rankings.map((cat) => (
              <div
                key={cat.key}
                className="w-56 shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <p className="mb-3 text-sm font-semibold text-zinc-900">{formatRankingTitle(cat.title)}</p>
                {cat.items.length === 0 ? (
                  <p className="text-xs text-zinc-400">데이터 없음</p>
                ) : (
                  <ul className="space-y-3">
                    {cat.items.map((item) => {
                      const hideValue = cat.key === "attack" || cat.key === "defense";

                      return (
                        <li key={item.id} className="flex items-center gap-2">
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: accent }}
                          >
                            {item.rank}
                          </span>
                          {item.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.photo}
                              alt={item.name}
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <DefaultPlayerPhoto name={item.name} size="sm" />
                          )}
                          {hideValue ? (
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                            </div>
                          ) : (
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                              <p className="shrink-0 text-xs font-semibold text-zinc-600">
                                {formatRankingValue(cat.key, item.value)}
                              </p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">최근 매치</h2>
        {data.recentMatches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">
            진행한 매치가 없어요
          </p>
        ) : (
          <div className="custom-scrollbar flex gap-4 overflow-x-auto pb-2">
            {data.recentMatches.map((match) => {
              const accent = resultAccent(match.totalResult);
              return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => onMatchClick(match.id)}
                  className="relative w-72 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 pl-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${accent.bar}`} aria-hidden="true" />

                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-lg font-bold text-zinc-900">
                      <span className="mr-1 text-xs font-semibold text-zinc-400">VS</span>
                      {match.opponentName}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${accent.badgeBg} ${accent.badgeText}`}
                    >
                      {matchResultLabel(match.totalResult)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <p className="text-xs text-zinc-500">{formatMatchDate(match.date)}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${opponentLevelBadgeClass(match.opponentLevel)}`}
                    >
                      상대팀 수준: {opponentLevelLabel(match.opponentLevel)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums text-zinc-900">{match.totalScoreUs}</span>
                    <span className="text-xl font-bold text-zinc-300">:</span>
                    <span className="text-2xl font-bold tabular-nums text-zinc-900">{match.totalScoreThem}</span>
                    <span className="ml-auto text-xs text-zinc-500">
                      {match.countWin}승 {match.countDraw}무 {match.countLoss}패
                    </span>
                  </div>

                  {match.momName ? (
                    <div className="mt-3 flex items-center gap-1.5 border-t border-zinc-100 pt-2">
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-amber-400"
                      >
                        <path d="M10 1.5l2.46 4.99 5.5.8-3.98 3.88.94 5.48L10 13.98l-4.92 2.67.94-5.48L2.04 7.29l5.5-.8L10 1.5z" />
                      </svg>
                      <p className="truncate text-xs text-zinc-500">
                        MOM <span className="font-semibold text-zinc-800">{match.momName}</span>
                      </p>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
