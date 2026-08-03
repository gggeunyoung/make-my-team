/** 이 값 이상이면 저장 전 확인 모달을 띄웁니다. */
export const SCORE_CONFIRM_THRESHOLD = 10;

/** 이 값 이상이면 저장을 차단합니다. (허용 최대 득점 = SCORE_HARD_LIMIT - 1) */
export const SCORE_HARD_LIMIT = 30;

export const SCORE_HARD_LIMIT_MESSAGE = `득점은 ${SCORE_HARD_LIMIT}골을 초과할 수 없습니다`;

export function isScoreOverHardLimit(score: number): boolean {
  return score >= SCORE_HARD_LIMIT;
}

export function isScoreNeedingConfirm(score: number): boolean {
  return score >= SCORE_CONFIRM_THRESHOLD && score < SCORE_HARD_LIMIT;
}
