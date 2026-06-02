"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SportType = "FUTSAL" | "SOCCER";
type OpponentLevel = "TOP" | "HIGH" | "MID" | "LOW";
type RecordType = "PLAYER" | "MERCENARY" | "OWN_GOAL" | "NONE";
type MatchFormatFutsal = "FIVE_VS_FIVE" | "SIX_VS_SIX";

type PlayerLite = {
  id: string;
  name: string;
};

type MatchListItem = {
  id: string;
  opponent_name: string;
  opponent_level: OpponentLevel;
  date: string;
  total_score_us: number;
  total_score_them: number;
  total_result: "WIN" | "DRAW" | "LOSS";
  count_win: number;
  count_draw: number;
  count_loss: number;
  match_format_futsal: MatchFormatFutsal | null;
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

type MatchManagerTabProps = {
  teamId: string;
  sportType: SportType;
  players: PlayerLite[];
};

/** 일반 매치 폼: DB에는 HIGH/MID/LOW 영문 그대로 저장, 표시만 한글 */
const OPPONENT_LEVEL_FORM_OPTIONS: Array<{ value: "HIGH" | "MID" | "LOW"; label: string }> = [
  { value: "HIGH", label: "상" },
  { value: "MID", label: "중" },
  { value: "LOW", label: "하" },
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

function levelLabel(level: OpponentLevel) {
  if (level === "TOP") return "최상";
  if (level === "HIGH") return "상";
  if (level === "MID") return "중";
  return "하";
}

function resultLabel(result: MatchListItem["total_result"]) {
  if (result === "WIN") return "승";
  if (result === "DRAW") return "무";
  return "패";
}

function resultAccentClass(result: MatchListItem["total_result"]) {
  if (result === "WIN") return "text-emerald-600 font-bold text-lg";
  if (result === "DRAW") return "text-zinc-500 font-bold text-lg";
  return "text-red-600 font-bold text-lg";
}

function futsalFormatLabel(format: MatchFormatFutsal | null) {
  if (format === "FIVE_VS_FIVE") return "5vs5";
  if (format === "SIX_VS_SIX") return "6vs6";
  return "-";
}

const GOAL_COUNT_MISMATCH_MSG = "우리팀 득점 수와 골 기록 수가 일치하지 않습니다.";

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const ignoreNextChangeRef = useRef(false);
  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) return [];
    return attendeePlayers.filter((p) => p.name.includes(q));
  }, [value, attendeePlayers]);

  const selectSuggestion = (player: AttendeeOption) => {
    onCommit(player.name, player.id);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || disabled || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const index = activeIndex >= 0 ? activeIndex : 0;
      const selected = suggestions[index];
      if (selected) {
        ignoreNextChangeRef.current = true;
        selectSuggestion(selected);
      }
    }
  };

  return (
    <div className="relative">
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setActiveIndex(suggestions.length > 0 ? 0 : -1);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            setActiveIndex(-1);
          }, 120);
        }}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          if (ignoreNextChangeRef.current) {
            ignoreNextChangeRef.current = false;
            return;
          }
          const text = e.target.value;
          const resolved =
            text.trim() && attendeePlayers.some((p) => p.name === text.trim())
              ? attendeePlayers.find((p) => p.name === text.trim())!.id
              : null;
          onCommit(text, resolved);
          setActiveIndex(0);
        }}
        className="h-9 w-full rounded border border-zinc-300 px-2 text-sm disabled:bg-zinc-100"
        autoComplete="off"
      />
      {open && !disabled && suggestions.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-md">
          {suggestions.map((p, index) => (
            <li key={p.id}>
              <button
                type="button"
                className={`w-full px-2 py-1.5 text-left ${
                  index === activeIndex ? "bg-zinc-100" : "hover:bg-zinc-100"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectSuggestion(p)}
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

function toInt(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function MatchManagerTab({ teamId, sportType, players }: MatchManagerTabProps) {
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [view, setView] = useState<"LIST" | "FORM">("LIST");
  const [submitting, setSubmitting] = useState(false);

  const [opponentName, setOpponentName] = useState("");
  const [matchDate, setMatchDate] = useState(todayIso());
  const [opponentLevel, setOpponentLevel] = useState<OpponentLevel>("MID");
  const [matchFormatFutsal, setMatchFormatFutsal] = useState<MatchFormatFutsal>("FIVE_VS_FIVE");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [games, setGames] = useState<GameForm[]>([]);
  const [formMessage, setFormMessage] = useState("");
  const [formIsError, setFormIsError] = useState(false);

  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player.name])), [players]);

  const attendeePlayers = useMemo(
    () => attendees.map((id) => ({ id, name: playerMap.get(id) ?? "알 수 없는 선수" })),
    [attendees, playerMap],
  );

  const [matchInfoOpen, setMatchInfoOpen] = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/match/list?teamId=${encodeURIComponent(teamId)}`);
      const data = (await res.json()) as { matches?: MatchListItem[]; message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? "매치 목록 조회에 실패했습니다.");
      }
      setMatches(data.matches ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "매치 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void fetchMatches();
  }, [fetchMatches]);

  const resetForm = () => {
    setOpponentName("");
    setMatchDate(todayIso());
    setOpponentLevel("MID");
    setMatchFormatFutsal("FIVE_VS_FIVE");
    setAttendees([]);
    setGames([]);
    setFormMessage("");
    setFormIsError(false);
  };

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

  const addGoal = (gameId: string) => {
    setGames((prev) =>
      prev.map((game) => (game.id === gameId ? { ...game, goals: [...game.goals, createGoalForm()] } : game)),
    );
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
    if (!opponentName.trim()) return "상대팀 이름을 입력해주세요.";
    if (!matchDate) return "경기 날짜를 선택해주세요.";
    if (sportType === "FUTSAL" && !matchFormatFutsal) return "매치 유형을 선택해주세요.";
    if (attendees.length < 1) return "출석 선수는 최소 1명 이상 선택해주세요.";
    if (games.length < 1) return "경기 시트를 1개 이상 추가해주세요.";

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

      const res = await fetch("/api/match/create", {
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

      resetForm();
      setView("LIST");
      await fetchMatches();
    } catch (error) {
      setFormIsError(true);
      setFormMessage(error instanceof Error ? error.message : "매치 저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMatch = async (matchId: string) => {
    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/match/${matchId}`, { method: "DELETE" });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? "매치 삭제에 실패했습니다.");
      }
      setMatches((prev) => prev.filter((item) => item.id !== matchId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "매치 삭제 중 오류가 발생했습니다.");
    }
  };

  if (view === "LIST") {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">매칭관리</h2>
            <button
              type="button"
              aria-label="매칭관리 안내"
              onClick={() => setMatchInfoOpen(true)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
            >
              ?
            </button>
          </div>
          <button
            type="button"
            onClick={() => setView("FORM")}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
          >
            매치 기록
          </button>
        </div>

        {errorMessage ? <p className="mb-3 text-sm text-red-600">{errorMessage}</p> : null}
        {loading ? <p className="text-sm text-zinc-500">불러오는 중...</p> : null}

        <div className="max-h-[70vh] overflow-y-auto pr-1">
          {!loading && matches.length === 0 ? <p className="text-sm text-zinc-500">등록된 매치가 없습니다.</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map((match) => (
              <article key={match.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900">VS {match.opponent_name}</p>
                    <button
                      type="button"
                      onClick={() => void deleteMatch(match.id)}
                      className="shrink-0 rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                  <p className={resultAccentClass(match.total_result)}>{resultLabel(match.total_result)}</p>
                  <div className="space-y-0.5 text-xs text-zinc-600">
                    <p>매치 날짜: {new Date(match.date).toLocaleDateString("ko-KR")}</p>
                    <p>상대팀 수준: {levelLabel(match.opponent_level)}</p>
                    {sportType === "FUTSAL" ? <p>매치 유형: {futsalFormatLabel(match.match_format_futsal)}</p> : null}
                    <p>
                      스코어: {match.total_score_us} : {match.total_score_them}
                    </p>
                    <p>
                      종합 승무패: {match.count_win}승 {match.count_draw}무 {match.count_loss}패
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {matchInfoOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-info-title"
            onClick={() => setMatchInfoOpen(false)}
          >
            <div
              className="max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="match-info-title" className="mb-3 text-sm font-semibold text-zinc-900">
                안내
              </h3>
              <p className="text-sm leading-relaxed text-zinc-700">
                경기 기록 계산 때문에 수정이 불가능합니다. 잘못 입력했을 경우, 삭제 후 다시 입력해주세요.
              </p>
              <button
                type="button"
                onClick={() => setMatchInfoOpen(false)}
                className="mt-4 h-10 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white"
              >
                확인
              </button>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">매치 기록</h2>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setView("LIST");
          }}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
        >
          목록으로
        </button>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">매치 시트</h3>
          <p className="mb-3 text-xs leading-relaxed text-zinc-600">
            아래 항목을 채운 뒤 출석 선수를 선택하고 경기 시트를 추가하세요. 저장 값은 서버에 영문 코드로 기록됩니다.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
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
                <span>매치 유형</span>
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

          <p className="mb-2 mt-4 text-sm font-medium text-zinc-700">출석 선수 선택</p>
          <div className="flex flex-wrap gap-2">
            {players.map((player) => {
              const selected = attendees.includes(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => toggleAttendee(player.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"
                  }`}
                >
                  {player.name}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addGame}
            className="mt-4 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            경기 추가
          </button>
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
                <input
                  type="text"
                  inputMode="numeric"
                  value={game.scoreUs}
                  onChange={(e) => updateGame(game.id, { scoreUs: e.target.value })}
                  placeholder="우리팀 득점"
                  className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={game.scoreThem}
                  onChange={(e) => updateGame(game.id, { scoreThem: e.target.value })}
                  placeholder="상대팀 득점"
                  className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
                />
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
                          className={`rounded-md border px-3 py-1.5 text-sm ${
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
                          className="cursor-move rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
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

              <button
                type="button"
                onClick={() => addGoal(game.id)}
                className="mb-3 rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700"
              >
                골 기록 추가
              </button>

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

        {formMessage ? <p className={`text-sm ${formIsError ? "text-red-600" : "text-emerald-600"}`}>{formMessage}</p> : null}

        <button
          type="button"
          onClick={() => void submitMatch()}
          className="h-11 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white"
        >
          {submitting ? "등록 중..." : "등록 완료"}
        </button>
      </div>
    </section>
  );
}
