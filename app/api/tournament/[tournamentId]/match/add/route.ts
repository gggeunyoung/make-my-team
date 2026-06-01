import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type OpponentLevel = "TOP" | "HIGH" | "MID" | "LOW";
type MatchResult = "WIN" | "DRAW" | "LOSS";
type RecordType = "PLAYER" | "MERCENARY" | "OWN_GOAL" | "NONE";
type TournamentStage = "PRELIMINARY" | "MAIN";
type MatchFormatFutsal = "FIVE_VS_FIVE" | "SIX_VS_SIX";

type GoalInput = {
  scorerId?: string | null;
  scorerType?: RecordType;
  assisterId?: string | null;
  assisterType?: RecordType;
};

type GameInput = {
  scoreUs?: number;
  scoreThem?: number;
  playersAll?: string[];
  playersFw?: string[];
  playersMf?: string[];
  playersDf?: string[];
  playersGk?: string[];
  goals?: GoalInput[];
};

type Body = {
  teamId?: string;
  opponentName?: string;
  opponentLevel?: OpponentLevel;
  matchFormatFutsal?: MatchFormatFutsal | null;
  date?: string;
  attendees?: string[];
  games?: GameInput[];
  stage?: TournamentStage;
  isPso?: boolean;
  psoResult?: "WIN" | "LOSS" | null;
};

const TOURNAMENT_OPPONENT_LEVELS = new Set<OpponentLevel>(["TOP", "HIGH", "MID"]);
const RECORD_TYPES = new Set<RecordType>(["PLAYER", "MERCENARY", "OWN_GOAL", "NONE"]);
const STAGES = new Set<TournamentStage>(["PRELIMINARY", "MAIN"]);
const FUTSAL_MATCH_FORMATS = new Set<MatchFormatFutsal>(["FIVE_VS_FIVE", "SIX_VS_SIX"]);

function calcResult(us: number, them: number): MatchResult {
  if (us > them) return "WIN";
  if (us < them) return "LOSS";
  return "DRAW";
}

function isNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function dedupe(values: string[] | undefined) {
  return [...new Set((values ?? []).filter((v) => Boolean(v?.trim())).map((v) => v.trim()))];
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

type RouteContext = {
  params: Promise<{ tournamentId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { tournamentId } = await context.params;

  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { team: true },
  });

  if (!tournament) {
    return Response.json({ message: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!tournament.team.admins.includes(email)) {
    return Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }
  if (tournament.is_completed) {
    return Response.json({ message: "등록이 완료된 대회에는 매치를 추가할 수 없습니다." }, { status: 400 });
  }

  if (!tournament.start_date || !tournament.finish_date) {
    return Response.json({ message: "대회 기간을 먼저 설정해주세요." }, { status: 400 });
  }

  const body = (await req.json()) as Body;
  const teamId = body.teamId?.trim() ?? "";
  const opponentName = body.opponentName?.trim() ?? "";
  const opponentLevel = body.opponentLevel;
  const matchFormatFutsal = body.matchFormatFutsal ?? null;
  const dateString = body.date?.trim() ?? "";
  const attendees = dedupe(body.attendees);
  const games = body.games ?? [];
  const stage = body.stage;
  const isPso = Boolean(body.isPso);
  const psoResult = body.psoResult ?? null;

  if (teamId !== tournament.teamId) {
    return Response.json({ message: "팀 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (!stage || !STAGES.has(stage)) {
    return Response.json({ message: "예선/본선 구분은 필수입니다." }, { status: 400 });
  }
  if (isPso && (psoResult !== "WIN" && psoResult !== "LOSS")) {
    return Response.json({ message: "승부차기 결과를 선택해주세요." }, { status: 400 });
  }
  if (!isPso && psoResult !== null && psoResult !== undefined) {
    return Response.json({ message: "승부차기를 선택하지 않으면 승부차기 결과를 저장할 수 없습니다." }, { status: 400 });
  }

  if (!opponentName) {
    return Response.json({ message: "상대팀 이름은 필수입니다." }, { status: 400 });
  }
  if (!opponentLevel || !TOURNAMENT_OPPONENT_LEVELS.has(opponentLevel)) {
    return Response.json({ message: "상대팀 수준을 선택해주세요." }, { status: 400 });
  }
  if (!dateString) {
    return Response.json({ message: "경기 날짜는 필수입니다." }, { status: 400 });
  }

  const matchDate = new Date(dateString);
  if (Number.isNaN(matchDate.getTime())) {
    return Response.json({ message: "유효한 경기 날짜를 입력해주세요." }, { status: 400 });
  }

  const rangeStart = startOfUtcDay(tournament.start_date);
  const rangeEnd = startOfUtcDay(tournament.finish_date);
  const md = startOfUtcDay(matchDate);
  if (md.getTime() < rangeStart.getTime() || md.getTime() > rangeEnd.getTime()) {
    return Response.json({ message: "매치 날짜는 대회 기간 안에 있어야 합니다." }, { status: 400 });
  }

  if (attendees.length < 1) {
    return Response.json({ message: "출석 선수는 최소 1명 이상이어야 합니다." }, { status: 400 });
  }
  if (games.length < 1) {
    return Response.json({ message: "경기는 최소 1개 이상 등록해야 합니다." }, { status: 400 });
  }

  const allowedAttendees = new Set(tournament.attendees);
  if (attendees.some((playerId) => !allowedAttendees.has(playerId))) {
    return Response.json({ message: "출석 선수는 대회 참여 선수 목록 안에서만 선택할 수 있습니다." }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      players: { where: { isActive: true }, select: { id: true } },
    },
  });
  if (!team) {
    return Response.json({ message: "팀을 찾을 수 없습니다." }, { status: 404 });
  }
  if (team.sport_type === "FUTSAL" && (!matchFormatFutsal || !FUTSAL_MATCH_FORMATS.has(matchFormatFutsal))) {
    return Response.json({ message: "매치 포맷을 선택해주세요." }, { status: 400 });
  }
  if (team.sport_type === "SOCCER" && matchFormatFutsal !== null) {
    return Response.json({ message: "축구팀은 매치 포맷을 저장할 수 없습니다." }, { status: 400 });
  }

  const teamPlayerIdSet = new Set(team.players.map((player) => player.id));
  if (attendees.some((playerId) => !teamPlayerIdSet.has(playerId))) {
    return Response.json({ message: "출석 선수 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const attendeeSet = new Set(attendees);
  let totalUs = 0;
  let totalThem = 0;
  let countWin = 0;
  let countDraw = 0;
  let countLoss = 0;

  for (let gameIdx = 0; gameIdx < games.length; gameIdx += 1) {
    const game = games[gameIdx];
    if (!isNonNegativeInteger(game.scoreUs) || !isNonNegativeInteger(game.scoreThem)) {
      return Response.json({ message: `${gameIdx + 1}경기 스코어를 확인해주세요.` }, { status: 400 });
    }
    const scoreUs = game.scoreUs as number;
    const scoreThem = game.scoreThem as number;

    const goals = game.goals ?? [];
    if (goals.length !== scoreUs) {
      return Response.json(
        { message: `${gameIdx + 1}경기 우리팀 득점 수와 골 기록 수가 일치하지 않습니다.` },
        { status: 400 },
      );
    }

    const playersAll = dedupe(game.playersAll);
    const playersFw = dedupe(game.playersFw);
    const playersMf = dedupe(game.playersMf);
    const playersDf = dedupe(game.playersDf);
    const playersGk = dedupe(game.playersGk);

    const invalidPlayerSelection = [...playersAll, ...playersFw, ...playersMf, ...playersDf, ...playersGk].some(
      (playerId) => !attendeeSet.has(playerId),
    );
    if (invalidPlayerSelection) {
      return Response.json({ message: `${gameIdx + 1}경기 참여 선수 정보가 올바르지 않습니다.` }, { status: 400 });
    }

    if (team.sport_type === "SOCCER" && [...playersFw, ...playersMf, ...playersDf, ...playersGk].length < 1) {
      return Response.json({ message: `${gameIdx + 1}경기에 최소 1명 이상 포지션 배치가 필요합니다.` }, { status: 400 });
    }

    for (let goalIdx = 0; goalIdx < goals.length; goalIdx += 1) {
      const goal = goals[goalIdx];
      const scorerType = goal.scorerType;
      const assisterType = goal.assisterType;
      const scorerId = goal.scorerId?.trim() || null;
      const assisterId = goal.assisterId?.trim() || null;

      if (!scorerType || !RECORD_TYPES.has(scorerType) || scorerType === "NONE") {
        return Response.json({ message: `${gameIdx + 1}경기 ${goalIdx + 1}번째 골 득점자를 확인해주세요.` }, { status: 400 });
      }
      if (!assisterType || !RECORD_TYPES.has(assisterType) || assisterType === "OWN_GOAL") {
        return Response.json({ message: `${gameIdx + 1}경기 ${goalIdx + 1}번째 골 도움자를 확인해주세요.` }, { status: 400 });
      }

      if (scorerType === "PLAYER" && !scorerId) {
        return Response.json({ message: `${gameIdx + 1}경기 ${goalIdx + 1}번째 골 득점자를 입력해주세요.` }, { status: 400 });
      }
      if (assisterType === "PLAYER" && !assisterId) {
        return Response.json({ message: `${gameIdx + 1}경기 ${goalIdx + 1}번째 골 도움자를 입력해주세요.` }, { status: 400 });
      }
      if (scorerType === "PLAYER" && scorerId && !attendeeSet.has(scorerId)) {
        return Response.json({ message: `${gameIdx + 1}경기 ${goalIdx + 1}번째 골 득점자 정보가 올바르지 않습니다.` }, { status: 400 });
      }
      if (assisterType === "PLAYER" && assisterId && !attendeeSet.has(assisterId)) {
        return Response.json({ message: `${gameIdx + 1}경기 ${goalIdx + 1}번째 골 도움자 정보가 올바르지 않습니다.` }, { status: 400 });
      }
      if (scorerType === "OWN_GOAL" && assisterType !== "NONE") {
        return Response.json({ message: `${gameIdx + 1}경기 ${goalIdx + 1}번째 자책골은 도움 없음만 가능합니다.` }, { status: 400 });
      }
      if (scorerType === "PLAYER" && assisterType === "PLAYER" && scorerId === assisterId) {
        return Response.json({ message: `${gameIdx + 1}경기 ${goalIdx + 1}번째 득점자와 도움자는 같을 수 없습니다.` }, { status: 400 });
      }
    }

    const result = calcResult(scoreUs, scoreThem);
    totalUs += scoreUs;
    totalThem += scoreThem;
    if (result === "WIN") countWin += 1;
    if (result === "DRAW") countDraw += 1;
    if (result === "LOSS") countLoss += 1;
  }

  const totalResult = calcResult(totalUs, totalThem);

  const created = await prisma.$transaction(async (tx) => {
    const match = await tx.match.create({
      data: {
        teamId,
        opponent_name: opponentName,
        opponent_level: opponentLevel,
        date: matchDate,
        attendees,
        total_score_us: totalUs,
        total_score_them: totalThem,
        total_result: totalResult,
        count_win: countWin,
        count_draw: countDraw,
        count_loss: countLoss,
        is_tournament: true,
        tournamentId,
        stage,
        is_pso: isPso,
        pso_result: isPso ? psoResult ?? null : null,
        match_format_futsal: team.sport_type === "FUTSAL" ? matchFormatFutsal : null,
      },
    });

    for (const game of games) {
      const scoreUs = game.scoreUs ?? 0;
      const scoreThem = game.scoreThem ?? 0;
      const createdGame = await tx.game.create({
        data: {
          matchId: match.id,
          score_us: scoreUs,
          score_them: scoreThem,
          result: calcResult(scoreUs, scoreThem),
          players_all: dedupe(game.playersAll),
          players_fw: dedupe(game.playersFw),
          players_mf: dedupe(game.playersMf),
          players_df: dedupe(game.playersDf),
          players_gk: dedupe(game.playersGk),
        },
      });

      const goals = game.goals ?? [];
      if (goals.length > 0) {
        await tx.goalEvent.createMany({
          data: goals.map((goal) => ({
            gameId: createdGame.id,
            matchId: match.id,
            scorer_id: goal.scorerType === "PLAYER" ? goal.scorerId?.trim() || null : null,
            scorer_type: goal.scorerType ?? "PLAYER",
            assister_id: goal.assisterType === "PLAYER" ? goal.assisterId?.trim() || null : null,
            assister_type: goal.assisterType ?? "NONE",
          })),
        });
      }
    }

    return match;
  });

  return Response.json({ success: true, matchId: created.id, teamId });
}
