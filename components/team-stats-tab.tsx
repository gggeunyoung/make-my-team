"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMatchDate, matchResultLabel, opponentLevelLabel, type OpponentLevelValue } from "@/lib/player-display";
import { periodTypeLabel, type PeriodOption, type PeriodType } from "@/lib/player-period";

type StatsView = "TEAM" | "PLAYER";

type PeriodsResponse = {
  periods: Record<PeriodType, PeriodOption[]>;
};

type TeamStatsSummary = {
  matchCount: number;
  winRate: number;
  goalsScored: number;
  goalsConceded: number;
  goalDifference: number;
  winTotal: number;
  drawTotal: number;
  lossTotal: number;
};

type LevelStat = {
  level: OpponentLevelValue;
  matchCount: number;
  winTotal: number;
  winRate: number;
};

type RecentMatchItem = {
  id: string;
  opponentName: string;
  totalScoreUs: number;
  totalScoreThem: number;
  date: string;
  countWin: number;
  countDraw: number;
  countLoss: number;
  totalResult: "WIN" | "DRAW" | "LOSS";
};

type TeamStatsResponse = {
  summary: TeamStatsSummary;
  byOpponentLevel: LevelStat[];
  recentMatches: RecentMatchItem[];
};

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

type TableRow = {
  id: string;
  name: string;
  photo: string | null;
  goals: number;
  assists: number;
  attackPoints: number;
  goalsPerMatch: number;
  assistsPerMatch: number;
  attackPointsPerMatch: number;
  attendanceRate: number;
  perfAttack: number;
  perfDefense: number;
  matchCount: number;
};

type PlayerStatsResponse = {
  hasPeriodMatches: boolean;
  rankings: RankingCategory[];
  table: TableRow[];
};

type TeamStatsTabProps = {
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

type TableSortKey =
  | "goals"
  | "assists"
  | "attackPoints"
  | "goalsPerMatch"
  | "assistsPerMatch"
  | "attackPointsPerMatch"
  | "attendanceRate";

const TABLE_COLUMNS: Array<{ key: TableSortKey; label: string }> = [
  { key: "goals", label: "골" },
  { key: "assists", label: "도움" },
  { key: "attackPoints", label: "공격포인트" },
  { key: "goalsPerMatch", label: "매치당 골" },
  { key: "assistsPerMatch", label: "매치당 도움" },
  { key: "attackPointsPerMatch", label: "매치당 공격포인트" },
  { key: "attendanceRate", label: "출석률" },
];

function DefaultPlayerPhoto({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initial = name.trim().charAt(0) || "?";
  const cls = size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-base";
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-500 ${cls}`}>
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

function PeriodFilters({
  period,
  subPeriod,
  periods,
  opponentLevel,
  showOpponentFilter,
  onPeriodChange,
  onSubPeriodChange,
  onOpponentLevelChange,
}: {
  period: PeriodType;
  subPeriod: string;
  periods: PeriodsResponse["periods"] | null;
  opponentLevel: "ALL" | OpponentLevelValue;
  showOpponentFilter: boolean;
  onPeriodChange: (p: PeriodType) => void;
  onSubPeriodChange: (v: string) => void;
  onOpponentLevelChange: (v: "ALL" | OpponentLevelValue) => void;
}) {
  const subPeriodOptions = periods?.[period] ?? [];

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="flex rounded-lg border border-zinc-200 p-0.5">
        {PERIOD_TAB_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPeriodChange(p)}
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
        onChange={(e) => onSubPeriodChange(e.target.value)}
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
      {showOpponentFilter ? (
        <select
          value={opponentLevel}
          onChange={(e) => onOpponentLevelChange(e.target.value as "ALL" | OpponentLevelValue)}
          className="h-9 rounded-lg border border-zinc-300 px-2 text-sm"
        >
          {OPPONENT_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function resultRowClass(result: "WIN" | "DRAW" | "LOSS") {
  if (result === "WIN") return "border-emerald-200 bg-emerald-50";
  if (result === "DRAW") return "border-zinc-200 bg-zinc-50";
  return "border-red-200 bg-red-50";
}

function resultTextClass(result: "WIN" | "DRAW" | "LOSS") {
  if (result === "WIN") return "text-emerald-600";
  if (result === "DRAW") return "text-zinc-500";
  return "text-red-600";
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

function TeamStatsContent({
  data,
  loading,
}: {
  data: TeamStatsResponse | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-zinc-500">팀 스탯을 불러오는 중...</p>;
  }

  const summary = data?.summary;
  const byLevel = data?.byOpponentLevel ?? [];
  const recent = data?.recentMatches ?? [];

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-4 text-lg font-semibold text-zinc-900">매치 결과 종합</h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          <StatBox label="진행한 매치" value={summary?.matchCount ?? 0} />
          <StatBox label="승률" value={`${summary?.winRate ?? 0}%`} />
          <StatBox label="득점" value={summary?.goalsScored ?? 0} />
          <StatBox label="실점" value={summary?.goalsConceded ?? 0} />
          <StatBox label="골 득실차" value={summary?.goalDifference ?? 0} />
          <StatBox label="승" value={summary?.winTotal ?? 0} />
          <StatBox label="무" value={summary?.drawTotal ?? 0} />
          <StatBox label="패" value={summary?.lossTotal ?? 0} />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-lg font-semibold text-zinc-900">상대팀 수준별 통계</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {byLevel.map((row) => (
            <div key={row.level} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="mb-2 text-sm font-semibold text-zinc-800">{opponentLevelLabel(row.level)}</p>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">진행한 매치</dt>
                  <dd className="font-medium text-zinc-900">{row.matchCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">승</dt>
                  <dd className="font-medium text-zinc-900">{row.winTotal}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">승률</dt>
                  <dd className="font-medium text-zinc-900">{row.winRate}%</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-lg font-semibold text-zinc-900">최근 매치 결과</h3>
        {recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">
            해당 기간 진행한 매치가 없습니다
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((m) => (
              <li
                key={m.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${resultRowClass(m.totalResult)}`}
              >
                <div>
                  <p className="font-semibold text-zinc-900">VS {m.opponentName}</p>
                  <p className="text-xs text-zinc-500">{formatMatchDate(m.date)}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-zinc-800">
                    {m.totalScoreUs} : {m.totalScoreThem}
                  </p>
                  <p className="text-zinc-600">
                    {m.countWin}승 {m.countDraw}무 {m.countLoss}패
                  </p>
                  <p className={`font-semibold ${resultTextClass(m.totalResult)}`}>
                    {matchResultLabel(m.totalResult)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlayerStatsContent({
  data,
  loading,
  accent,
}: {
  data: PlayerStatsResponse | null;
  loading: boolean;
  accent: string;
}) {
  const [sortKey, setSortKey] = useState<TableSortKey>("goals");

  const sortedTable = useMemo(() => {
    const rows = data?.table ?? [];
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return bv - av;
      return 0;
    });
  }, [data?.table, sortKey]);

  if (loading) {
    return <p className="text-sm text-zinc-500">선수 스탯을 불러오는 중...</p>;
  }

  const hasMatches = data?.hasPeriodMatches ?? false;
  const rankings = data?.rankings ?? [];

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-4 text-lg font-semibold text-zinc-900">기간별 선수 순위</h3>
        {!hasMatches ? (
          <p className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">
            진행한 매치가 없어요
          </p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {rankings.map((cat) => (
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
                            <img src={item.photo} alt={item.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
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
      </section>

      <section>
        <h3 className="mb-4 text-lg font-semibold text-zinc-900">세부 선수 통계</h3>
        {!hasMatches ? (
          <p className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">
            진행한 매치가 없어요
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100">
                  <th className="sticky left-0 z-10 min-w-[140px] border-r border-zinc-200 bg-zinc-100 px-3 py-2 text-left font-semibold text-zinc-700">
                    선수
                  </th>
                  {TABLE_COLUMNS.map((col) => (
                    <th key={col.key} className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setSortKey(col.key)}
                        className={`font-semibold transition hover:text-zinc-900 ${
                          sortKey === col.key ? "text-zinc-900 underline" : "text-zinc-600"
                        }`}
                      >
                        {col.label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTable.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="sticky left-0 z-10 border-r border-zinc-200 bg-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        {row.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.photo} alt={row.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                        ) : (
                          <DefaultPlayerPhoto name={row.name} size="sm" />
                        )}
                        <span className="font-medium text-zinc-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.goals}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.assists}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.attackPoints}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.goalsPerMatch.toFixed(2)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.assistsPerMatch.toFixed(2)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {row.attackPointsPerMatch.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.attendanceRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function TeamStatsTab({ teamId, teamColor }: TeamStatsTabProps) {
  const accent = teamColor ?? "#3f3f46";

  const [view, setView] = useState<StatsView>("PLAYER");
  const [periods, setPeriods] = useState<PeriodsResponse["periods"] | null>(null);
  const [period, setPeriod] = useState<PeriodType>("MONTHLY");
  const [subPeriod, setSubPeriod] = useState("");
  const [opponentLevel, setOpponentLevel] = useState<"ALL" | OpponentLevelValue>("ALL");
  const [teamData, setTeamData] = useState<TeamStatsResponse | null>(null);
  const [playerData, setPlayerData] = useState<PlayerStatsResponse | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoadingPeriods(true);
      setErrorMessage("");
      const res = await fetch(`/api/players/periods?teamId=${encodeURIComponent(teamId)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setErrorMessage("기간 정보를 불러오지 못했습니다.");
        setLoadingPeriods(false);
        return;
      }
      const data = (await res.json()) as PeriodsResponse;
      setPeriods(data.periods);
      const firstMonth = data.periods.MONTHLY[0]?.value ?? "";
      setSubPeriod(firstMonth);
      setLoadingPeriods(false);
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
    if (!subPeriod || view !== "TEAM") return;
    const load = async () => {
      setLoadingTeam(true);
      const params = new URLSearchParams({ teamId, period, subPeriod });
      const res = await fetch(`/api/stats/team?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setTeamData(null);
        setLoadingTeam(false);
        return;
      }
      setTeamData((await res.json()) as TeamStatsResponse);
      setLoadingTeam(false);
    };
    void load();
  }, [teamId, period, subPeriod, view]);

  useEffect(() => {
    if (!subPeriod || view !== "PLAYER") return;
    const load = async () => {
      setLoadingPlayer(true);
      const params = new URLSearchParams({ teamId, period, subPeriod, opponentLevel });
      const res = await fetch(`/api/stats/players?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setPlayerData(null);
        setLoadingPlayer(false);
        return;
      }
      setPlayerData((await res.json()) as PlayerStatsResponse);
      setLoadingPlayer(false);
    };
    void load();
  }, [teamId, period, subPeriod, opponentLevel, view]);

  if (loadingPeriods) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-600">스탯을 불러오는 중...</div>
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

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 flex rounded-lg border border-zinc-200 p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setView("TEAM")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            view === "TEAM" ? "text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
          style={view === "TEAM" ? { backgroundColor: accent } : undefined}
        >
          팀 스탯
        </button>
        <button
          type="button"
          onClick={() => setView("PLAYER")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            view === "PLAYER" ? "text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
          style={view === "PLAYER" ? { backgroundColor: accent } : undefined}
        >
          선수 스탯
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <PeriodFilters
          period={period}
          subPeriod={subPeriod}
          periods={periods}
          opponentLevel={opponentLevel}
          showOpponentFilter={view === "PLAYER"}
          onPeriodChange={setPeriod}
          onSubPeriodChange={setSubPeriod}
          onOpponentLevelChange={setOpponentLevel}
        />

        {view === "TEAM" ? (
          <TeamStatsContent data={teamData} loading={loadingTeam} />
        ) : (
          <PlayerStatsContent data={playerData} loading={loadingPlayer} accent={accent} />
        )}
      </div>
    </section>
  );
}
