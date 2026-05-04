import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPlayerIdsReferencedInTournamentMatches } from "@/lib/tournament-attendee-records";

type TournamentResult = "WINNER" | "RUNNER_UP" | "THIRD" | "SEMIFINAL" | "GROUP_STAGE";

const RESULTS = new Set<TournamentResult>(["WINNER", "RUNNER_UP", "THIRD", "SEMIFINAL", "GROUP_STAGE"]);

type Body = {
  tournamentName?: string | null;
  tournamentResult?: TournamentResult | null;
  startDate?: string | null;
  finishDate?: string | null;
  attendees?: string[];
  pick1st?: string | null;
  pick2nd?: string | null;
  pick3rd?: string | null;
};

function dedupe(values: string[] | undefined) {
  return [...new Set((values ?? []).filter((v) => Boolean(v?.trim())).map((v) => v.trim()))];
}

function parseOptionalDate(value: string | null | undefined): Date | null | "invalid" {
  if (value === undefined) return null;
  if (value === null || String(value).trim() === "") return null;
  const d = new Date(String(value).trim());
  if (Number.isNaN(d.getTime())) return "invalid";
  return d;
}

type RouteContext = {
  params: Promise<{ tournamentId: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
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
    return Response.json({ message: "등록이 완료된 대회는 수정할 수 없습니다." }, { status: 400 });
  }

  const body = (await req.json()) as Body;

  const nextAttendees = body.attendees !== undefined ? dedupe(body.attendees) : undefined;

  const teamPlayers = await prisma.player.findMany({
    where: { teamId: tournament.teamId, isActive: true },
    select: { id: true },
  });
  const playerSet = new Set(teamPlayers.map((p) => p.id));

  if (nextAttendees !== undefined) {
    if (nextAttendees.some((id) => !playerSet.has(id))) {
      return Response.json({ message: "참여 선수 정보가 올바르지 않습니다." }, { status: 400 });
    }

    const removed = tournament.attendees.filter((id) => !nextAttendees.includes(id));
    if (removed.length > 0) {
      const referenced = await getPlayerIdsReferencedInTournamentMatches(prisma, tournamentId);
      const blocked = removed.filter((id) => referenced.has(id));
      if (blocked.length > 0) {
        return Response.json(
          {
            message: "이미 매치에 출석·골·어시 기록이 있는 선수는 참여 목록에서 제외할 수 없습니다.",
          },
          { status: 400 },
        );
      }
    }
  }

  let tournamentResult: TournamentResult | null | undefined;
  if (body.tournamentResult !== undefined) {
    if (body.tournamentResult === null) {
      tournamentResult = null;
    } else if (!RESULTS.has(body.tournamentResult)) {
      return Response.json({ message: "대회 결과 값이 올바르지 않습니다." }, { status: 400 });
    } else {
      tournamentResult = body.tournamentResult;
    }
  }

  let startDate: Date | null | undefined;
  let finishDate: Date | null | undefined;

  if (body.startDate !== undefined) {
    const parsed = parseOptionalDate(body.startDate);
    if (parsed === "invalid") {
      return Response.json({ message: "대회 시작일이 올바르지 않습니다." }, { status: 400 });
    }
    startDate = parsed;
  }

  if (body.finishDate !== undefined) {
    const parsed = parseOptionalDate(body.finishDate);
    if (parsed === "invalid") {
      return Response.json({ message: "대회 종료일이 올바르지 않습니다." }, { status: 400 });
    }
    finishDate = parsed;
  }

  const effectiveStart = startDate !== undefined ? startDate : tournament.start_date;
  const effectiveFinish = finishDate !== undefined ? finishDate : tournament.finish_date;
  if (effectiveStart && effectiveFinish && effectiveStart.getTime() > effectiveFinish.getTime()) {
    return Response.json({ message: "대회 시작일이 종료일보다 늦을 수 없습니다." }, { status: 400 });
  }

  const mergedAttendees = nextAttendees ?? tournament.attendees;

  const mergedPick1 = body.pick1st !== undefined ? (body.pick1st?.trim() ? body.pick1st.trim() : null) : tournament.pick_1st;
  const mergedPick2 = body.pick2nd !== undefined ? (body.pick2nd?.trim() ? body.pick2nd.trim() : null) : tournament.pick_2nd;
  const mergedPick3 = body.pick3rd !== undefined ? (body.pick3rd?.trim() ? body.pick3rd.trim() : null) : tournament.pick_3rd;

  for (const [pick, label] of [
    [mergedPick1, "MVP 1순위"],
    [mergedPick2, "MVP 2순위"],
    [mergedPick3, "MVP 3순위"],
  ] as const) {
    if (pick && !mergedAttendees.includes(pick)) {
      return Response.json({ message: `${label}는 참여 선수 중에서만 선택할 수 있습니다.` }, { status: 400 });
    }
  }

  const picks = [mergedPick1, mergedPick2, mergedPick3].filter(Boolean) as string[];
  if (new Set(picks).size !== picks.length) {
    return Response.json({ message: "MVP 1/2/3순위는 동일한 선수를 선택할 수 없습니다." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.tournamentName !== undefined) {
    data.tournament_name = body.tournamentName === null ? null : String(body.tournamentName).trim() || null;
  }
  if (tournamentResult !== undefined) {
    data.tournament_result = tournamentResult;
  }
  if (startDate !== undefined) {
    data.start_date = startDate;
  }
  if (finishDate !== undefined) {
    data.finish_date = finishDate;
  }
  if (nextAttendees !== undefined) {
    data.attendees = nextAttendees;
  }
  if (body.pick1st !== undefined) {
    data.pick_1st = body.pick1st === null ? null : body.pick1st.trim() ? body.pick1st.trim() : null;
  }
  if (body.pick2nd !== undefined) {
    data.pick_2nd = body.pick2nd === null ? null : body.pick2nd.trim() ? body.pick2nd.trim() : null;
  }
  if (body.pick3rd !== undefined) {
    data.pick_3rd = body.pick3rd === null ? null : body.pick3rd.trim() ? body.pick3rd.trim() : null;
  }

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data,
  });

  return Response.json({
    tournament: {
      id: updated.id,
      tournament_name: updated.tournament_name,
      tournament_result: updated.tournament_result,
      start_date: updated.start_date?.toISOString() ?? null,
      finish_date: updated.finish_date?.toISOString() ?? null,
      attendees: updated.attendees,
      pick_1st: updated.pick_1st,
      pick_2nd: updated.pick_2nd,
      pick_3rd: updated.pick_3rd,
      is_completed: updated.is_completed,
    },
  });
}
