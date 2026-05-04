import type { TournamentResult } from "@/app/generated/prisma/client";

export type TournamentMatchLite = {
  date: Date;
  stage: "PRELIMINARY" | "MAIN" | null;
};

export type CompleteValidationInput = {
  tournament_name: string | null;
  tournament_result: TournamentResult | null;
  start_date: Date | null;
  finish_date: Date | null;
  attendees: string[];
  pick_1st: string | null;
  pick_2nd: string | null;
  pick_3rd: string | null;
  matches: TournamentMatchLite[];
};

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function validateTournamentCompletePayload(input: CompleteValidationInput): string | null {
  const name = input.tournament_name?.trim() ?? "";
  if (!name) return "대회 이름은 필수입니다.";
  if (!input.tournament_result) return "대회 결과를 선택해주세요.";
  if (!input.start_date || !input.finish_date) return "대회 기간을 입력해주세요.";
  if (input.start_date.getTime() > input.finish_date.getTime()) return "대회 시작일이 종료일보다 늦을 수 없습니다.";
  if (input.attendees.length < 1) return "참여 선수는 최소 1명 이상이어야 합니다.";

  const picks = [input.pick_1st, input.pick_2nd, input.pick_3rd].filter(Boolean) as string[];
  if (new Set(picks).size !== picks.length) return "MVP 1/2/3순위는 동일한 선수를 선택할 수 없습니다.";

  const matches = input.matches;
  if (matches.length < 1) return "대회 매치는 최소 1개 이상 필요합니다.";

  const rangeStart = startOfUtcDay(input.start_date);
  const rangeEnd = startOfUtcDay(input.finish_date);

  const hasMain = matches.some((m) => m.stage === "MAIN");
  const hasAnyMainLikeResult =
    input.tournament_result === "WINNER" ||
    input.tournament_result === "RUNNER_UP" ||
    input.tournament_result === "THIRD" ||
    input.tournament_result === "SEMIFINAL";

  for (const m of matches) {
    if (!m.stage) return "모든 대회 매치에 예선/본선 구분을 입력해주세요.";
    const md = startOfUtcDay(m.date);
    if (md.getTime() < rangeStart.getTime() || md.getTime() > rangeEnd.getTime()) {
      return "매치 날짜는 대회 기간 안에 있어야 합니다.";
    }
  }

  if (input.tournament_result === "GROUP_STAGE" && hasMain) {
    return "예선 탈락 결과에서는 본선 매치를 등록할 수 없습니다.";
  }

  if (hasAnyMainLikeResult && !hasMain) {
    return "본선 진출 이상 결과에서는 본선 매치가 최소 1개 필요합니다.";
  }

  return null;
}
