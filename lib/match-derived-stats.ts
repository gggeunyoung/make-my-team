import type { Prisma } from "@/app/generated/prisma/client";
import type {
  MatchFormatFutsal,
  MatchResult,
  OpponentLevel,
  PlayerStyle,
  Position,
  PsoResult,
  RecordType,
} from "@/app/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

export type MatchDerivedGoalEvent = {
  id: string;
  createdAt: Date;
  scorer_id: string | null;
  scorer_type: RecordType;
  assister_id: string | null;
  assister_type: RecordType;
};

export type MatchDerivedGame = {
  score_us: number;
  score_them: number;
  result: MatchResult;
  players_all: string[];
  players_fw: string[];
  players_mf: string[];
  players_df: string[];
  players_gk: string[];
  goal_events: MatchDerivedGoalEvent[];
};

export type MatchDerivedPlayer = {
  id: string;
  name: string;
  style: PlayerStyle;
};

export type MatchDerivedMatchContext = {
  is_tournament: boolean;
  opponent_level: OpponentLevel;
  date: Date;
  stage: "PRELIMINARY" | "MAIN" | null;
  match_format_futsal: MatchFormatFutsal | null;
  is_pso?: boolean;
  pso_result?: PsoResult | null;
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function clampScoreThem(isFutsal: boolean, scoreThem: number): number {
  return isFutsal ? Math.min(scoreThem, 4) : Math.min(scoreThem, 3);
}

function resultMultGeneral(result: MatchResult): number {
  if (result === "WIN") return 1.3;
  if (result === "DRAW") return 1.0;
  return 0.7;
}

function resultMultTournamentPrelim(result: MatchResult): number {
  if (result === "WIN") return 1.6;
  if (result === "DRAW") return 1.0;
  return 0.6;
}

function resultMultTournamentMain(
  result: MatchResult,
  pso?: { isPso: boolean; psoResult: PsoResult | null | undefined },
): number {
  if (result === "DRAW" && pso?.isPso) {
    if (pso.psoResult === "WIN") return 1.8;
    if (pso.psoResult === "LOSS") return 0.55;
  }
  if (result === "WIN") return 1.8;
  if (result === "LOSS") return 0.55;
  return 1.0;
}

function getDecisivePlayerId(
  events: MatchDerivedGoalEvent[],
  scoreUs: number,
  gameResult: MatchResult,
  isTournament: boolean,
): string | null {
  if (!isTournament || gameResult !== "WIN") return null;
  const sorted = [...events].sort((a, b) => {
    const dt = a.createdAt.getTime() - b.createdAt.getTime();
    if (dt !== 0) return dt;
    return a.id.localeCompare(b.id);
  });
  const idx = scoreUs - 1;
  if (idx < 0 || idx >= sorted.length) return null;
  const g = sorted[idx]!;
  if (g.scorer_type !== "PLAYER" || !g.scorer_id) return null;
  return g.scorer_id;
}

function snapshotPositionForSoccer(
  playerId: string,
  g: MatchDerivedGame,
): Position | null {
  if (g.players_fw.includes(playerId)) return "FW";
  if (g.players_mf.includes(playerId)) return "MF";
  if (g.players_df.includes(playerId)) return "DF";
  if (g.players_gk.includes(playerId)) return "GK";
  return null;
}

function styleMultDefense55(style: PlayerStyle): number {
  if (style === "OFFENSIVE") return 0.5;
  if (style === "BALANCED") return 0.75;
  if (style === "DEFENSIVE") return 1.0;
  return 0.75;
}

function styleMultDefense66(style: PlayerStyle): number {
  if (style === "OFFENSIVE") return 0.25;
  if (style === "BALANCED") return 0.5;
  if (style === "DEFENSIVE") return 1.0;
  return 0.5;
}

function styleMultDefenseSoccerField(style: PlayerStyle): number {
  if (style === "OFFENSIVE") return 0.9;
  if (style === "BALANCED") return 0.95;
  if (style === "DEFENSIVE") return 1.0;
  return 0.95;
}

function positionMultSoccerField(pos: Position | null): number {
  if (pos === "FW") return 0.3;
  if (pos === "MF") return 0.6;
  if (pos === "DF") return 1.0;
  if (pos === "GK") return 0.6;
  return 0.6;
}

function gkWeightByOpponent(opponentLevel: OpponentLevel): number {
  if (opponentLevel === "HIGH" || opponentLevel === "TOP") return 0.8;
  if (opponentLevel === "MID") return 0.65;
  return 0.5;
}

function oppHighMidLowGeneralDefense(level: OpponentLevel): number {
  if (level === "HIGH" || level === "TOP") return 1.5;
  if (level === "MID") return 1.2;
  return 1.0;
}

function oppTopHighMidPrelimDefense(level: OpponentLevel): number {
  if (level === "TOP") return 1.65;
  if (level === "HIGH") return 1.5;
  if (level === "MID") return 1.2;
  return 1.0;
}

function oppTopHighMidMainDefense(level: OpponentLevel): number {
  if (level === "TOP") return 1.7;
  if (level === "HIGH") return 1.5;
  if (level === "MID") return 1.2;
  return 1.0;
}

function oppHighMidLowFutsalGeneralAttack(level: OpponentLevel): number {
  if (level === "HIGH" || level === "TOP") return 1.3;
  if (level === "MID") return 1.0;
  return 0.8;
}

function oppTopHighMidFutsalPrelimAttack(level: OpponentLevel): number {
  if (level === "TOP") return 1.5;
  if (level === "HIGH") return 1.3;
  if (level === "MID") return 1.0;
  return 0.8;
}

function oppTopHighMidFutsalMainAttack(level: OpponentLevel): number {
  if (level === "TOP") return 1.6;
  if (level === "HIGH") return 1.35;
  if (level === "MID") return 1.0;
  return 0.85;
}

function oppHighMidLowSoccerGeneralAttack(level: OpponentLevel): number {
  if (level === "HIGH" || level === "TOP") return 1.5;
  if (level === "MID") return 1.3;
  return 1.0;
}

function oppTopHighMidSoccerPrelimAttack(level: OpponentLevel): number {
  if (level === "TOP") return 1.75;
  if (level === "HIGH") return 1.55;
  if (level === "MID") return 1.3;
  return 1.0;
}

function oppTopHighMidSoccerMainAttack(level: OpponentLevel): number {
  if (level === "TOP") return 2.0;
  if (level === "HIGH") return 1.7;
  if (level === "MID") return 1.35;
  return 1.05;
}

function computePerfAttack(params: {
  isFutsal: boolean;
  isSoccer: boolean;
  isTournament: boolean;
  isPreliminary: boolean;
  isMain: boolean;
  goals: number;
  assist: number;
  isDecisiveGoal: boolean;
  gameResult: MatchResult;
  opponentLevel: OpponentLevel;
  isPso: boolean;
  psoResult: PsoResult | null | undefined;
}): number {
  const {
    isFutsal,
    isSoccer,
    isTournament,
    isPreliminary,
    isMain,
    goals,
    assist,
    isDecisiveGoal,
    gameResult,
    opponentLevel,
    isPso,
    psoResult,
  } = params;
  const mainPso = { isPso, psoResult };
  if (goals === 0 && assist === 0) return 0;

  const dec = isDecisiveGoal ? 1 : 0;

  if (isFutsal && !isTournament) {
    return (goals * 4 + assist * 3) * resultMultGeneral(gameResult) * oppHighMidLowFutsalGeneralAttack(opponentLevel);
  }
  if (isFutsal && isTournament && isPreliminary) {
    return (
      (goals * 5 + assist * 4 + dec) *
      resultMultTournamentPrelim(gameResult) *
      oppTopHighMidFutsalPrelimAttack(opponentLevel)
    );
  }
  if (isFutsal && isTournament && isMain) {
    return (
      (goals * 6 + assist * 4 + dec) *
      resultMultTournamentMain(gameResult, mainPso) *
      oppTopHighMidFutsalMainAttack(opponentLevel)
    );
  }
  if (isSoccer && !isTournament) {
    return (goals * 6 + assist * 4) * resultMultGeneral(gameResult) * oppHighMidLowSoccerGeneralAttack(opponentLevel);
  }
  if (isSoccer && isTournament && isPreliminary) {
    return (
      (goals * 7 + assist * 5 + dec) *
      resultMultTournamentPrelim(gameResult) *
      oppTopHighMidSoccerPrelimAttack(opponentLevel)
    );
  }
  if (isSoccer && isTournament && isMain) {
    return (
      (goals * 8 + assist * 5 + dec) *
      resultMultTournamentMain(gameResult, mainPso) *
      oppTopHighMidSoccerMainAttack(opponentLevel)
    );
  }
  return 0;
}

function computePerfDefense(params: {
  isFutsal: boolean;
  isSoccer: boolean;
  is5vs5: boolean;
  is6vs6: boolean;
  isTournament: boolean;
  isPreliminary: boolean;
  isMain: boolean;
  isGoalkeeper: boolean;
  gameResult: MatchResult;
  opponentLevel: OpponentLevel;
  scoreThemClamped: number;
  isCleanSheetGame: boolean;
  playerStyle: PlayerStyle;
  snapshotPosition: Position | null;
  isPso: boolean;
  psoResult: PsoResult | null | undefined;
}): number {
  const {
    isFutsal,
    isSoccer,
    is5vs5,
    is6vs6,
    isTournament,
    isPreliminary,
    isMain,
    isGoalkeeper,
    gameResult,
    opponentLevel,
    scoreThemClamped,
    isCleanSheetGame,
    playerStyle,
    snapshotPosition,
    isPso,
    psoResult,
  } = params;

  const cs = isCleanSheetGame ? 1 : 0;
  const mainPso = { isPso, psoResult };

  if (isFutsal && is5vs5 && isGoalkeeper) {
    if (!isTournament) {
      return (
        (4 - scoreThemClamped * 0.5) *
        resultMultGeneral(gameResult) *
        oppHighMidLowGeneralDefense(opponentLevel) *
        gkWeightByOpponent(opponentLevel)
      );
    }
    if (isPreliminary) {
      return (
        (4.5 - scoreThemClamped * 0.6 + cs) *
        resultMultTournamentPrelim(gameResult) *
        oppTopHighMidPrelimDefense(opponentLevel) *
        1.2
      );
    }
    if (isMain) {
      return (
        (5 - scoreThemClamped * 0.7 + cs) *
        resultMultTournamentMain(gameResult, mainPso) *
        oppTopHighMidMainDefense(opponentLevel) *
        1.2
      );
    }
  }

  if (isFutsal && is5vs5 && !isGoalkeeper) {
    const sm = styleMultDefense55(playerStyle);
    if (!isTournament) {
      return (4 - scoreThemClamped * 0.5) * resultMultGeneral(gameResult) * oppHighMidLowGeneralDefense(opponentLevel) * sm;
    }
    if (isPreliminary) {
      return (
        (4.5 - scoreThemClamped * 0.6) *
        resultMultTournamentPrelim(gameResult) *
        oppTopHighMidPrelimDefense(opponentLevel) *
        sm
      );
    }
    if (isMain) {
      return (
        (5 - scoreThemClamped * 0.7) * resultMultTournamentMain(gameResult, mainPso) * oppTopHighMidMainDefense(opponentLevel) * sm
      );
    }
  }

  if (isFutsal && is6vs6 && isGoalkeeper) {
    if (!isTournament) {
      return (4 - scoreThemClamped * 0.5) * resultMultGeneral(gameResult) * oppHighMidLowGeneralDefense(opponentLevel) * 0.5;
    }
    if (isPreliminary) {
      return (
        (4.5 - scoreThemClamped * 0.6 + cs) *
        resultMultTournamentPrelim(gameResult) *
        oppTopHighMidPrelimDefense(opponentLevel) *
        1.2
      );
    }
    if (isMain) {
      return (
        (5 - scoreThemClamped * 0.7 + cs) *
        resultMultTournamentMain(gameResult, mainPso) *
        oppTopHighMidMainDefense(opponentLevel) *
        1.2
      );
    }
  }

  if (isFutsal && is6vs6 && !isGoalkeeper) {
    const sm = styleMultDefense66(playerStyle);
    if (!isTournament) {
      return (4 - scoreThemClamped * 0.5) * resultMultGeneral(gameResult) * oppHighMidLowGeneralDefense(opponentLevel) * sm;
    }
    if (isPreliminary) {
      return (
        (4.5 - scoreThemClamped * 0.6) *
        resultMultTournamentPrelim(gameResult) *
        oppTopHighMidPrelimDefense(opponentLevel) *
        sm
      );
    }
    if (isMain) {
      return (
        (5 - scoreThemClamped * 0.7) * resultMultTournamentMain(gameResult, mainPso) * oppTopHighMidMainDefense(opponentLevel) * sm
      );
    }
  }

  if (isSoccer && isGoalkeeper) {
    if (!isTournament) {
      return (
        (4 - scoreThemClamped * 0.8) *
        resultMultGeneral(gameResult) *
        oppHighMidLowGeneralDefense(opponentLevel) *
        gkWeightByOpponent(opponentLevel)
      );
    }
    if (isPreliminary) {
      return (
        (4.5 - scoreThemClamped * 0.9 + cs) *
        resultMultTournamentPrelim(gameResult) *
        oppTopHighMidPrelimDefense(opponentLevel) *
        1.2
      );
    }
    if (isMain) {
      return (
        (5 - scoreThemClamped * 1.0 + cs) *
        resultMultTournamentMain(gameResult, mainPso) *
        oppTopHighMidMainDefense(opponentLevel) *
        1.2
      );
    }
  }

  if (isSoccer && !isGoalkeeper) {
    const sm = styleMultDefenseSoccerField(playerStyle);
    const pm = positionMultSoccerField(snapshotPosition);
    if (!isTournament) {
      return (4 - scoreThemClamped * 0.8) * resultMultGeneral(gameResult) * oppHighMidLowGeneralDefense(opponentLevel) * sm * pm;
    }
    if (isPreliminary) {
      return (
        (4.5 - scoreThemClamped * 0.9) *
        resultMultTournamentPrelim(gameResult) *
        oppTopHighMidPrelimDefense(opponentLevel) *
        sm *
        pm
      );
    }
    if (isMain) {
      return (
        (5 - scoreThemClamped * 1.0) * resultMultTournamentMain(gameResult, mainPso) * oppTopHighMidMainDefense(opponentLevel) * sm * pm
      );
    }
  }

  return 0;
}

function newStatId(): string {
  return crypto.randomUUID();
}

/**
 * 매치·게임·골 이벤트 저장 이후, 동일 트랜잭션 안에서 Player_Stat / Duo_Stat / Match.mom 을 반영합니다.
 */
export async function persistMatchDerivedStats(
  tx: Tx,
  args: {
    matchId: string;
    teamId: string;
    attendees: string[];
    players: MatchDerivedPlayer[];
    sportType: "FUTSAL" | "SOCCER";
    match: MatchDerivedMatchContext;
    games: MatchDerivedGame[];
  },
): Promise<void> {
  const { matchId, teamId, attendees, players, sportType, match, games } = args;

  const isFutsal = sportType === "FUTSAL";
  const isSoccer = sportType === "SOCCER";
  const format = match.match_format_futsal ?? "FIVE_VS_FIVE";
  const is6vs6 = isFutsal && format === "SIX_VS_SIX";
  const is5vs5 = isFutsal && !is6vs6;

  const isTournament = match.is_tournament;
  const isPreliminary = match.stage === "PRELIMINARY";
  const isMain = match.stage === "MAIN";
  const isPso = match.is_pso ?? false;
  const psoResult = match.pso_result ?? null;

  const playerById = new Map(players.map((p) => [p.id, p]));

  type Acc = {
    goals: number;
    assist: number;
    perfAttackSum: number;
    perfDefenseSum: number;
    isCleanSheet: boolean;
    snapshotPosition: Position | null;
  };

  const accByPlayer = new Map<string, Acc>();
  for (const pid of attendees) {
    accByPlayer.set(pid, {
      goals: 0,
      assist: 0,
      perfAttackSum: 0,
      perfDefenseSum: 0,
      isCleanSheet: false,
      snapshotPosition: null,
    });
  }

  for (const g of games) {
    const scoreThemRaw = g.score_them;
    const scoreThemClamped = clampScoreThem(isFutsal, scoreThemRaw);
    const decisiveId = getDecisivePlayerId(g.goal_events, g.score_us, g.result, isTournament);

    for (const playerId of attendees) {
      const acc = accByPlayer.get(playerId)!;
      const p = playerById.get(playerId);
      if (!p) continue;

      const inGame = g.players_all.includes(playerId);
      if (!inGame) continue;

      let goals = 0;
      let assist = 0;
      for (const ev of g.goal_events) {
        if (ev.scorer_type === "PLAYER" && ev.scorer_id === playerId) goals += 1;
        if (ev.assister_type === "PLAYER" && ev.assister_id === playerId) assist += 1;
      }
      acc.goals += goals;
      acc.assist += assist;

      const snap = isSoccer ? snapshotPositionForSoccer(playerId, g) : null;
      if (snap) acc.snapshotPosition = snap;

      const isGoalkeeper = isFutsal ? p.style === "GOALKEEPER" : snap === "GK";
      const isCleanSheetGame = isGoalkeeper && isTournament && scoreThemRaw === 0;
      if (isCleanSheetGame) acc.isCleanSheet = true;

      const isDecisiveGoal = decisiveId !== null && decisiveId === playerId;

      const perfA = computePerfAttack({
        isFutsal,
        isSoccer,
        isTournament,
        isPreliminary,
        isMain,
        goals,
        assist,
        isDecisiveGoal,
        gameResult: g.result,
        opponentLevel: match.opponent_level,
        isPso,
        psoResult,
      });

      const perfD = computePerfDefense({
        isFutsal,
        isSoccer,
        is5vs5,
        is6vs6,
        isTournament,
        isPreliminary,
        isMain,
        isGoalkeeper,
        gameResult: g.result,
        opponentLevel: match.opponent_level,
        scoreThemClamped,
        isCleanSheetGame,
        playerStyle: p.style,
        snapshotPosition: snap,
        isPso,
        psoResult,
      });

      acc.perfAttackSum += perfA;
      acc.perfDefenseSum += perfD;
    }
  }

  const perfTotals = new Map<string, number>();
  const createRows: Prisma.Player_StatCreateManyInput[] = [];

  for (const playerId of attendees) {
    const acc = accByPlayer.get(playerId)!;
    const attackPoint = acc.goals + acc.assist;
    const perfAttack = round4(acc.perfAttackSum);
    const perfDefense = round4(acc.perfDefenseSum);
    const perfTotal = round4(perfAttack * 0.6 + perfDefense * 0.4);
    perfTotals.set(playerId, perfTotal);

    createRows.push({
      id: newStatId(),
      playerId,
      matchId,
      teamId,
      goals: acc.goals,
      assist: acc.assist,
      attack_point: attackPoint,
      perf_attack: perfAttack,
      perf_defense: perfDefense,
      perf_total: perfTotal,
      is_clean_sheet: acc.isCleanSheet,
      is_mom: false,
      is_tournament: isTournament,
      match_date: match.date,
      opponent_level: match.opponent_level,
      snapshot_position: isSoccer ? acc.snapshotPosition : null,
    });
  }

  await tx.player_Stat.createMany({ data: createRows });

  const nameById = new Map(players.map((p) => [p.id, p.name]));
  const allEvents = games.flatMap((g) => g.goal_events);
  for (const ev of allEvents) {
    if (ev.scorer_type !== "PLAYER" || ev.assister_type !== "PLAYER") continue;
    const sid = ev.scorer_id;
    const aid = ev.assister_id;
    if (!sid || !aid) continue;
    const na = nameById.get(sid) ?? "";
    const nb = nameById.get(aid) ?? "";
    const cmp = na.localeCompare(nb, "ko");
    const playerAId = cmp <= 0 ? sid : aid;
    const playerBId = cmp <= 0 ? aid : sid;

    await tx.duo_Stat.upsert({
      where: {
        playerAId_playerBId_teamId: { playerAId, playerBId, teamId },
      },
      create: {
        id: newStatId(),
        playerAId,
        playerBId,
        teamId,
        joint_goals: 1,
      },
      update: {
        joint_goals: { increment: 1 },
      },
    });
  }

  let momId: string | null = null;
  let bestTotal = -Infinity;
  for (const playerId of attendees) {
    const t = perfTotals.get(playerId) ?? 0;
    if (t > bestTotal || (t === bestTotal && (momId === null || playerId > momId))) {
      bestTotal = t;
      momId = playerId;
    }
  }

  await tx.match.update({
    where: { id: matchId },
    data: { mom: momId },
  });

  if (momId) {
    await tx.player_Stat.updateMany({
      where: { matchId, playerId: momId },
      data: { is_mom: true },
    });
  }
}
