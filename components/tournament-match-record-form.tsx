"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmModal } from "@/components/confirm-modal";

type SportType = "FUTSAL" | "SOCCER";
type OpponentLevel = "TOP" | "HIGH" | "MID" | "LOW";
type RecordType = "PLAYER" | "MERCENARY" | "OWN_GOAL" | "NONE";
type TournamentStage = "PRELIMINARY" | "MAIN";
type MatchFormatFutsal = "FIVE_VS_FIVE" | "SIX_VS_SIX";

type PlayerLite = {
  id: string;
  name: string;
};

type GoalForm = {
  id: string;
  scorerId: string | null;
  scorerType: RecordType;
  scorerQuery: string;
  assisterId: string | null;
  assisterType: RecordType;
  assisterQuery: string;
};

type GameForm = {
  id: string;
  scoreUs: string;
  scoreThem: string;
  playersAll: string[];
  playersFw: string[];
  playersMf: string[];
  playersDf: string[];
  playersGk: string[];
  goals: GoalForm[];
};

type TournamentMatchRecordFormProps = {
  teamId: string;
  tournamentId: string;
  sportType: SportType;
  players: PlayerLite[];
  onBack: () => void;
  onSaved: () => void;
};

const OPPONENT_LEVEL_FORM_OPTIONS: Array<{ value: "TOP" | "HIGH" | "MID"; label: string }> = [
  { value: "TOP", label: "최상" },
  { value: "HIGH", label: "상" },
  { value: "MID", label: "중" },
];

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createGoalForm(): GoalForm {
  return {
    id: crypto.randomUUID(),
    scorerId: null,
    scorerType: "PLAYER",
    scorerQuery: "",
    assisterId: null,
    assisterType: "PLAYER",
    assisterQuery: "",
  };
}

function createGameForm(attendees: string[]): GameForm {
  return {
    id: crypto.randomUUID(),
    scoreUs: "",
    scoreThem: "",
    playersAll: [...attendees],
    playersFw: [],
    playersMf: [],
    playersDf: [],
    playersGk: [],
    goals: [],
  };
}

const GOAL_COUNT_MISMATCH_MSG = "우리팀 득점 수와 골 기록 수가 일치하지 않습니다.";

type TournamentMatchFormDraft = {
  opponentName: string;
  matchDate: string;
  opponentLevel: OpponentLevel;
  matchFormatFutsal: MatchFormatFutsal;
  stage: TournamentStage;
  isPso: boolean;
  psoResult: "WIN" | "LOSS" | null;
  attendees: string[];
  games: GameForm[];
};

function tournamentDraftKey(tournamentId: string) {
  return `tournament-match-form-draft:${tournamentId}`;
}

function saveDraft(key: string, data: TournamentMatchFormDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save tournament match form draft", error);
  }
}

function loadDraft(key: string): TournamentMatchFormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as TournamentMatchFormDraft;
  } catch (error) {
    console.error("Failed to load tournament match form draft", error);
    return null;
  }
}

function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to clear tournament match form draft", error);
  }
}

function hasTournamentMatchDraftContent(
  data: Pick<TournamentMatchFormDraft, "opponentName" | "games" | "isPso">,
): boolean {
  return data.opponentName.trim() !== "" || data.games.length > 0 || data.isPso;
}

function persistTournamentMatchDraft(key: string, data: TournamentMatchFormDraft) {
  if (!hasTournamentMatchDraftContent(data)) {
    clearDraft(key);
    return;
  }
  saveDraft(key, data);
}

function sanitizeDraftGames(games: GameForm[], validAttendeeIds: Set<string>): GameForm[] {
  const keep = (ids: string[]) => ids.filter((id) => validAttendeeIds.has(id));
  return games.map((game) => ({
    ...game,
    playersAll: keep(game.playersAll),
    playersFw: keep(game.playersFw),
    playersMf: keep(game.playersMf),
    playersDf: keep(game.playersDf),
    playersGk: keep(game.playersGk),
  }));
}

function isGoalCountMismatch(game: GameForm): boolean {
  const parsed = toInt(game.scoreUs);
  if (parsed === null) {
    return game.goals.length > 0;
  }
  return parsed !== game.goals.length;
}

type AttendeeOption = { id: string; name: string };

function PlayerNameSuggestInput({
  value,
  disabled,
  attendeePlayers,
  onCommit,
  placeholder,
}: {
  value: string;
  disabled: boolean;
  attendeePlayers: AttendeeOption[];
  onCommit: (text: string, resolvedId: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) return [];
    return attendeePlayers.filter((p) => p.name.includes(q));
  }, [value, attendeePlayers]);

  const trimmed = value.trim();
  const showUnregisteredWarning =
    !disabled && trimmed !== "" && !attendeePlayers.some((p) => p.name === trimmed);

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
            text.trim() && attendeePlayers.some((p) => p.name === text.trim())
              ? attendeePlayers.find((p) => p.name === text.trim())!.id
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
      <p className="mt-1 h-4 text-xs text-red-600">{showUnregisteredWarning ? "등록된 선수가 아닙니다" : ""}</p>
    </div>
  );
}

function toInt(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function TournamentMatchRecordForm({
  teamId,
  tournamentId,
  sportType,
  players,
  onBack,
  onSaved,
}: TournamentMatchRecordFormProps) {
  const [tournamentMeta, setTournamentMeta] = useState<{
    attendees: string[];
    startDate: string;
    finishDate: string;
    is_completed: boolean;
  } | null>(null);
  const [loadError, setLoadError] = useState("");

  const [opponentName, setOpponentName] = useState("");
  const [matchDate, setMatchDate] = useState(todayIso());
  const [opponentLevel, setOpponentLevel] = useState<OpponentLevel>("MID");
  const [matchFormatFutsal, setMatchFormatFutsal] = useState<MatchFormatFutsal>("FIVE_VS_FIVE");
  const [stage, setStage] = useState<TournamentStage>("PRELIMINARY");
  const [isPso, setIsPso] = useState(false);
  const [psoResult, setPsoResult] = useState<"WIN" | "LOSS" | null>(null);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [games, setGames] = useState<GameForm[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formIsError, setFormIsError] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const historyGuardPushedRef = useRef(false);
  const allowLeaveRef = useRef(false);
  const leaveActionRef = useRef<"ui" | "popstate" | null>(null);

  const hasUnsavedChanges = useMemo(
    () => hasTournamentMatchDraftContent({ opponentName, games, isPso }),
    [opponentName, games, isPso],
  );

  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player.name])), [players]);

  const attendeePlayers = useMemo(
    () => attendees.map((id) => ({ id, name: playerMap.get(id) ?? "알 수 없는 선수" })),
    [attendees, playerMap],
  );

  const loadTournament = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`);
      const data = (await res.json()) as {
        tournament?: {
          attendees: string[];
          start_date: string | null;
          finish_date: string | null;
          is_completed: boolean;
        };
        message?: string;
      };
      if (!res.ok || !data.tournament) {
        throw new Error(data.message ?? "대회 정보를 불러오지 못했습니다.");
      }
      if (data.tournament.is_completed) {
        throw new Error("등록이 완료된 대회에는 매치를 추가할 수 없습니다.");
      }
      const start = data.tournament.start_date ? data.tournament.start_date.slice(0, 10) : "";
      const finish = data.tournament.finish_date ? data.tournament.finish_date.slice(0, 10) : "";
      const validAttendeeIds = new Set(data.tournament.attendees);
      const clampDate = (d: string) => {
        if (!start || !finish) return d;
        if (d < start) return start;
        if (d > finish) return finish;
        return d;
      };

      setTournamentMeta({
        attendees: data.tournament.attendees,
        startDate: start,
        finishDate: finish,
        is_completed: data.tournament.is_completed,
      });

      const draft = loadDraft(tournamentDraftKey(tournamentId));
      if (draft) {
        const filteredAttendees = (draft.attendees ?? []).filter((id) => validAttendeeIds.has(id));
        const restoredAttendees =
          filteredAttendees.length > 0 ? filteredAttendees : [...data.tournament.attendees];
        setOpponentName(draft.opponentName ?? "");
        setMatchDate(clampDate(draft.matchDate ?? todayIso()));
        setOpponentLevel(draft.opponentLevel ?? "MID");
        setMatchFormatFutsal(draft.matchFormatFutsal ?? "FIVE_VS_FIVE");
        setStage(draft.stage ?? "PRELIMINARY");
        setIsPso(draft.isPso ?? false);
        setPsoResult(draft.psoResult ?? null);
        setAttendees(restoredAttendees);
        const restoredGames = sanitizeDraftGames(draft.games ?? [], validAttendeeIds);
        setGames(restoredGames.length > 0 ? restoredGames : [createGameForm(restoredAttendees)]);
      } else {
        const initialAttendees = [...data.tournament.attendees];
        setAttendees(initialAttendees);
        setGames([createGameForm(initialAttendees)]);
        if (start && finish) {
          setMatchDate((prev) => clampDate(prev));
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "대회 정보 조회 중 오류가 발생했습니다.");
    }
  }, [tournamentId]);

  useEffect(() => {
    void loadTournament();
  }, [loadTournament]);

  useEffect(() => {
    if (!tournamentMeta?.attendees.length) return;
    setGames((prev) =>
      prev.map((game) => ({
        ...game,
        playersAll: tournamentMeta.attendees.filter((id) => game.playersAll.includes(id)),
      })),
    );
  }, [tournamentMeta]);

  useEffect(() => {
    if (!tournamentMeta) return;
    persistTournamentMatchDraft(tournamentDraftKey(tournamentId), {
      opponentName,
      matchDate,
      opponentLevel,
      matchFormatFutsal,
      stage,
      isPso,
      psoResult,
      attendees,
      games,
    });
  }, [
    tournamentId,
    tournamentMeta,
    opponentName,
    matchDate,
    opponentLevel,
    matchFormatFutsal,
    stage,
    isPso,
    psoResult,
    attendees,
    games,
  ]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      historyGuardPushedRef.current = false;
      return;
    }

    if (!historyGuardPushedRef.current) {
      window.history.pushState({ tournamentMatchFormGuard: true }, "", window.location.href);
      historyGuardPushedRef.current = true;
    }

    const onPopState = () => {
      if (allowLeaveRef.current) {
        allowLeaveRef.current = false;
        historyGuardPushedRef.current = false;
        return;
      }
      historyGuardPushedRef.current = false;
      leaveActionRef.current = "popstate";
      setLeaveConfirmOpen(true);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [hasUnsavedChanges]);

  const requestLeave = useCallback(() => {
    if (!hasUnsavedChanges) {
      onBack();
      return;
    }
    leaveActionRef.current = "ui";
    setLeaveConfirmOpen(true);
  }, [hasUnsavedChanges, onBack]);

  const confirmLeave = useCallback(() => {
    setLeaveConfirmOpen(false);
    const action = leaveActionRef.current;
    leaveActionRef.current = null;
    allowLeaveRef.current = true;
    historyGuardPushedRef.current = false;
    if (action === "popstate") {
      window.history.back();
      return;
    }
    onBack();
  }, [onBack]);

  const cancelLeave = useCallback(() => {
    setLeaveConfirmOpen(false);
    leaveActionRef.current = null;
    if (hasUnsavedChanges && !historyGuardPushedRef.current) {
      window.history.pushState({ tournamentMatchFormGuard: true }, "", window.location.href);
      historyGuardPushedRef.current = true;
    }
  }, [hasUnsavedChanges]);

  const toggleAttendee = (playerId: string) => {
    setAttendees((prev) => {
      const exists = prev.includes(playerId);
      const next = exists ? prev.filter((id) => id !== playerId) : [...prev, playerId];
      setGames((prevGames) =>
        prevGames.map((game) => ({
          ...game,
          playersAll: exists ? game.playersAll.filter((id) => id !== playerId) : [...new Set([...game.playersAll, playerId])],
          playersFw: game.playersFw.filter((id) => id !== playerId || !exists),
          playersMf: game.playersMf.filter((id) => id !== playerId || !exists),
          playersDf: game.playersDf.filter((id) => id !== playerId || !exists),
          playersGk: game.playersGk.filter((id) => id !== playerId || !exists),
        })),
      );
      return next;
    });
  };

  const addGame = () => {
    setGames((prev) => [...prev, createGameForm(attendees)]);
    setFormMessage("");
  };

  const removeGame = (gameId: string) => {
    setGames((prev) => prev.filter((game) => game.id !== gameId));
  };

  const updateGame = (gameId: string, updates: Partial<GameForm>) => {
    setGames((prev) => prev.map((game) => (game.id === gameId ? { ...game, ...updates } : game)));
  };

  const updateScoreUs = (gameId: string, rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, "");
    setGames((prev) =>
      prev.map((game) => {
        if (game.id !== gameId) return game;
        const prevScore = toInt(game.scoreUs) ?? 0;
        const nextScore = toInt(digitsOnly);
        let nextGoals = game.goals;
        if (nextScore !== null && nextScore > prevScore) {
          const toAdd = nextScore - game.goals.length;
          if (toAdd > 0) {
            nextGoals = [...game.goals, ...Array.from({ length: toAdd }, () => createGoalForm())];
          }
        }
        return { ...game, scoreUs: digitsOnly, goals: nextGoals };
      }),
    );
  };

  const updateScoreThem = (gameId: string, rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, "");
    updateGame(gameId, { scoreThem: digitsOnly });
  };

  const removeGoal = (gameId: string, goalId: string) => {
    setGames((prev) =>
      prev.map((game) => (game.id === gameId ? { ...game, goals: game.goals.filter((goal) => goal.id !== goalId) } : game)),
    );
  };

  const updateGoal = (gameId: string, goalId: string, updates: Partial<GoalForm>) => {
    setGames((prev) =>
      prev.map((game) =>
        game.id !== gameId
          ? game
          : {
              ...game,
              goals: game.goals.map((goal) => (goal.id === goalId ? { ...goal, ...updates } : goal)),
            },
      ),
    );
  };

  const moveSoccerPlayer = (gameId: string, playerId: string, position: "FW" | "MF" | "DF" | "GK") => {
    setGames((prev) =>
      prev.map((game) => {
        if (game.id !== gameId) return game;
        const strip = (list: string[]) => list.filter((id) => id !== playerId);
        const next = {
          playersFw: strip(game.playersFw),
          playersMf: strip(game.playersMf),
          playersDf: strip(game.playersDf),
          playersGk: strip(game.playersGk),
        };
        if (position === "FW") next.playersFw = [...next.playersFw, playerId];
        if (position === "MF") next.playersMf = [...next.playersMf, playerId];
        if (position === "DF") next.playersDf = [...next.playersDf, playerId];
        if (position === "GK") next.playersGk = [...next.playersGk, playerId];
        return { ...game, ...next };
      }),
    );
  };

  const removeSoccerPlayerFromPosition = (gameId: string, playerId: string) => {
    setGames((prev) =>
      prev.map((game) =>
        game.id !== gameId
          ? game
          : {
              ...game,
              playersFw: game.playersFw.filter((id) => id !== playerId),
              playersMf: game.playersMf.filter((id) => id !== playerId),
              playersDf: game.playersDf.filter((id) => id !== playerId),
              playersGk: game.playersGk.filter((id) => id !== playerId),
            },
      ),
    );
  };

  const validateBeforeSubmit = () => {
    if (!tournamentMeta?.startDate || !tournamentMeta.finishDate) return "대회 기간 정보가 없습니다.";
    if (!opponentName.trim()) return "상대팀 이름을 입력해주세요.";
    if (!matchDate) return "경기 날짜를 선택해주세요.";
    if (matchDate < tournamentMeta.startDate || matchDate > tournamentMeta.finishDate) {
      return "경기 날짜는 대회 기간 안에서만 선택할 수 있습니다.";
    }
    if (sportType === "FUTSAL" && !matchFormatFutsal) return "매치 포맷을 선택해주세요.";
    if (!stage) return "예선/본선 구분을 선택해주세요.";
    if (isPso && !psoResult) return "승부차기 결과를 선택해주세요.";
    if (attendees.length < 1) return "출석 선수는 최소 1명 이상 선택해주세요.";
    if (attendees.some((id) => !tournamentMeta.attendees.includes(id))) {
      return "출석 선수는 대회 참여 선수 목록 안에서만 선택할 수 있습니다.";
    }
    if (games.length < 1) return "경기 시트를 1개 이상 추가해주세요.";

    const totalScoreUs = games.reduce((sum, game) => sum + (toInt(game.scoreUs) ?? 0), 0);
    const totalScoreThem = games.reduce((sum, game) => sum + (toInt(game.scoreThem) ?? 0), 0);
    if (isPso && totalScoreUs !== totalScoreThem) {
      return "승부차기는 결과가 무승부일 때만 가능합니다";
    }

    for (let gameIdx = 0; gameIdx < games.length; gameIdx += 1) {
      const game = games[gameIdx];
      const scoreUs = toInt(game.scoreUs);
      const scoreThem = toInt(game.scoreThem);
      if (scoreUs === null || scoreThem === null) return `${gameIdx + 1}경기 스코어를 입력해주세요.`;
      if (scoreUs !== game.goals.length) return `${gameIdx + 1}경기: ${GOAL_COUNT_MISMATCH_MSG}`;

      if (sportType === "SOCCER") {
        const deployed = [...game.playersFw, ...game.playersMf, ...game.playersDf, ...game.playersGk];
        if (deployed.length < 1) return `${gameIdx + 1}경기에 최소 1명 이상 포지션 배치가 필요합니다.`;
      }

      for (let goalIdx = 0; goalIdx < game.goals.length; goalIdx += 1) {
        const goal = game.goals[goalIdx];
        if (goal.scorerType === "PLAYER" && !goal.scorerId) return `${gameIdx + 1}경기 ${goalIdx + 1}번째 득점자를 입력해주세요.`;
        if (goal.assisterType === "PLAYER" && !goal.assisterId) return `${gameIdx + 1}경기 ${goalIdx + 1}번째 도움자를 입력해주세요.`;
        if (goal.scorerType === "PLAYER" && goal.assisterType === "PLAYER" && goal.scorerId === goal.assisterId) {
          return `${gameIdx + 1}경기 ${goalIdx + 1}번째 득점자와 도움자는 같을 수 없습니다.`;
        }
      }
    }
    return "";
  };

  const handleRegisterClick = () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setFormIsError(true);
      setFormMessage(validationError);
      return;
    }
    setConfirmSubmitOpen(true);
  };

  const submitMatch = async () => {
    if (submitting) return;
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setFormIsError(true);
      setFormMessage(validationError);
      return;
    }

    setSubmitting(true);
    setFormIsError(false);
    setFormMessage("");

    try {
      const payload = {
        teamId,
        opponentName: opponentName.trim(),
        opponentLevel,
        matchFormatFutsal: sportType === "FUTSAL" ? matchFormatFutsal : null,
        date: matchDate,
        attendees,
        stage,
        isPso,
        psoResult: isPso ? psoResult : null,
        games: games.map((game) => ({
          scoreUs: Number(game.scoreUs),
          scoreThem: Number(game.scoreThem),
          playersAll: sportType === "FUTSAL" ? game.playersAll : [],
          playersFw: sportType === "SOCCER" ? game.playersFw : [],
          playersMf: sportType === "SOCCER" ? game.playersMf : [],
          playersDf: sportType === "SOCCER" ? game.playersDf : [],
          playersGk: sportType === "SOCCER" ? game.playersGk : [],
          goals: game.goals.map((goal) => ({
            scorerId: goal.scorerType === "PLAYER" ? goal.scorerId : null,
            scorerType: goal.scorerType,
            assisterId: goal.assisterType === "PLAYER" ? goal.assisterId : null,
            assisterType: goal.assisterType,
          })),
        })),
      };

      const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/match/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { matchId?: string; teamId?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? "매치 저장에 실패했습니다.");
      }

      if (data.matchId && data.teamId) {
        fetch(`/api/match/${data.matchId}/calculate-stats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: data.teamId }),
        }).catch(() => {});
      }

      clearDraft(tournamentDraftKey(tournamentId));
      onSaved();
    } catch (error) {
      setFormIsError(true);
      setFormMessage(error instanceof Error ? error.message : "매치 저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <p className="text-sm text-red-600">{loadError}</p>
        <button type="button" onClick={requestLeave} className="mt-4 rounded-lg border border-zinc-300 px-3 py-2 text-sm">
          돌아가기
        </button>
      </section>
    );
  }

  if (!tournamentMeta) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <p className="text-sm text-zinc-500">대회 정보를 불러오는 중...</p>
      </section>
    );
  }

  const dateMin = tournamentMeta.startDate || undefined;
  const dateMax = tournamentMeta.finishDate || undefined;
  const totalScoreUs = games.reduce((sum, game) => sum + (toInt(game.scoreUs) ?? 0), 0);
  const totalScoreThem = games.reduce((sum, game) => sum + (toInt(game.scoreThem) ?? 0), 0);
  const isPsoScoreInvalid = isPso && games.length > 0 && totalScoreUs !== totalScoreThem;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">대회 매치 기록</h2>
        <button type="button" onClick={requestLeave} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700">
          돌아가기
        </button>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">매치 시트</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              <span>예선 / 본선</span>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as TournamentStage)}
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-normal"
              >
                <option value="PRELIMINARY">예선</option>
                <option value="MAIN">본선</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              <span>상대팀 이름</span>
              <input
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                placeholder="필수 입력"
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              <span>경기 날짜</span>
              <input
                type="date"
                min={dateMin}
                max={dateMax}
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              <span>상대팀 수준</span>
              <select
                value={opponentLevel}
                onChange={(e) => setOpponentLevel(e.target.value as OpponentLevel)}
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-normal"
              >
                {OPPONENT_LEVEL_FORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {sportType === "FUTSAL" ? (
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                <span>매치 포맷</span>
                <select
                  value={matchFormatFutsal}
                  onChange={(e) => setMatchFormatFutsal(e.target.value as MatchFormatFutsal)}
                  className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-normal"
                >
                  <option value="FIVE_VS_FIVE">5vs5</option>
                  <option value="SIX_VS_SIX">6vs6</option>
                </select>
              </label>
            ) : null}
          </div>

          <div className="mt-4 rounded-md border border-zinc-200 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
              <input
                type="checkbox"
                checked={isPso}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsPso(checked);
                  if (!checked) setPsoResult(null);
                }}
              />
              승부차기 진행
            </label>
            {isPso ? (
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-700">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="pso" checked={psoResult === "WIN"} onChange={() => setPsoResult("WIN")} />
                  승부차기 승
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="pso" checked={psoResult === "LOSS"} onChange={() => setPsoResult("LOSS")} />
                  승부차기 패
                </label>
              </div>
            ) : null}
          </div>

          <p className="mb-2 mt-4 text-sm font-medium text-zinc-700">출석 선수 선택 (대회 참여 선수 기준)</p>
          <div className="flex flex-wrap gap-2">
            {tournamentMeta.attendees.map((playerId) => {
              const name = playerMap.get(playerId) ?? "알 수 없음";
              const selected = attendees.includes(playerId);
              return (
                <button
                  key={playerId}
                  type="button"
                  onClick={() => toggleAttendee(playerId)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addGame}
              className="rounded-full bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              경기 추가
            </button>
            <span className="text-sm text-zinc-600">(총 {games.length}경기)</span>
          </div>
        </div>

        {games.map((game, gameIndex) => {
          const assignedSoccer = new Set([...game.playersFw, ...game.playersMf, ...game.playersDf, ...game.playersGk]);
          const soccerLeftPlayers = attendeePlayers.filter((player) => !assignedSoccer.has(player.id));
          const gameNo = gameIndex + 1;
          const goalMismatch = isGoalCountMismatch(game);

          return (
            <div
              key={game.id}
              className={`rounded-lg p-4 ${goalMismatch ? "border-2 border-red-500 bg-red-50" : "border border-zinc-200"}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">{gameNo}경기</h3>
                <button type="button" onClick={() => removeGame(game.id)} className="text-sm text-red-600">
                  X
                </button>
              </div>

              {goalMismatch ? <p className="mb-3 text-sm font-medium text-red-600">{GOAL_COUNT_MISMATCH_MSG}</p> : null}

              <div className="mb-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">우리팀 득점</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={game.scoreUs}
                    onChange={(e) => updateScoreUs(game.id, e.target.value)}
                    placeholder="우리팀 득점"
                    className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">상대팀 득점</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={game.scoreThem}
                    onChange={(e) => updateScoreThem(game.id, e.target.value)}
                    placeholder="상대팀 득점"
                    className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
                  />
                </div>
              </div>

              {sportType === "FUTSAL" ? (
                <div className="mb-3">
                  <p className="mb-2 text-sm font-medium text-zinc-700">참여 선수</p>
                  <div className="flex flex-wrap gap-2">
                    {attendeePlayers.map((player) => {
                      const selected = game.playersAll.includes(player.id);
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() =>
                            updateGame(game.id, {
                              playersAll: selected
                                ? game.playersAll.filter((id) => id !== player.id)
                                : [...game.playersAll, player.id],
                            })
                          }
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"
                          }`}
                        >
                          {player.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_2fr]">
                  <div className="rounded-md border border-zinc-200 p-2">
                    <p className="mb-2 text-sm font-medium text-zinc-700">출석 선수</p>
                    <div className="flex flex-wrap gap-2">
                      {soccerLeftPlayers.map((player) => (
                        <div
                          key={player.id}
                          draggable
                          onDragStart={(event) => event.dataTransfer.setData("text/player-id", player.id)}
                          className="cursor-move select-none rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                          style={{ WebkitUserSelect: "none", touchAction: "none" }}
                        >
                          {player.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    {(["FW", "MF", "DF", "GK"] as const).map((position) => {
                      const list =
                        position === "FW"
                          ? game.playersFw
                          : position === "MF"
                            ? game.playersMf
                            : position === "DF"
                              ? game.playersDf
                              : game.playersGk;
                      return (
                        <div
                          key={position}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            const playerId = event.dataTransfer.getData("text/player-id");
                            if (!playerId || !attendees.includes(playerId)) return;
                            moveSoccerPlayer(game.id, playerId, position);
                          }}
                          className="min-h-20 rounded-md border border-zinc-300 p-2"
                        >
                          <p className="mb-2 text-sm font-medium text-zinc-800">{position}</p>
                          <div className="flex flex-wrap gap-2">
                            {list.map((playerId) => (
                              <span
                                key={playerId}
                                className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs"
                              >
                                {playerMap.get(playerId) ?? "알 수 없음"}
                                <button
                                  type="button"
                                  onClick={() => removeSoccerPlayerFromPosition(game.id, playerId)}
                                  className="text-red-600"
                                >
                                  X
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {game.goals.map((goal, goalIndex) => (
                  <div key={goal.id} className="rounded-md border border-zinc-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-800">골 {goalIndex + 1}</p>
                      <button type="button" onClick={() => removeGoal(game.id, goal.id)} className="text-sm text-red-600">
                        X
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 rounded-md bg-zinc-50 p-2">
                        <p className="text-xs font-semibold text-zinc-700">득점자</p>
                        <PlayerNameSuggestInput
                          value={goal.scorerQuery}
                          disabled={goal.scorerType !== "PLAYER"}
                          attendeePlayers={attendeePlayers}
                          placeholder="선수 이름 입력"
                          onCommit={(text, resolvedId) =>
                            updateGoal(game.id, goal.id, { scorerQuery: text, scorerId: resolvedId })
                          }
                        />
                        <div className="flex gap-3 text-xs text-zinc-700">
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={goal.scorerType === "MERCENARY"}
                              onChange={() => {
                                const checked = goal.scorerType !== "MERCENARY";
                                updateGoal(game.id, goal.id, {
                                  scorerType: checked ? "MERCENARY" : "PLAYER",
                                  scorerId: null,
                                  scorerQuery: "",
                                });
                              }}
                            />
                            용병
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={goal.scorerType === "OWN_GOAL"}
                              onChange={() => {
                                const checked = goal.scorerType !== "OWN_GOAL";
                                updateGoal(game.id, goal.id, {
                                  scorerType: checked ? "OWN_GOAL" : "PLAYER",
                                  scorerId: null,
                                  scorerQuery: "",
                                  assisterType: checked ? "NONE" : goal.assisterType,
                                  assisterId: checked ? null : goal.assisterId,
                                  assisterQuery: checked ? "" : goal.assisterQuery,
                                });
                              }}
                            />
                            자책골
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2 rounded-md bg-zinc-50 p-2">
                        <p className="text-xs font-semibold text-zinc-700">도움자</p>
                        <PlayerNameSuggestInput
                          value={goal.assisterQuery}
                          disabled={goal.assisterType !== "PLAYER" || goal.scorerType === "OWN_GOAL"}
                          attendeePlayers={attendeePlayers}
                          placeholder="선수 이름 입력"
                          onCommit={(text, resolvedId) =>
                            updateGoal(game.id, goal.id, { assisterQuery: text, assisterId: resolvedId })
                          }
                        />
                        <div className="flex gap-3 text-xs text-zinc-700">
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              disabled={goal.scorerType === "OWN_GOAL"}
                              checked={goal.assisterType === "MERCENARY"}
                              onChange={() => {
                                const checked = goal.assisterType !== "MERCENARY";
                                updateGoal(game.id, goal.id, {
                                  assisterType: checked ? "MERCENARY" : "PLAYER",
                                  assisterId: null,
                                  assisterQuery: "",
                                });
                              }}
                            />
                            용병도움
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={goal.assisterType === "NONE"}
                              onChange={() => {
                                const checked = goal.assisterType !== "NONE";
                                updateGoal(game.id, goal.id, {
                                  assisterType: checked ? "NONE" : "PLAYER",
                                  assisterId: null,
                                  assisterQuery: "",
                                });
                              }}
                            />
                            어시 없음
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {isPsoScoreInvalid ? (
          <p className="text-sm text-red-600">승부차기는 결과가 무승부일 때만 가능합니다</p>
        ) : null}
        {formMessage && formMessage !== "승부차기는 결과가 무승부일 때만 가능합니다" ? (
          <p className={`text-sm ${formIsError ? "text-red-600" : "text-emerald-600"}`}>{formMessage}</p>
        ) : null}

        <button
          type="button"
          onClick={handleRegisterClick}
          className="h-11 w-full rounded-full bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          {submitting ? "등록 중..." : "등록 완료"}
        </button>
      </div>

      {confirmSubmitOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tournament-match-confirm-title"
          onClick={() => setConfirmSubmitOpen(false)}
        >
          <div
            className="max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="tournament-match-confirm-title" className="mb-3 text-sm font-semibold text-zinc-900">
              매치 등록
            </h3>
            <p className="text-sm leading-relaxed text-zinc-700">
              매치를 등록하시겠습니까? 등록 후에는 수정할 수 없으며, 잘못 입력한 경우 삭제 후 다시 입력해야 합니다.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                className="h-10 flex-1 rounded-full border border-zinc-300 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmSubmitOpen(false);
                  void submitMatch();
                }}
                className="h-10 flex-1 rounded-full bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={leaveConfirmOpen}
        title="나가시겠습니까?"
        message="저장되지 않은 기록이 있습니다. 나가시겠습니까?"
        confirmLabel="나가기"
        cancelLabel="취소"
        confirmVariant="primary"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </section>
  );
}
