"use client";

import { useEffect, useMemo, useState } from "react";
import { shortYear } from "@/lib/player-period";
import type { OpponentLevelValue } from "@/lib/player-display";

type TournamentView = "LIST" | "DETAIL";

type TournamentResultValue = "WINNER" | "RUNNER_UP" | "THIRD" | "SEMIFINAL" | "GROUP_STAGE";

type TournamentListItem = {
  id: string;
  tournamentName: string | null;
  tournamentResult: TournamentResultValue | null;
  startDate: string | null;
  finishDate: string | null;
  mvpName: string | null;
};

type MatchResult = "WIN" | "DRAW" | "LOSS";
type PsoResult = "WIN" | "LOSS" | null;
type TournamentStage = "MAIN" | "PRELIMINARY" | null;

type MatchPlayerStat = {
  playerId: string;
  playerName: string;
  goals: number;
  assists: number;
};

type TournamentMatchItem = {
  id: string;
  stage: TournamentStage;
  opponentName: string;
  opponentLevel: OpponentLevelValue;
  date: string;
  totalScoreUs: number;
  totalScoreThem: number;
  totalResult: MatchResult;
  isPso: boolean;
  psoResult: PsoResult;
  countWin: number;
  countDraw: number;
  countLoss: number;
  gameCount: number;
  playerStats: MatchPlayerStat[];
};

type PlayerRecord = {
  id: string;
  name: string;
  photo: string | null;
  goals: number;
  assists: number;
};

type TournamentDetailResponse = {
  tournament: {
    id: string;
    tournamentName: string | null;
    tournamentResult: TournamentResultValue | null;
    startDate: string | null;
    finishDate: string | null;
  };
  summary: {
    matchCount: number;
    winRate: number;
    goalsScored: number;
    goalsConceded: number;
    winMatches: number;
    drawMatches: number;
    lossMatches: number;
  };
  mvp: {
    id: string;
    name: string;
    photo: string | null;
    goals: number;
    assists: number;
  } | null;
  playerRecords: PlayerRecord[];
  matches: {
    main: TournamentMatchItem[];
    preliminary: TournamentMatchItem[];
  };
};

type TeamTournamentTabProps = {
  teamId: string;
  teamColor: string | null;
};

function tournamentResultLabel(value: TournamentResultValue | null) {
  if (!value) return "-";
  if (value === "WINNER") return "우승";
  if (value === "RUNNER_UP") return "준우승";
  if (value === "THIRD") return "3위";
  if (value === "SEMIFINAL") return "본선진출";
  return "예선탈락";
}

function tournamentStageLabel(stage: TournamentStage) {
  if (stage === "MAIN") return "본선";
  if (stage === "PRELIMINARY") return "예선";
  return "-";
}

function opponentLevelLabel(level: OpponentLevelValue) {
  if (level === "TOP") return "최상";
  if (level === "HIGH") return "상";
  if (level === "MID") return "중";
  return "하";
}

function matchResultLabel(result: MatchResult) {
  if (result === "WIN") return "승";
  if (result === "DRAW") return "무";
  return "패";
}

function psoResultLabel(result: PsoResult) {
  if (result === "WIN") return "승부차기 승";
  if (result === "LOSS") return "승부차기 패";
  return "-";
}

function formatTournamentDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${shortYear(d.getFullYear())}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatTournamentPeriod(start: string | null, finish: string | null) {
  if (!start || !finish) return "-";
  return `${formatTournamentDate(start)} ~ ${formatTournamentDate(finish)}`;
}

function resultAccentClass(result: MatchResult) {
  if (result === "WIN") return "text-emerald-600";
  if (result === "DRAW") return "text-zinc-500";
  return "text-red-600";
}

function psoResultAccentClass(result: PsoResult) {
  if (result === "WIN") return "text-emerald-600";
  if (result === "LOSS") return "text-red-600";
  return "text-zinc-500";
}

function DefaultPlayerPhoto({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initial = name.trim().charAt(0) || "?";
  const cls =
    size === "sm"
      ? "h-10 w-10 text-sm"
      : size === "lg"
        ? "h-20 w-20 text-xl"
        : "h-16 w-16 text-base";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-500 ${cls}`}
    >
      {initial}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-center">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function MatchCard({ match }: { match: TournamentMatchItem }) {
  const resultText = match.isPso ? psoResultLabel(match.psoResult) : matchResultLabel(match.totalResult);
  const resultClass = match.isPso ? psoResultAccentClass(match.psoResult) : resultAccentClass(match.totalResult);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-zinc-500">{tournamentStageLabel(match.stage)}</p>
          <h4 className="font-semibold text-zinc-900">VS {match.opponentName}</h4>
          <p className="text-xs text-zinc-500">{opponentLevelLabel(match.opponentLevel)}</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${resultClass}`}>{resultText}</p>
          <p className="font-medium text-zinc-800">
            {match.totalScoreUs} : {match.totalScoreThem}
          </p>
          {match.gameCount >= 2 ? (
            <p className="text-sm text-zinc-600">
              {match.countWin}승 {match.countDraw}무 {match.countLoss}패
            </p>
          ) : null}
        </div>
      </div>
      {match.playerStats.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-sm">
          {match.playerStats.map((s) => (
            <li key={s.playerId} className="text-zinc-700">
              {s.playerName} — {s.goals}골 {s.assists}도움
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function TournamentListScreen({
  items,
  loading,
  searchQuery,
  accent,
  onSearchChange,
  onSelect,
}: {
  items: TournamentListItem[];
  loading: boolean;
  searchQuery: string;
  accent: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
}) {
  const filtered = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return items;
    return items.filter((t) => (t.tournamentName ?? "").includes(q));
  }, [items, searchQuery]);

  if (loading) {
    return <p className="text-sm text-zinc-500">대회 목록을 불러오는 중...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex justify-center">
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="대회 검색"
          className="h-10 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 text-sm shadow-sm"
          autoComplete="off"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-500">
          진행한 대회가 없습니다
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-300 hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="text-lg font-bold" style={{ color: accent }}>
                    {tournamentResultLabel(item.tournamentResult)}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-zinc-900">
                    {item.tournamentName?.trim() || "(이름 없음)"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {formatTournamentPeriod(item.startDate, item.finishDate)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    MVP {item.mvpName ?? "-"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TournamentDetailScreen({
  data,
  loading,
  accent,
  onBack,
}: {
  data: TournamentDetailResponse | null;
  loading: boolean;
  accent: string;
  onBack: () => void;
}) {
  if (loading) {
    return <p className="text-sm text-zinc-500">대회 상세를 불러오는 중...</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">대회 정보를 불러오지 못했습니다.</p>;
  }

  const { tournament, summary, mvp, playerRecords, matches } = data;

  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        ← 뒤로가기
      </button>

      <div>
        <h2 className="break-words text-2xl font-bold text-zinc-900">
          {tournament.tournamentName?.trim() || "(이름 없음)"}
        </h2>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
        <p className="text-xl font-bold" style={{ color: accent }}>
          {tournamentResultLabel(tournament.tournamentResult)}
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          {formatTournamentPeriod(tournament.startDate, tournament.finishDate)}
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
          <StatBox label="경기수" value={summary.matchCount} />
          <StatBox label="승률" value={`${summary.winRate}%`} />
          <StatBox label="득점" value={summary.goalsScored} />
          <StatBox label="실점" value={summary.goalsConceded} />
          <StatBox label="승" value={summary.winMatches} />
          <StatBox label="무" value={summary.drawMatches} />
          <StatBox label="패" value={summary.lossMatches} />
        </div>
      </section>

      {mvp ? (
        <section
          className="rounded-xl border-2 p-6 shadow-sm"
          style={{ borderColor: accent, backgroundColor: `${accent}10` }}
        >
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: accent }}>
            대회 MVP
          </p>
          <div className="flex items-center gap-5">
            {mvp.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mvp.photo} alt={mvp.name} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <DefaultPlayerPhoto name={mvp.name} size="lg" />
            )}
            <div>
              <p className="text-2xl font-bold text-zinc-900">{mvp.name}</p>
              <p className="mt-1 text-lg text-zinc-700">
                {mvp.goals}골 {mvp.assists}도움
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-4 text-lg font-semibold text-zinc-900">선수들 기록</h3>
        {playerRecords.length === 0 ? (
          <p className="text-sm text-zinc-500">기록이 있는 선수가 없습니다.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {playerRecords.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt={p.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <DefaultPlayerPhoto name={p.name} size="sm" />
                )}
                <div>
                  <p className="font-medium text-zinc-900">{p.name}</p>
                  <p className="text-sm text-zinc-600">
                    {p.goals}골 {p.assists}도움
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-6">
        <h3 className="text-lg font-semibold text-zinc-900">경기 결과</h3>

        {matches.main.length > 0 ? (
          <div>
            <h4 className="mb-3 text-sm font-semibold text-zinc-700">본선</h4>
            <ul className="space-y-3">
              {matches.main.map((m) => (
                <li key={m.id}>
                  <MatchCard match={m} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {matches.preliminary.length > 0 ? (
          <div>
            <h4 className="mb-3 text-sm font-semibold text-zinc-700">예선</h4>
            <ul className="space-y-3">
              {matches.preliminary.map((m) => (
                <li key={m.id}>
                  <MatchCard match={m} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {matches.main.length === 0 && matches.preliminary.length === 0 ? (
          <p className="text-sm text-zinc-500">등록된 경기가 없습니다.</p>
        ) : null}
      </section>
    </div>
  );
}

export function TeamTournamentTab({ teamId, teamColor }: TeamTournamentTabProps) {
  const accent = teamColor ?? "#3f3f46";

  const [view, setView] = useState<TournamentView>("LIST");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [listItems, setListItems] = useState<TournamentListItem[]>([]);
  const [detailData, setDetailData] = useState<TournamentDetailResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoadingList(true);
      setErrorMessage("");
      const res = await fetch(`/api/tournament/view/list?teamId=${encodeURIComponent(teamId)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setErrorMessage("대회 목록을 불러오지 못했습니다.");
        setListItems([]);
        setLoadingList(false);
        return;
      }
      const data = (await res.json()) as { tournaments: TournamentListItem[] };
      setListItems(data.tournaments);
      setLoadingList(false);
    };
    void load();
  }, [teamId]);

  useEffect(() => {
    if (view !== "DETAIL" || !selectedTournamentId) return;
    const load = async () => {
      setLoadingDetail(true);
      const res = await fetch(
        `/api/tournament/view/${encodeURIComponent(selectedTournamentId)}/detail?teamId=${encodeURIComponent(teamId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setDetailData(null);
        setLoadingDetail(false);
        return;
      }
      setDetailData((await res.json()) as TournamentDetailResponse);
      setLoadingDetail(false);
    };
    void load();
  }, [view, selectedTournamentId, teamId]);

  const openDetail = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
    setView("DETAIL");
  };

  const goBack = () => {
    setView("LIST");
    setSelectedTournamentId(null);
    setDetailData(null);
  };

  if (errorMessage && view === "LIST") {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-white p-8 text-red-600">{errorMessage}</div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        {view === "LIST" ? (
          <TournamentListScreen
            items={listItems}
            loading={loadingList}
            searchQuery={searchQuery}
            accent={accent}
            onSearchChange={setSearchQuery}
            onSelect={openDetail}
          />
        ) : (
          <TournamentDetailScreen
            data={detailData}
            loading={loadingDetail}
            accent={accent}
            onBack={goBack}
          />
        )}
      </div>
    </section>
  );
}
