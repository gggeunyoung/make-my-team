import type { AwardPeriod } from "@/app/generated/prisma/enums";
import type { PeriodType } from "@/lib/player-period";

export type AwardPeriodLike = AwardPeriod | PeriodType;

/**
 * AwardPeriod/PeriodType + subPeriod → 사람이 읽기 좋은 한글 기간 라벨.
 * 예: QUARTERLY + "2026-Q2" → "2026년 2분기"
 */
export function formatAwardPeriodKorean(period: AwardPeriodLike, subPeriod: string): string {
  const normalized = period === "YEARLY" ? "ANNUAL" : period;

  if (normalized === "MONTHLY") {
    const match = /^(\d{4})-(\d{2})$/.exec(subPeriod);
    if (!match) return subPeriod;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return subPeriod;
    return `${year}년 ${month}월`;
  }

  if (normalized === "QUARTERLY") {
    const match = /^(\d{4})-Q([1-4])$/.exec(subPeriod);
    if (!match) return subPeriod;
    return `${Number(match[1])}년 ${Number(match[2])}분기`;
  }

  if (normalized === "SEMIANNUAL") {
    const match = /^(\d{4})-H([12])$/.exec(subPeriod);
    if (!match) return subPeriod;
    const half = Number(match[2]) === 1 ? "상" : "하";
    return `${Number(match[1])}년 ${half}반기`;
  }

  if (normalized === "ANNUAL") {
    const match = /^(\d{4})$/.exec(subPeriod);
    if (!match) return subPeriod;
    return `${Number(match[1])}년`;
  }

  return subPeriod;
}

/**
 * 시상식 공유 버튼 라벨.
 * 예: QUARTERLY → "이 분기 시상식 공유하기"
 */
export function awardShareButtonLabel(period: AwardPeriodLike): string {
  const normalized = period === "YEARLY" ? "ANNUAL" : period;

  if (normalized === "MONTHLY") return "이번 달 시상식 공유하기";
  if (normalized === "QUARTERLY") return "이 분기 시상식 공유하기";
  if (normalized === "SEMIANNUAL") return "이번 반기 시상식 공유하기";
  if (normalized === "ANNUAL") return "올해 시상식 공유하기";
  return "시상식 공유하기";
}
