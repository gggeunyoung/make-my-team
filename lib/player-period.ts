export type PeriodType = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "YEARLY";

export const PERIOD_TYPES: PeriodType[] = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "YEARLY"];

export type PeriodOption = { value: string; label: string };

export function shortYear(year: number) {
  return String(year % 100).padStart(2, "0");
}

export function formatMonthLabel(year: number, month: number) {
  return `${shortYear(year)}년 ${month}월`;
}

export function formatQuarterLabel(year: number, quarter: number) {
  return `${shortYear(year)}년 ${quarter}분기`;
}

export function formatHalfLabel(year: number, half: 1 | 2) {
  return `${shortYear(year)}년 ${half === 1 ? "상" : "하"}반기`;
}

export function formatYearLabel(year: number) {
  return `${year}년`;
}

export function getQuarterFromDate(date: Date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function getHalfFromDate(date: Date): 1 | 2 {
  return date.getMonth() < 6 ? 1 : 2;
}

export function getCurrentQuarterInfo(now = new Date()) {
  const year = now.getFullYear();
  const quarter = getQuarterFromDate(now);
  return {
    year,
    quarter,
    label: formatQuarterLabel(year, quarter),
    range: getQuarterRange(year, quarter),
  };
}

export function getQuarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getHalfRange(year: number, half: 1 | 2) {
  if (half === 1) {
    return {
      start: new Date(year, 0, 1, 0, 0, 0, 0),
      end: new Date(year, 6, 0, 23, 59, 59, 999),
    };
  }
  return {
    start: new Date(year, 6, 1, 0, 0, 0, 0),
    end: new Date(year, 12, 0, 23, 59, 59, 999),
  };
}

export function getYearRange(year: number) {
  return {
    start: new Date(year, 0, 1, 0, 0, 0, 0),
    end: new Date(year, 12, 0, 23, 59, 59, 999),
  };
}

export function parseSubPeriodRange(period: PeriodType, subPeriod: string): { start: Date; end: Date } | null {
  if (period === "MONTHLY") {
    const match = /^(\d{4})-(\d{2})$/.exec(subPeriod);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    return getMonthRange(year, month);
  }

  if (period === "QUARTERLY") {
    const match = /^(\d{4})-Q([1-4])$/.exec(subPeriod);
    if (!match) return null;
    return getQuarterRange(Number(match[1]), Number(match[2]));
  }

  if (period === "SEMIANNUAL") {
    const match = /^(\d{4})-H([12])$/.exec(subPeriod);
    if (!match) return null;
    return getHalfRange(Number(match[1]), Number(match[2]) as 1 | 2);
  }

  if (period === "YEARLY") {
    const match = /^(\d{4})$/.exec(subPeriod);
    if (!match) return null;
    return getYearRange(Number(match[1]));
  }

  return null;
}

function compareDesc(a: PeriodOption, b: PeriodOption) {
  return b.value.localeCompare(a.value);
}

export function buildPeriodOptionsFromDates(dates: Date[]): Record<PeriodType, PeriodOption[]> {
  const monthSet = new Set<string>();
  const quarterSet = new Set<string>();
  const halfSet = new Set<string>();
  const yearSet = new Set<string>();

  for (const date of dates) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = getQuarterFromDate(date);
    const half = getHalfFromDate(date);

    monthSet.add(`${year}-${String(month).padStart(2, "0")}`);
    quarterSet.add(`${year}-Q${quarter}`);
    halfSet.add(`${year}-H${half}`);
    yearSet.add(`${year}`);
  }

  const monthly = [...monthSet]
    .map((value) => {
      const [y, m] = value.split("-");
      return { value, label: formatMonthLabel(Number(y), Number(m)) };
    })
    .sort(compareDesc);

  const quarterly = [...quarterSet]
    .map((value) => {
      const match = /^(\d{4})-Q([1-4])$/.exec(value);
      if (!match) return null;
      return { value, label: formatQuarterLabel(Number(match[1]), Number(match[2])) };
    })
    .filter((item): item is PeriodOption => item !== null)
    .sort(compareDesc);

  const semiannual = [...halfSet]
    .map((value) => {
      const match = /^(\d{4})-H([12])$/.exec(value);
      if (!match) return null;
      return { value, label: formatHalfLabel(Number(match[1]), Number(match[2]) as 1 | 2) };
    })
    .filter((item): item is PeriodOption => item !== null)
    .sort(compareDesc);

  const yearly = [...yearSet]
    .map((value) => ({ value, label: formatYearLabel(Number(value)) }))
    .sort(compareDesc);

  return { MONTHLY: monthly, QUARTERLY: quarterly, SEMIANNUAL: semiannual, YEARLY: yearly };
}

export function periodTypeLabel(period: PeriodType) {
  if (period === "MONTHLY") return "월별";
  if (period === "QUARTERLY") return "분기별";
  if (period === "SEMIANNUAL") return "반기별";
  return "연간";
}

export function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
