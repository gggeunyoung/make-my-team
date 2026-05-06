"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { validateTournamentCompletePayload } from "@/lib/tournament-complete-validation";
import { TournamentMatchRecordForm } from "@/components/tournament-match-record-form";

type SportType = "FUTSAL" | "SOCCER";
type MatchFormatFutsal = "FIVE_VS_FIVE" | "SIX_VS_SIX";

type PlayerLite = {
  id: string;
  name: string;
};

type TournamentResultValue = "WINNER" | "RUNNER_UP" | "THIRD" | "SEMIFINAL" | "GROUP_STAGE";

type TournamentListRow = {
  id: string;
  tournament_name: string | null;
  tournament_result: TournamentResultValue | null;
  start_date: string | null;
  finish_date: string | null;
};

type TournamentMatchRow = {
  id: string;
  opponent_name: string;
  opponent_level: "TOP" | "HIGH" | "MID" | "LOW";
  date: string;
  total_score_us: number;
  total_score_them: number;
  total_result: "WIN" | "DRAW" | "LOSS";
  count_win: number;
  count_draw: number;
  count_loss: number;
  stage: "PRELIMINARY" | "MAIN" | null;
  is_pso: boolean;
  pso_result: "WIN" | "LOSS" | "PSO_WIN" | "PSO_LOSE" | null;
  match_format_futsal: MatchFormatFutsal | null;
};

type DetailModel = {
  id: string;
  teamId: string;
  tournament_name: string;
  tournament_result: TournamentResultValue | "";
  start_date: string;
  finish_date: string;
  attendees: string[];
  pick_1st: string | null;
  pick_2nd: string | null;
  pick_3rd: string | null;
  is_completed: boolean;
  matches: TournamentMatchRow[];
  attendeeRemovalBlockedIds: string[];
};

type TournamentDetailApi = {
  id: string;
  teamId: string;
  tournament_name: string | null;
  tournament_result: TournamentResultValue | null;
  start_date: string | null;
  finish_date: string | null;
  attendees: string[];
  pick_1st: string | null;
  pick_2nd: string | null;
  pick_3rd: string | null;
  is_completed: boolean;
  matches: TournamentMatchRow[];
};

type TournamentManagerTabProps = {
  teamId: string;
  sportType: SportType;
  players: PlayerLite[];
};

function tournamentResultLabel(value: TournamentResultValue | null | "") {
  if (!value) return "";
  if (value === "WINNER") return "우승";
  if (value === "RUNNER_UP") return "준우승";
  if (value === "THIRD") return "3위";
  if (value === "SEMIFINAL") return "본선진출";
  return "예선탈락";
}

function tournamentStageLabel(stage: TournamentMatchRow["stage"]) {
  if (stage === "PRELIMINARY") return "예선";
  if (stage === "MAIN") return "본선";
  return "-";
}

function opponentLevelLabel(level: TournamentMatchRow["opponent_level"]) {
  if (level === "TOP") return "최상";
  if (level === "HIGH") return "상";
  if (level === "MID") return "중";
  return "하";
}

function matchResultLabel(result: TournamentMatchRow["total_result"]) {
  if (result === "WIN") return "승";
  if (result === "DRAW") return "무";
  return "패";
}

function psoResultLabel(result: TournamentMatchRow["pso_result"]) {
  if (result === "WIN" || result === "PSO_WIN") return "승부차기 승";
  if (result === "LOSS" || result === "PSO_LOSE") return "승부차기 패";
  return "승부차기";
}

function resultAccentClass(result: TournamentMatchRow["total_result"]) {
  if (result === "WIN") return "text-emerald-600 font-bold text-lg";
  if (result === "DRAW") return "text-zinc-500 font-bold text-lg";
  return "text-red-600 font-bold text-lg";
}

function psoResultAccentClass(result: TournamentMatchRow["pso_result"]) {
  if (result === "WIN" || result === "PSO_WIN") return resultAccentClass("WIN");
  if (result === "LOSS" || result === "PSO_LOSE") return resultAccentClass("LOSS");
  return "text-zinc-500 font-bold text-lg";
}

function futsalFormatLabel(format: MatchFormatFutsal | null) {
  if (format === "FIVE_VS_FIVE") return "5vs5";
  if (format === "SIX_VS_SIX") return "6vs6";
  return "-";
}

type AttendeeOption = { id: string; name: string };

function PlayerNameSuggestInput({
  value,
  disabled,
  options,
  onCommit,
  placeholder,
}: {
  value: string;
  disabled: boolean;
  options: AttendeeOption[];
  onCommit: (text: string, resolvedId: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) return [];
    return options.filter((p) => p.name.includes(q));
  }, [value, options]);

  return (
    <div className="relative">
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={(e) => {
          const text = e.target.value;
          const resolved =
            text.trim() && options.some((p) => p.name === text.trim())
              ? options.find((p) => p.name === text.trim())!.id
              : null;
          onCommit(text, resolved);
        }}
        className="h-9 w-full rounded border border-zinc-300 px-2 text-sm disabled:bg-zinc-100"
        autoComplete="off"
      />
      {open && !disabled && suggestions.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-md">
          {suggestions.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left hover:bg-zinc-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onCommit(p.name, p.id);
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

function formatPeriod(startIso: string | null | undefined, finishIso: string | null | undefined) {
  if (!startIso || !finishIso) return "-";
  const s = new Date(startIso).toLocaleDateString("ko-KR");
  const f = new Date(finishIso).toLocaleDateString("ko-KR");
  return `${s} ~ ${f}`;
}

export function TournamentManagerTab({ teamId, sportType, players }: TournamentManagerTabProps) {
  type ViewState =
    | { type: "LIST" }
    | { type: "DETAIL"; tournamentId: string; mode: "edit" | "view" }
    | { type: "MATCH_FORM"; tournamentId: string };

  const [view, setView] = useState<ViewState>({ type: "LIST" });
  const [listItems, setListItems] = useState<TournamentListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [detail, setDetail] = useState<DetailModel | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMessage, setDetailMessage] = useState("");
  const [detailIsError, setDetailIsError] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);

  const [pick1Query, setPick1Query] = useState("");
  const [pick1Id, setPick1Id] = useState<string | null>(null);
  const [pick2Query, setPick2Query] = useState("");
  const [pick2Id, setPick2Id] = useState<string | null>(null);
  const [pick3Query, setPick3Query] = useState("");
  const [pick3Id, setPick3Id] = useState<string | null>(null);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);

  const attendeeOptions = useMemo(
    () => detail?.attendees.map((id) => ({ id, name: playerMap.get(id) ?? "알 수 없음" })) ?? [],
    [detail, playerMap],
  );

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const res = await fetch(`/api/tournament/list?teamId=${encodeURIComponent(teamId)}`);
      const data = (await res.json()) as { tournaments?: TournamentListRow[]; message?: string };
      if (!res.ok) throw new Error(data.message ?? "대회 목록을 불러오지 못했습니다.");
      setListItems(data.tournaments ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "대회 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setListLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (view.type !== "LIST") return;
    void fetchList();
  }, [view.type, fetchList]);

  const applyDetailJson = useCallback(
    (payload: { tournament: TournamentDetailApi; attendeeRemovalBlockedIds?: string[] }) => {
      const t = payload.tournament;
      const blocked = new Set(payload.attendeeRemovalBlockedIds ?? []);

      setDetail({
        id: t.id,
        teamId: t.teamId,
        tournament_name: t.tournament_name ?? "",
        tournament_result: t.tournament_result ?? "",
        start_date: t.start_date ? t.start_date.slice(0, 10) : "",
        finish_date: t.finish_date ? t.finish_date.slice(0, 10) : "",
        attendees: t.attendees.length > 0 ? t.attendees : players.map((p) => p.id),
        pick_1st: t.pick_1st,
        pick_2nd: t.pick_2nd,
        pick_3rd: t.pick_3rd,
        is_completed: t.is_completed,
        matches: t.matches,
        attendeeRemovalBlockedIds: [...blocked],
      });

      const syncPick = (idVal: string | null | undefined, setQuery: (s: string) => void, setId: (s: string | null) => void) => {
        if (!idVal) {
          setQuery("");
          setId(null);
          return;
        }
        setId(idVal);
        setQuery(playerMap.get(idVal) ?? "");
      };

      syncPick(t.pick_1st, setPick1Query, setPick1Id);
      syncPick(t.pick_2nd, setPick2Query, setPick2Id);
      syncPick(t.pick_3rd, setPick3Query, setPick3Id);
    },
    [playerMap, players],
  );

  const fetchDetail = useCallback(
    async (tournamentId: string) => {
      setDetailLoading(true);
      setDetailMessage("");
      setDetailIsError(false);
      try {
        const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`);
        const data = (await res.json()) as {
          tournament?: TournamentDetailApi;
          attendeeRemovalBlockedIds?: string[];
          message?: string;
        };
        if (!res.ok || !data.tournament) {
          throw new Error(data.message ?? "대회 정보를 불러오지 못했습니다.");
        }
        applyDetailJson({
          tournament: data.tournament,
          attendeeRemovalBlockedIds: data.attendeeRemovalBlockedIds,
        });
      } catch (e) {
        setDetail(null);
        setDetailIsError(true);
        setDetailMessage(e instanceof Error ? e.message : "대회 정보 조회 중 오류가 발생했습니다.");
      } finally {
        setDetailLoading(false);
      }
    },
    [applyDetailJson],
  );

  useEffect(() => {
    if (view.type === "DETAIL") {
      void fetchDetail(view.tournamentId);
    }
  }, [view, fetchDetail]);

  const buildPatchBody = () => {
    if (!detail) return null;
    return {
      tournamentName: detail.tournament_name.trim() || null,
      tournamentResult: (detail.tournament_result || null) as TournamentResultValue | null,
      startDate: detail.start_date || null,
      finishDate: detail.finish_date || null,
      attendees: detail.attendees,
      pick1st: pick1Id,
      pick2nd: pick2Id,
      pick3rd: pick3Id,
    };
  };

  const persistOverview = async () => {
    if (!detail || detailSaving) return false;
    const body = buildPatchBody();
    if (!body) return false;

    setDetailSaving(true);
    setDetailMessage("");
    setDetailIsError(false);
    try {
      const res = await fetch(`/api/tournament/${encodeURIComponent(detail.id)}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        tournament?: {
          id: string;
          tournament_name: string | null;
          tournament_result: TournamentResultValue | null;
          start_date: string | null;
          finish_date: string | null;
          attendees: string[];
          pick_1st: string | null;
          pick_2nd: string | null;
          pick_3rd: string | null;
          is_completed: boolean;
        };
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.message ?? "저장에 실패했습니다.");
      }

      await fetchDetail(detail.id);
      setDetailMessage("저장되었습니다.");
      setDetailIsError(false);
      return true;
    } catch (e) {
      setDetailIsError(true);
      setDetailMessage(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      return false;
    } finally {
      setDetailSaving(false);
    }
  };

  const runCompleteValidation = (): string | null => {
    if (!detail) return "대회 정보가 없습니다.";
    const picksResolved = [pick1Id, pick2Id, pick3Id].filter(Boolean) as string[];
    if (new Set(picksResolved).size !== picksResolved.length) {
      return "MVP 1/2/3순위는 동일한 선수를 선택할 수 없습니다.";
    }

    return validateTournamentCompletePayload({
      tournament_name: detail.tournament_name.trim() || null,
      tournament_result: detail.tournament_result ? (detail.tournament_result as TournamentResultValue) : null,
      start_date: detail.start_date ? new Date(`${detail.start_date}T00:00:00.000Z`) : null,
      finish_date: detail.finish_date ? new Date(`${detail.finish_date}T00:00:00.000Z`) : null,
      attendees: detail.attendees,
      pick_1st: pick1Id,
      pick_2nd: pick2Id,
      pick_3rd: pick3Id,
      matches: detail.matches.map((m) => ({
        date: new Date(m.date),
        stage: m.stage,
      })),
    });
  };

  const onCompleteRegistration = async () => {
    if (!detail || detailSaving) return;
    const tournamentId = detail.id;
    const err = runCompleteValidation();
    if (err) {
      setDetailIsError(true);
      setDetailMessage(err);
      return;
    }

    const ok = await persistOverview();
    if (!ok) return;

    try {
      const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/complete`, { method: "POST" });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "등록 완료 처리에 실패했습니다.");
      setView({ type: "LIST" });
      setDetail(null);
      await fetchList();
    } catch (e) {
      setDetailIsError(true);
      setDetailMessage(e instanceof Error ? e.message : "등록 완료 처리 중 오류가 발생했습니다.");
    }
  };

  const onCreateTournament = async () => {
    try {
      const res = await fetch("/api/tournament/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const data = (await res.json()) as { tournamentId?: string; message?: string };
      if (!res.ok || !data.tournamentId) {
        throw new Error(data.message ?? "대회 생성에 실패했습니다.");
      }
      setView({ type: "DETAIL", tournamentId: data.tournamentId, mode: "edit" });
    } catch (e) {
      setListError(e instanceof Error ? e.message : "대회 생성 중 오류가 발생했습니다.");
    }
  };

  const onDeleteTournament = async (tournamentId: string) => {
    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`, { method: "DELETE" });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "삭제에 실패했습니다.");
      await fetchList();
      if (view.type === "DETAIL" && view.tournamentId === tournamentId) {
        setView({ type: "LIST" });
        setDetail(null);
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
    }
  };

  const onCancelDraft = async () => {
    if (!detail) return;
    const ok = window.confirm("대회 등록을 취소하면 입력한 내용이 모두 삭제됩니다. 계속할까요?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/tournament/${encodeURIComponent(detail.id)}`, { method: "DELETE" });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "취소 처리에 실패했습니다.");
      setView({ type: "LIST" });
      setDetail(null);
      await fetchList();
    } catch (e) {
      setDetailIsError(true);
      setDetailMessage(e instanceof Error ? e.message : "취소 처리 중 오류가 발생했습니다.");
    }
  };

  const blockedRemovalSet = useMemo(() => new Set(detail?.attendeeRemovalBlockedIds ?? []), [detail]);

  const toggleAttendee = (playerId: string) => {
    if (!detail || detail.is_completed) return;
    const exists = detail.attendees.includes(playerId);
    if (exists && blockedRemovalSet.has(playerId)) return;
    setDetail((prev) => {
      if (!prev) return prev;
      const nextAttendees = exists ? prev.attendees.filter((id) => id !== playerId) : [...prev.attendees, playerId];
      return { ...prev, attendees: nextAttendees };
    });
  };

  const deleteMatch = async (matchId: string) => {
    if (!detail || detail.is_completed) return;
    const ok = window.confirm("이 매치를 삭제할까요?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/tournament/${encodeURIComponent(detail.id)}/match/${encodeURIComponent(matchId)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "매치 삭제에 실패했습니다.");
      await fetchDetail(detail.id);
    } catch (e) {
      setDetailIsError(true);
      setDetailMessage(e instanceof Error ? e.message : "매치 삭제 중 오류가 발생했습니다.");
    }
  };

  const goMatchForm = async () => {
    if (!detail || detailSaving) return;
    const tournamentId = detail.id;
    if (!detail.start_date || !detail.finish_date) {
      setDetailIsError(true);
      setDetailMessage("대회 기간을 먼저 입력해주세요.");
      return;
    }
    const ok = await persistOverview();
    if (!ok) return;
    setView({ type: "MATCH_FORM", tournamentId });
  };

  if (view.type === "MATCH_FORM") {
    return (
      <TournamentMatchRecordForm
        teamId={teamId}
        tournamentId={view.tournamentId}
        sportType={sportType}
        players={players}
        onBack={() => {
          setView({ type: "DETAIL", tournamentId: view.tournamentId, mode: "edit" });
        }}
        onSaved={async () => {
          setView({ type: "DETAIL", tournamentId: view.tournamentId, mode: "edit" });
          await fetchDetail(view.tournamentId);
          await fetchList();
        }}
      />
    );
  }

  if (view.type === "DETAIL") {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            {view.mode === "view" ? "대회 조회" : "대회 입력"}
          </h2>
          {view.mode === "view" ? (
            <button
              type="button"
              onClick={() => {
                setView({ type: "LIST" });
                setDetail(null);
              }}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
            >
              목록으로
            </button>
          ) : null}
        </div>

        {detailLoading ? <p className="text-sm text-zinc-500">불러오는 중...</p> : null}
        {!detailLoading && detailMessage && !detailIsError ? (
          <p className={`mb-3 text-sm ${detailIsError ? "text-red-600" : "text-emerald-600"}`}>{detailMessage}</p>
        ) : null}

        {!detailLoading && detail ? (
          view.mode === "view" ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-zinc-200 p-4">
                <h3 className="mb-2 text-sm font-semibold text-zinc-900">대회 개요</h3>
                <div className="space-y-2 text-sm text-zinc-700">
                  <p>대회 이름: {detail.tournament_name.trim() || "-"}</p>
                  <p>대회 결과: {tournamentResultLabel(detail.tournament_result)}</p>
                  <p>대회 기간: {formatPeriod(detail.start_date, detail.finish_date)}</p>
                  <div>
                    <p className="font-medium text-zinc-900">참여 선수</p>
                    <p>{detail.attendees.map((id) => playerMap.get(id) ?? id).join(", ") || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-4">
                <h3 className="mb-2 text-sm font-semibold text-zinc-900">MVP</h3>
                <div className="space-y-1 text-sm text-zinc-700">
                  <p>1순위: {detail.pick_1st ? (playerMap.get(detail.pick_1st) ?? detail.pick_1st) : "-"}</p>
                  <p>2순위: {detail.pick_2nd ? (playerMap.get(detail.pick_2nd) ?? detail.pick_2nd) : "-"}</p>
                  <p>3순위: {detail.pick_3rd ? (playerMap.get(detail.pick_3rd) ?? detail.pick_3rd) : "-"}</p>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900">대회 매치</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {detail.matches.map((m) => (
                    <article key={m.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-900">
                            [{tournamentStageLabel(m.stage)}] VS {m.opponent_name}
                          </p>
                        </div>
                        <p className={m.is_pso ? psoResultAccentClass(m.pso_result) : resultAccentClass(m.total_result)}>
                          {m.is_pso ? psoResultLabel(m.pso_result) : matchResultLabel(m.total_result)}
                        </p>
                        <div className="space-y-0.5 text-xs text-zinc-600">
                          <p>매치 날짜: {new Date(m.date).toLocaleDateString("ko-KR")}</p>
                          <p>상대팀 수준: {opponentLevelLabel(m.opponent_level)}</p>
                          {sportType === "FUTSAL" ? <p>매치 포맷: {futsalFormatLabel(m.match_format_futsal)}</p> : null}
                          <p>
                            스코어: {m.total_score_us} : {m.total_score_them}
                          </p>
                          <p>
                            종합 승무패: {m.count_win}승 {m.count_draw}무 {m.count_loss}패
                          </p>
                          {m.is_pso ? (
                            <p>승부차기: {m.pso_result === "WIN" ? "승" : m.pso_result === "LOSS" ? "패" : "-"}</p>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="rounded-lg border border-zinc-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900">대회 개요</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    대회 이름
                    <input
                      value={detail.tournament_name}
                      onChange={(e) => setDetail({ ...detail, tournament_name: e.target.value })}
                      className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
                      disabled={detail.is_completed}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    대회 결과
                    <select
                      value={detail.tournament_result}
                      onChange={(e) =>
                        setDetail({ ...detail, tournament_result: e.target.value as DetailModel["tournament_result"] })
                      }
                      className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-normal"
                      disabled={detail.is_completed}
                    >
                      <option value="">선택</option>
                      <option value="WINNER">{tournamentResultLabel("WINNER")}</option>
                      <option value="RUNNER_UP">{tournamentResultLabel("RUNNER_UP")}</option>
                      <option value="THIRD">{tournamentResultLabel("THIRD")}</option>
                      <option value="SEMIFINAL">{tournamentResultLabel("SEMIFINAL")}</option>
                      <option value="GROUP_STAGE">{tournamentResultLabel("GROUP_STAGE")}</option>
                    </select>
                
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    시작일
                    <input
                      type="date"
                      value={detail.start_date}
                      onChange={(e) => setDetail({ ...detail, start_date: e.target.value })}
                      className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
                      disabled={detail.is_completed}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    종료일
                    <input
                      type="date"
                      value={detail.finish_date}
                      onChange={(e) => setDetail({ ...detail, finish_date: e.target.value })}
                      className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
                      disabled={detail.is_completed}
                    />
                  </label>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900">참여 선수</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {players.map((p) => {
                      const selected = detail.attendees.includes(p.id);
                      const lockedOff = selected && blockedRemovalSet.has(p.id);
                      return (
                        <div key={p.id} className="flex flex-col gap-1">
                          <button
                            type="button"
                            disabled={detail.is_completed || lockedOff}
                            onClick={() => toggleAttendee(p.id)}
                            className={`rounded-md border px-3 py-1.5 text-sm ${
                              selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"
                            } ${lockedOff || detail.is_completed ? "opacity-60" : ""}`}
                          >
                            {p.name}
                          </button>
                          {lockedOff ? (
                            <span className="max-w-[220px] text-[11px] leading-snug text-red-600">
                              이 선수는 이미 매치에 기록이 있어 제외할 수 없습니다
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-900">대회 매치</h3>
                  <button
                    type="button"
                    onClick={() => void goMatchForm()}
                    disabled={
                      detailSaving ||
                      detail.is_completed ||
                      !detail.start_date ||
                      !detail.finish_date
                    }
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    매치 추가
                  </button>
                </div>
                <p
                  className={`mb-3 text-xs ${
                    !detail.start_date || !detail.finish_date ? "text-zinc-600" : "text-transparent"
                  }`}
                >
                  대회 기간을 먼저 입력해주세요.
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  {detail.matches.map((m) => (
                    <article key={m.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-900">
                            [{tournamentStageLabel(m.stage)}] VS {m.opponent_name}
                          </p>
                          {!detail.is_completed ? (
                            <button
                              type="button"
                              onClick={() => void deleteMatch(m.id)}
                              className="shrink-0 rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              X
                            </button>
                          ) : null}
                        </div>
                        <p className={m.is_pso ? "text-transparent font-bold text-lg" : resultAccentClass(m.total_result)}>
                          {m.is_pso ? "\u00A0" : matchResultLabel(m.total_result)}
                        </p>
                        <div className="space-y-0.5 text-xs text-zinc-600">
                          <p>매치 날짜: {new Date(m.date).toLocaleDateString("ko-KR")}</p>
                          <p>상대팀 수준: {opponentLevelLabel(m.opponent_level)}</p>
                          {sportType === "FUTSAL" ? <p>매치 포맷: {futsalFormatLabel(m.match_format_futsal)}</p> : null}
                          <p>
                            스코어: {m.total_score_us} : {m.total_score_them}
                          </p>
                          <p>
                            종합 승무패: {m.count_win}승 {m.count_draw}무 {m.count_loss}패
                          </p>
                          {m.is_pso ? (
                            <p>승부차기: {m.pso_result === "WIN" ? "승" : m.pso_result === "LOSS" ? "패" : "-"}</p>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900">MVP (선택)</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    1순위
                    <PlayerNameSuggestInput
                      value={pick1Query}
                      disabled={detail.is_completed || attendeeOptions.length === 0}
                      options={attendeeOptions}
                      placeholder="선수 이름"
                      onCommit={(text, resolved) => {
                        setPick1Query(text);
                        setPick1Id(resolved);
                      }}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    2순위
                    <PlayerNameSuggestInput
                      value={pick2Query}
                      disabled={detail.is_completed || attendeeOptions.length === 0}
                      options={attendeeOptions.filter((p) => p.id !== pick1Id)}
                      placeholder="선수 이름"
                      onCommit={(text, resolved) => {
                        setPick2Query(text);
                        setPick2Id(resolved);
                      }}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    3순위
                    <PlayerNameSuggestInput
                      value={pick3Query}
                      disabled={detail.is_completed || attendeeOptions.length === 0}
                      options={attendeeOptions.filter((p) => p.id !== pick1Id && p.id !== pick2Id)}
                      placeholder="선수 이름"
                      onCommit={(text, resolved) => {
                        setPick3Query(text);
                        setPick3Id(resolved);
                      }}
                    />
                  </label>
                </div>
              </div>

              {!detail.is_completed ? (
                <div className="flex flex-wrap gap-3">
                  {detailMessage && detailIsError ? (
                    <p className="w-full text-sm text-red-600">{detailMessage}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onCancelDraft()}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700"
                  >
                    등록취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void onCompleteRegistration()}
                    disabled={detailSaving}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    등록 완료
                  </button>
                </div>
              ) : null}
            </div>
          )
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">대회관리</h2>
        <button
          type="button"
          onClick={() => void onCreateTournament()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          대회 생성
        </button>
      </div>

      {listError ? <p className="mb-3 text-sm text-red-600">{listError}</p> : null}
      {listLoading ? <p className="text-sm text-zinc-500">불러오는 중...</p> : null}

      {!listLoading && listItems.length === 0 ? (
        <p className="text-sm text-zinc-500">등록 완료된 대회가 없습니다.</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {listItems.map((item) => (
          <article key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => setView({ type: "DETAIL", tournamentId: item.id, mode: "view" })}
                className="flex-1 text-left"
              >
                <p className="text-lg font-bold text-zinc-900">{tournamentResultLabel(item.tournament_result)}</p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-600">대회이름 : {item.tournament_name?.trim() || "(이름 없음)"}</p>
                <p className="mt-1 text-xs text-zinc-600">기간: {formatPeriod(item.start_date, item.finish_date)}</p>
              </button>
              <button
                type="button"
                onClick={() => void onDeleteTournament(item.id)}
                className="shrink-0 rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                X
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
