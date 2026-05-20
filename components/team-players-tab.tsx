"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlayerStyleValue, PositionValue } from "@/lib/player";
import {
  formatMatchDate,
  matchResultLabel,
  opponentLevelLabel,
  playerStyleLabel,
  positionLabels,
  psoResultLabel,
  type OpponentLevelValue,
} from "@/lib/player-display";
import { periodTypeLabel, type PeriodOption, type PeriodType } from "@/lib/player-period";

type SportType = "FUTSAL" | "SOCCER";

type PlayerListItem = {
  id: string;
  name: string;
  photo: string | null;
  style: PlayerStyleValue;
  position: PositionValue[];
};

type MomMatchItem = {
  id: string;
  opponentName: string;
  date: string;
};

type PlayerInfoResponse = {
  sportType: SportType;
  player: PlayerListItem;
  momMatches: MomMatchItem[];
  attendanceRate: number;
  quarterLabel: string;
};

type StatsSummary = {
  matchCount: number;
  goals: number;
  assists: number;
  attackPoints: number;
  momCount: number;
  goalsPerMatch: number;
  assistsPerMatch: number;
  attackPointsPerMatch: number;
};

type MatchCardItem = {
  id: string;
  opponentName: string;
  opponentLevel: OpponentLevelValue;
  date: string;
  totalScoreUs: number;
  totalScoreThem: number;
  countWin: number;
  countDraw: number;
  countLoss: number;
  isPso: boolean;
  totalResult: "WIN" | "DRAW" | "LOSS";
  psoResult: "WIN" | "LOSS" | null;
  goals: number;
  assists: number;
  isMom: boolean;
};

type PeriodsResponse = {
  periods: Record<PeriodType, PeriodOption[]>;
};

type TeamPlayersTabProps = {
  teamId: string;
  teamColor: string | null;
};

const OPPONENT_FILTER_OPTIONS: Array<{ value: "ALL" | OpponentLevelValue; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "TOP", label: "최상" },
  { value: "HIGH", label: "상" },
  { value: "MID", label: "중" },
  { value: "LOW", label: "하" },
];

const PERIOD_TAB_ORDER: PeriodType[] = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "YEARLY"];

function DefaultPlayerPhoto({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || "?";
  return (
    <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-3xl font-semibold text-zinc-500">
      {initial}
    </div>
  );
}

function PlayerSearchInput({
  players,
  value,
  onChange,
  onSelectByName,
}: {
  players: PlayerListItem[];
  value: string;
  onChange: (text: string) => void;
  onSelectByName: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) return [];
    return players.filter((p) => p.name.includes(q));
  }, [value, players]);

  const tryExactSelect = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const found = players.find((p) => p.name === trimmed);
    if (found) onSelectByName(trimmed);
  };

  return (
    <div className="relative mx-auto w-full max-w-md">
      <input
        value={value}
        placeholder="선수 이름 검색"
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            tryExactSelect(value);
            setOpen(false);
          }
        }}
        className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm shadow-sm"
        autoComplete="off"
      />
      {open && suggestions.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-md">
          {suggestions.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-zinc-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p.name);
                  onSelectByName(p.name);
                  setOpen(false);
                }}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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

export function TeamPlayersTab({ teamId, teamColor }: TeamPlayersTabProps) {
  const accent = teamColor ?? "#3f3f46";

  const [players, setPlayers] = useState<PlayerListItem[]>([]);
  const [sportType, setSportType] = useState<SportType>("FUTSAL");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [playerInfo, setPlayerInfo] = useState<PlayerInfoResponse | null>(null);
  const [periods, setPeriods] = useState<PeriodsResponse["periods"] | null>(null);
  const [period, setPeriod] = useState<PeriodType>("MONTHLY");
  const [subPeriod, setSubPeriod] = useState("");
  const [opponentLevel, setOpponentLevel] = useState<"ALL" | OpponentLevelValue>("ALL");
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [matchCards, setMatchCards] = useState<MatchCardItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const subPeriodOptions = periods?.[period] ?? [];

  const selectPlayer = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    const player = players.find((p) => p.id === playerId);
    if (player) setSearchQuery(player.name);
  }, [players]);

  const selectPlayerByName = useCallback(
    (name: string) => {
      const found = players.find((p) => p.name === name.trim());
      if (found) selectPlayer(found.id);
    },
    [players, selectPlayer],
  );

  useEffect(() => {
    const load = async () => {
      setLoadingList(true);
      setErrorMessage("");
      const [listRes, periodsRes] = await Promise.all([
        fetch(`/api/players/list?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" }),
        fetch(`/api/players/periods?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" }),
      ]);
      if (!listRes.ok) {
        setErrorMessage("선수 목록을 불러오지 못했습니다.");
        setLoadingList(false);
        return;
      }
      const listData = (await listRes.json()) as { sportType: SportType; players: PlayerListItem[] };
      setSportType(listData.sportType);
      setPlayers(listData.players);
      if (listData.players.length > 0) {
        setSelectedPlayerId(listData.players[0].id);
        setSearchQuery(listData.players[0].name);
      }
      if (periodsRes.ok) {
        const periodsData = (await periodsRes.json()) as PeriodsResponse;
        setPeriods(periodsData.periods);
        const firstMonth = periodsData.periods.MONTHLY[0]?.value ?? "";
        setSubPeriod(firstMonth);
      }
      setLoadingList(false);
    };
    void load();
  }, [teamId]);

  useEffect(() => {
    if (!periods) return;
    const options = periods[period];
    if (options.length === 0) {
      setSubPeriod("");
      return;
    }
    if (!options.some((o) => o.value === subPeriod)) {
      setSubPeriod(options[0].value);
    }
  }, [period, periods, subPeriod]);

  useEffect(() => {
    if (!selectedPlayerId) {
      setPlayerInfo(null);
      return;
    }
    const loadInfo = async () => {
      setLoadingInfo(true);
      const res = await fetch(
        `/api/players/${encodeURIComponent(selectedPlayerId)}/info?teamId=${encodeURIComponent(teamId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setPlayerInfo(null);
        setLoadingInfo(false);
        return;
      }
      const data = (await res.json()) as PlayerInfoResponse;
      setPlayerInfo(data);
      setLoadingInfo(false);
    };
    void loadInfo();
  }, [selectedPlayerId, teamId]);

  useEffect(() => {
    if (!selectedPlayerId || !subPeriod) {
      setSummary(null);
      setMatchCards([]);
      return;
    }
    const loadStats = async () => {
      setLoadingStats(true);
      const params = new URLSearchParams({
        teamId,
        period,
        subPeriod,
        opponentLevel,
      });
      const res = await fetch(
        `/api/players/${encodeURIComponent(selectedPlayerId)}/stats?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setSummary(null);
        setMatchCards([]);
        setLoadingStats(false);
        return;
      }
      const data = (await res.json()) as { summary: StatsSummary; matchCards: MatchCardItem[] };
      setSummary(data.summary);
      setMatchCards(data.matchCards);
      setLoadingStats(false);
    };
    void loadStats();
  }, [selectedPlayerId, teamId, period, subPeriod, opponentLevel]);

  if (loadingList) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-600">선수 정보를 불러오는 중...</div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-white p-8 text-red-600">{errorMessage}</div>
      </section>
    );
  }

  if (players.length === 0) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-600">등록된 선수가 없습니다.</div>
      </section>
    );
  }

  const info = playerInfo?.player;
  const showPosition = sportType === "SOCCER" && info && info.position.length > 0;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 flex justify-center">
        <PlayerSearchInput
          players={players}
          value={searchQuery}
          onChange={setSearchQuery}
          onSelectByName={selectPlayerByName}
        />
      </div>

      <div className="flex min-h-[640px] gap-4">
        <aside className="w-44 shrink-0 rounded-xl border border-zinc-200 bg-white">
          <ul className="max-h-[720px] overflow-y-auto py-2">
            {players.map((player) => {
              const selected = player.id === selectedPlayerId;
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    onClick={() => selectPlayer(player.id)}
                    className="w-full px-3 py-2.5 text-left text-sm transition"
                    style={
                      selected
                        ? { backgroundColor: accent, color: "#fff", fontWeight: 600 }
                        : { color: "#3f3f46" }
                    }
                  >
                    {player.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          {loadingInfo || !info ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">선수 정보를 불러오는 중...</div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex gap-6">
                {info.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={info.photo} alt={info.name} className="h-28 w-24 shrink-0 rounded-lg object-cover" />
                ) : (
                  <DefaultPlayerPhoto name={info.name} />
                )}
                <div className="min-w-0 flex-1 space-y-4">
                  <h2 className="text-2xl font-bold text-zinc-900">{info.name}</h2>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    <div>
                      <span className="text-zinc-500">성향</span>
                      <p className="font-medium text-zinc-900">{playerStyleLabel(info.style)}</p>
                    </div>
                    {showPosition ? (
                      <div>
                        <span className="text-zinc-500">포지션</span>
                        <p className="font-medium text-zinc-900">{positionLabels(info.position)}</p>
                      </div>
                    ) : null}
                    <div>
                      <span className="text-zinc-500">상 받은 횟수</span>
                      <p className="text-zinc-400">추후 업데이트 예정</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">출석률</span>
                      <p className="text-xl font-semibold text-zinc-900">{playerInfo?.attendanceRate ?? 0}%</p>
                      <p className="text-xs text-zinc-500">{playerInfo?.quarterLabel}</p>
                    </div>
                  </div>
                </div>
                <div className="w-52 shrink-0">
                  <p className="mb-2 text-sm font-medium text-zinc-700">MOM 받은 횟수</p>
                  <ul className="max-h-[132px] space-y-2 overflow-y-auto pr-1 text-sm">
                    {(playerInfo?.momMatches.length ?? 0) === 0 ? (
                      <li className="text-zinc-400">없음</li>
                    ) : (
                      playerInfo?.momMatches.map((m) => (
                        <li key={m.id} className="rounded border border-zinc-100 bg-zinc-50 px-2 py-1.5">
                          <p className="font-medium text-zinc-800">VS {m.opponentName}</p>
                          <p className="text-xs text-zinc-500">{formatMatchDate(m.date)}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">기간별 스탯</h3>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-zinc-200 p-0.5">
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
                disabled={subPeriodOptions.length === 0}
                className="h-9 rounded-lg border border-zinc-300 px-2 text-sm"
              >
                {subPeriodOptions.length === 0 ? (
                  <option value="">기간 없음</option>
                ) : (
                  subPeriodOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))
                )}
              </select>
              <select
                value={opponentLevel}
                onChange={(e) => setOpponentLevel(e.target.value as "ALL" | OpponentLevelValue)}
                className="h-9 rounded-lg border border-zinc-300 px-2 text-sm"
              >
                {OPPONENT_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {loadingStats ? (
              <p className="text-sm text-zinc-500">스탯을 불러오는 중...</p>
            ) : (
              <>
                <div className="mb-6 grid grid-cols-4 gap-2 sm:grid-cols-8">
                  <StatBox label="경기수" value={summary?.matchCount ?? 0} />
                  <StatBox label="골" value={summary?.goals ?? 0} />
                  <StatBox label="도움" value={summary?.assists ?? 0} />
                  <StatBox label="공격포인트" value={summary?.attackPoints ?? 0} />
                  <StatBox label="MOM횟수" value={summary?.momCount ?? 0} />
                  <StatBox label="경기당 골" value={summary?.goalsPerMatch ?? 0} />
                  <StatBox label="경기당 도움" value={summary?.assistsPerMatch ?? 0} />
                  <StatBox label="경기당 공격포인트" value={summary?.attackPointsPerMatch ?? 0} />
                </div>

                <div className="space-y-3">
                  {matchCards.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">
                      해당 기간 진행한 매치가 없습니다
                    </p>
                  ) : (
                    matchCards.map((card) => {
                      const finalResult = card.isPso
                        ? card.psoResult
                          ? psoResultLabel(card.psoResult)
                          : "-"
                        : matchResultLabel(card.totalResult);

                      return (
                        <article key={card.id} className="rounded-lg border border-zinc-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-zinc-900">VS {card.opponentName}</h4>
                              <p className="text-xs text-zinc-500">
                                {formatMatchDate(card.date)} · {opponentLevelLabel(card.opponentLevel)}
                              </p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="font-medium text-zinc-800">
                                종합 {card.totalScoreUs} : {card.totalScoreThem}
                              </p>
                              <p className="text-zinc-600">
                                {card.countWin}승 {card.countDraw}무 {card.countLoss}패
                              </p>
                              <p className="font-medium text-zinc-900">최종 {finalResult}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-zinc-700">
                            {card.goals}골 {card.assists}도움
                            {card.isMom ? (
                              <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                MOM
                              </span>
                            ) : null}
                          </p>
                        </article>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
