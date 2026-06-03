"use client";

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
  onOpenMatchIdConsumed?: () => void;
};

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
  onOpenMatchIdConsumed,
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

  const sortedStatEntries = useMemo(
    () => (detail ? sortStatEntries(detail.statEntries) : []),
    [detail],
  );

  const handleShare = async () => {
    if (!detail?.match) return;

    const message = buildShareMessage(detail.match, detail.statEntries);

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text: message, url: window.location.href });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      setToastMessage("복사됐습니다");
    } catch {
      setToastMessage("복사에 실패했습니다");
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
    if (!openMatchId) return;
    setSelectedMatchId(openMatchId);
    setView("DETAIL");
    onOpenMatchIdConsumed?.();
  }, [openMatchId, onOpenMatchIdConsumed]);

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
    setSelectedMatchId(matchId);
    setView("DETAIL");
  };

  const backToList = () => {
    setView("LIST");
    setSelectedMatchId(null);
    setDetail(null);
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
                공유하기
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
        <ul className="space-y-3">
          {filteredMatches.map((match) => {
            const accent = resultAccent(match.totalResult, teamColor);
            return (
              <li key={match.id}>
                <button
                  type="button"
                  onClick={() => openDetail(match.id)}
                  className="w-full rounded-xl border-2 bg-white p-4 text-left transition hover:shadow-md"
                  style={{ borderColor: accent.borderColor, backgroundColor: accent.backgroundColor }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold" style={{ color: accent.textColor }}>
                        VS {match.opponentName}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-600">
                        {formatMatchDate(match.date)} · {opponentLevelLabel(match.opponentLevel)}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium text-zinc-800">
                        {match.countWin}승 {match.countDraw}무 {match.countLoss}패
                      </p>
                      <p className="text-zinc-700">
                        {match.totalScoreUs} : {match.totalScoreThem}
                      </p>
                    </div>
                  </div>
                  {match.momName ? (
                    <p className="mt-2 text-xs text-zinc-600">MOM {match.momName}</p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {toastMessage ? <Toast message={toastMessage} /> : null}
    </section>
  );
}
