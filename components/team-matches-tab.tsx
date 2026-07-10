"use client";

import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import {
  formatMatchDate,
  matchResultLabel,
  opponentLevelLabel,
  psoResultLabel,
  type OpponentLevelValue,
} from "@/lib/player-display";

type MatchResult = "WIN" | "DRAW" | "LOSS";

type MatchListItem = {
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

type GameItem = {
  id: string;
  gameNumber: number;
  scoreUs: number;
  scoreThem: number;
  result: MatchResult;
};

type MomPlayerDetail = {
  id: string;
  name: string;
  photo: string | null;
  goals: number;
  assists: number;
};

type StatEntry = {
  playerId: string;
  playerName: string;
  goals: number;
  assists: number;
};

type MatchDetailResponse = {
  match: {
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
    isPso: boolean;
    psoResult: "WIN" | "LOSS" | null;
  };
  games: GameItem[];
  momPlayer: MomPlayerDetail | null;
  statEntries: StatEntry[];
};

type TeamMatchesTabProps = {
  teamId: string;
  teamColor: string | null;
  openMatchId?: string | null;
  onMatchOpen?: (matchId: string) => void;
  onMatchBack?: () => void;
};

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: {
          objectType: "text";
          text: string;
          link: {
            mobileWebUrl: string;
            webUrl: string;
          };
        }) => void;
      };
    };
  }
}

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";

function initKakaoSdk() {
  if (!window.Kakao || !KAKAO_JS_KEY || window.Kakao.isInitialized()) return;
  window.Kakao.init(KAKAO_JS_KEY);
}

function DefaultPlayerPhoto({ name, size = "md" }: { name: string; size?: "md" | "sm" }) {
  const initial = name.trim().charAt(0) || "?";
  const cls =
    size === "sm"
      ? "h-16 w-14 text-xl"
      : "h-24 w-20 text-2xl";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-zinc-200 font-semibold text-zinc-500 ${cls}`}
    >
      {initial}
    </div>
  );
}

function resultAccent(result: MatchResult, _teamColor: string | null) {
  if (result === "WIN") {
    return { borderColor: "#a7f3d0", backgroundColor: "#ecfdf5", textColor: "#059669" };
  }
  if (result === "DRAW") {
    return { borderColor: "#d4d4d8", backgroundColor: "#fafafa", textColor: "#52525b" };
  }
  return { borderColor: "#fca5a5", backgroundColor: "#fef2f2", textColor: "#dc2626" };
}

function matchCardAccent(result: MatchResult) {
  if (result === "WIN") {
    return { bar: "bg-emerald-500", badgeBg: "bg-emerald-50", badgeText: "text-emerald-600" };
  }
  if (result === "DRAW") {
    return { bar: "bg-zinc-300", badgeBg: "bg-zinc-100", badgeText: "text-zinc-600" };
  }
  return { bar: "bg-rose-500", badgeBg: "bg-rose-50", badgeText: "text-rose-600" };
}

function gameResultClass(result: MatchResult) {
  if (result === "WIN") return "text-emerald-600 font-semibold";
  if (result === "DRAW") return "text-zinc-500 font-semibold";
  return "text-red-600 font-semibold";
}

function sortStatEntries(entries: StatEntry[]) {
  return [...entries].sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    return b.assists - a.assists;
  });
}

function formatShareDate(iso: string) {
  const d = new Date(iso);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월${d.getDate()}일(${weekdays[d.getDay()]})`;
}

function buildShareMessage(match: MatchDetailResponse["match"], statEntries: StatEntry[]) {
  const statLines = sortStatEntries(statEntries)
    .filter((s) => s.goals > 0 || s.assists > 0)
    .map((s) => `${s.playerName} ${s.goals}골 ${s.assists}도움`);

  return [
    `${formatShareDate(match.date)} 매칭결과`,
    `상대팀 : ${match.opponentName}`,
    `수준 : ${opponentLevelLabel(match.opponentLevel)}`,
    `최종스코어 : ${match.totalScoreUs}대${match.totalScoreThem}`,
    `종합승무패 : ${match.countWin}승 ${match.countDraw}무 ${match.countLoss}패`,
    "----------------",
    ...statLines,
  ].join("\n");
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
      {message}
    </div>
  );
}

export function TeamMatchesTab({
  teamId,
  teamColor,
  openMatchId = null,
  onMatchOpen,
  onMatchBack,
}: TeamMatchesTabProps) {
  const [view, setView] = useState<"LIST" | "DETAIL">("LIST");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [detail, setDetail] = useState<MatchDetailResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return matches;
    return matches.filter((m) => m.opponentName.includes(q));
  }, [matches, searchQuery]);

  const yearGroups = useMemo(() => {
    const years: { year: number; monthGroups: { key: string; month: number; items: MatchListItem[] }[] }[] = [];
    for (const match of filteredMatches) {
      const d = new Date(match.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;

      let yearGroup = years[years.length - 1];
      if (!yearGroup || yearGroup.year !== year) {
        yearGroup = { year, monthGroups: [] };
        years.push(yearGroup);
      }

      const monthGroup = yearGroup.monthGroups[yearGroup.monthGroups.length - 1];
      if (monthGroup && monthGroup.month === month) {
        monthGroup.items.push(match);
      } else {
        yearGroup.monthGroups.push({ key: `${year}-${month}`, month, items: [match] });
      }
    }
    return years;
  }, [filteredMatches]);

  const seasonSummary = useMemo(() => {
    const wins = matches.filter((m) => m.totalResult === "WIN").length;
    const draws = matches.filter((m) => m.totalResult === "DRAW").length;
    const losses = matches.filter((m) => m.totalResult === "LOSS").length;
    const total = matches.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const winPct = total > 0 ? (wins / total) * 100 : 0;
    const drawPct = total > 0 ? (draws / total) * 100 : 0;
    const lossPct = total > 0 ? (losses / total) * 100 : 0;
    return { wins, draws, losses, total, winRate, winPct, drawPct, lossPct };
  }, [matches]);

  const sortedStatEntries = useMemo(
    () => (detail ? sortStatEntries(detail.statEntries) : []),
    [detail],
  );

  const handleShare = async () => {
    if (!detail?.match || !window.Kakao?.isInitialized()) return;

    const shareMessage = buildShareMessage(detail.match, detail.statEntries);
    const url = window.location.href;

    try {
      window.Kakao.Share.sendDefault({
        objectType: "text",
        text: shareMessage,
        link: {
          mobileWebUrl: url,
          webUrl: url,
        },
      });
    } catch {
      try {
        await navigator.clipboard.writeText(shareMessage);
        setToastMessage("메세지가 복사됐어요! 카카오톡에 붙여넣기 해주세요");
      } catch {
        // ignore clipboard failure
      }
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoadingList(true);
      const res = await fetch(`/api/matches/list?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { matches: MatchListItem[] };
        setMatches(data.matches ?? []);
      } else {
        setMatches([]);
      }
      setLoadingList(false);
    };
    void load();
  }, [teamId]);

  useEffect(() => {
    if (openMatchId) {
      setSelectedMatchId(openMatchId);
      setView("DETAIL");
      return;
    }
    setView("LIST");
    setSelectedMatchId(null);
    setDetail(null);
  }, [openMatchId]);

  useEffect(() => {
    if (view !== "DETAIL" || !selectedMatchId) {
      setDetail(null);
      return;
    }
    const loadDetail = async () => {
      setLoadingDetail(true);
      const res = await fetch(
        `/api/matches/${encodeURIComponent(selectedMatchId)}/detail?teamId=${encodeURIComponent(teamId)}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        setDetail((await res.json()) as MatchDetailResponse);
      } else {
        setDetail(null);
      }
      setLoadingDetail(false);
    };
    void loadDetail();
  }, [view, selectedMatchId, teamId]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const openDetail = (matchId: string) => {
    onMatchOpen?.(matchId);
  };

  const backToList = () => {
    onMatchBack?.();
  };

  if (view === "DETAIL") {
    const m = detail?.match;
    const accent = m ? resultAccent(m.totalResult, teamColor) : null;
    const finalResult = m
      ? m.isPso
        ? m.psoResult
          ? psoResultLabel(m.psoResult)
          : "-"
        : matchResultLabel(m.totalResult)
      : "";

    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-6">
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
          strategy="lazyOnload"
          onLoad={initKakaoSdk}
        />
        <button
          type="button"
          onClick={backToList}
          className="mb-4 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          ← 목록으로
        </button>

        {loadingDetail || !m ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">매치 정보를 불러오는 중...</div>
        ) : (
          <div className="space-y-6">
            <div
              className="rounded-xl border-2 bg-white p-6"
              style={
                accent
                  ? { borderColor: accent.borderColor, backgroundColor: accent.backgroundColor }
                  : undefined
              }
            >
              <h2 className="text-2xl font-bold text-zinc-900">VS {m.opponentName}</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {formatMatchDate(m.date)} · {opponentLevelLabel(m.opponentLevel)}
              </p>
              <p className="mt-3 text-sm text-zinc-700">
                {m.countWin}승 {m.countDraw}무 {m.countLoss}패 · {m.totalScoreUs} : {m.totalScoreThem}
              </p>
              <p className="mt-2 text-xl font-bold" style={{ color: accent?.textColor }}>
                {finalResult}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-zinc-900">MOM</h3>
              {detail.momPlayer ? (
                <div className="flex items-center gap-4">
                  {detail.momPlayer.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detail.momPlayer.photo}
                      alt={detail.momPlayer.name}
                      className="h-24 w-20 rounded-lg object-cover"
                    />
                  ) : (
                    <DefaultPlayerPhoto name={detail.momPlayer.name} />
                  )}
                  <div>
                    <p className="text-lg font-semibold text-zinc-900">{detail.momPlayer.name}</p>
                    <p className="text-sm text-zinc-600">
                      {detail.momPlayer.goals}골 {detail.momPlayer.assists}도움
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">MOM 없음</p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-zinc-900">경기별 결과</h3>
              <ul className="space-y-2">
                {detail.games.map((g) => (
                  <li key={g.id} className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-800">{g.gameNumber}경기</span>
                    <span className={`text-sm ${gameResultClass(g.result)}`}>
                      {g.scoreUs} : {g.scoreThem}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-zinc-900">스탯 모음</h3>
              {sortedStatEntries.length === 0 ? (
                <p className="text-sm text-zinc-500">기록된 골·도움이 없습니다</p>
              ) : (
                <ul className="space-y-2">
                  {sortedStatEntries.map((s) => (
                    <li
                      key={s.playerId}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5 text-sm"
                    >
                      <span className="font-medium text-zinc-900">{s.playerName}</span>
                      <span className="text-zinc-600">
                        {s.goals}골 {s.assists}도움
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void handleShare()}
                className="rounded-lg border border-zinc-300 bg-white px-6 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                카카오 공유하기
              </button>
            </div>
          </div>
        )}
        {toastMessage ? <Toast message={toastMessage} /> : null}
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6">
      {!loadingList && seasonSummary.total > 0 ? (
        <div className="mx-auto mb-8 w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-400">이번 시즌 전적 · {seasonSummary.total}경기</p>
              <p className="mt-1.5 text-2xl font-bold text-zinc-900 sm:text-3xl">
                {seasonSummary.wins}
                <span className="mr-2 text-sm font-semibold text-zinc-400">승</span>
                {seasonSummary.draws}
                <span className="mr-2 text-sm font-semibold text-zinc-400">무</span>
                {seasonSummary.losses}
                <span className="text-sm font-semibold text-zinc-400">패</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium text-zinc-400">승률</p>
              <p className="mt-1.5 text-2xl font-bold text-emerald-600 sm:text-3xl">{seasonSummary.winRate}%</p>
            </div>
          </div>
          <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            {seasonSummary.winPct > 0 ? (
              <div className="bg-emerald-500" style={{ width: `${seasonSummary.winPct}%` }} />
            ) : null}
            {seasonSummary.drawPct > 0 ? (
              <div className="bg-zinc-300" style={{ width: `${seasonSummary.drawPct}%` }} />
            ) : null}
            {seasonSummary.lossPct > 0 ? (
              <div className="bg-rose-400" style={{ width: `${seasonSummary.lossPct}%` }} />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex justify-center">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="상대팀 이름 검색"
          className="h-10 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 text-sm shadow-sm"
        />
      </div>

      {loadingList ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">매치 목록을 불러오는 중...</div>
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-10 text-center text-zinc-500">
          {matches.length === 0 ? "진행한 매치가 없어요" : "검색 결과가 없습니다"}
        </div>
      ) : (
        <div className="space-y-12">
          {yearGroups.map((yearGroup) => (
            <div key={yearGroup.year}>
              <h2 className="mb-5 px-1 text-2xl font-bold text-zinc-900">{yearGroup.year}년</h2>
              <div className="space-y-5">
                {yearGroup.monthGroups.map((group) => (
                  <div key={group.key}>
                    <h3 className="mb-3 px-1 text-lg font-semibold text-zinc-700">{group.month}월</h3>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.items.map((match) => {
                        const accent = matchCardAccent(match.totalResult);
                        return (
                          <li key={match.id}>
                            <button
                              type="button"
                              onClick={() => openDetail(match.id)}
                              className="relative flex w-full flex-col gap-2 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 pl-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <span className={`absolute inset-y-0 left-0 w-1 ${accent.bar}`} aria-hidden="true" />

                              <div className="flex items-center justify-between gap-2">
                                <h4 className="truncate text-base font-bold text-zinc-900">
                                  <span className="mr-1 text-xs font-semibold text-zinc-400">VS</span>
                                  {match.opponentName}
                                </h4>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${accent.badgeBg} ${accent.badgeText}`}
                                >
                                  {matchResultLabel(match.totalResult)}
                                </span>
                              </div>

                              <p className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-bold tabular-nums text-zinc-900">
                                  {match.totalScoreUs}
                                </span>
                                <span className="text-lg font-bold text-zinc-300">:</span>
                                <span className="text-2xl font-bold tabular-nums text-zinc-900">
                                  {match.totalScoreThem}
                                </span>
                              </p>

                              <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                                <span className="truncate">
                                  {formatMatchDate(match.date)} · {opponentLevelLabel(match.opponentLevel)}
                                </span>
                                <span className="shrink-0">
                                  {match.countWin}승 {match.countDraw}무 {match.countLoss}패
                                </span>
                              </div>

                              {match.momName ? (
                                <div className="flex items-center gap-1.5">
                                  <svg
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5 shrink-0 text-amber-400"
                                  >
                                    <path d="M10 1.5l2.46 4.99 5.5.8-3.98 3.88.94 5.48L10 13.98l-4.92 2.67.94-5.48L2.04 7.29l5.5-.8L10 1.5z" />
                                  </svg>
                                  <p className="truncate text-xs text-zinc-500">
                                    MOM <span className="font-semibold text-zinc-800">{match.momName}</span>
                                  </p>
                                </div>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
