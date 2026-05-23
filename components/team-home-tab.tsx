"use client";

import { useEffect, useState } from "react";
import {
  formatMatchDate,
  matchResultLabel,
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

function formatRankingValue(key: string, value: number) {
  if (key === "attendanceRate") return `${value}%`;
  if (key === "attack" || key === "defense") return value.toFixed(2);
  if (key.endsWith("PerMatch")) return value.toFixed(2);
  return String(value);
}

function resultAccent(result: MatchResult, teamColor: string | null) {
  if (result === "WIN") {
    const color = teamColor ?? "#3f3f46";
    return { borderColor: color, backgroundColor: `${color}14`, textColor: color };
  }
  if (result === "DRAW") {
    return { borderColor: "#d4d4d8", backgroundColor: "#fafafa", textColor: "#52525b" };
  }
  return { borderColor: "#fca5a5", backgroundColor: "#fef2f2", textColor: "#dc2626" };
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
          <p className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">
            진행한 매치가 없어요
          </p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {data.rankings.map((cat) => (
              <div
                key={cat.key}
                className="w-56 shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <p className="mb-3 text-sm font-semibold text-zinc-900">{cat.title}</p>
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
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                            {!hideValue ? (
                              <p className="text-xs font-semibold text-zinc-600">
                                {formatRankingValue(cat.key, item.value)}
                              </p>
                            ) : null}
                          </div>
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
          <div className="flex gap-4 overflow-x-auto pb-2">
            {data.recentMatches.map((match) => {
              const accentStyle = resultAccent(match.totalResult, teamColor);
              return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => onMatchClick(match.id)}
                  className="w-72 shrink-0 rounded-xl border-2 p-4 text-left transition hover:shadow-md"
                  style={{
                    borderColor: accentStyle.borderColor,
                    backgroundColor: accentStyle.backgroundColor,
                  }}
                >
                  <h3 className="text-lg font-semibold" style={{ color: accentStyle.textColor }}>
                    VS {match.opponentName}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-600">
                    {formatMatchDate(match.date)} · {opponentLevelLabel(match.opponentLevel)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-700">
                    {match.countWin}승 {match.countDraw}무 {match.countLoss}패 · {match.totalScoreUs} :{" "}
                    {match.totalScoreThem}
                  </p>
                  {match.momName ? (
                    <p className="mt-2 text-xs text-zinc-600">MOM {match.momName}</p>
                  ) : null}
                  <p className="mt-2 text-sm font-bold" style={{ color: accentStyle.textColor }}>
                    {matchResultLabel(match.totalResult)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
