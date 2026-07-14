import type { PlayerStyleValue, PositionValue } from "@/lib/player";

export function playerStyleLabel(style: PlayerStyleValue) {
  if (style === "OFFENSIVE") return "공격형";
  if (style === "BALANCED") return "밸런스형";
  if (style === "DEFENSIVE") return "수비형";
  return "골키퍼";
}

export function positionLabels(positions: PositionValue[]) {
  return positions.join(" / ");
}

export type OpponentLevelValue = "TOP" | "HIGH" | "MID" | "LOW";

export function opponentLevelLabel(level: OpponentLevelValue) {
  if (level === "TOP") return "최상";
  if (level === "HIGH") return "상";
  if (level === "MID") return "중";
  return "하";
}

/** 상대팀 수준 뱃지 색상 — 난이도가 높을수록 강한 색으로 (가중치 계산의 근거가 되는 값이라 카드에서 눈에 띄어야 함) */
export function opponentLevelBadgeClass(level: OpponentLevelValue) {
  if (level === "TOP") return "bg-rose-100 text-rose-700";
  if (level === "HIGH") return "bg-orange-100 text-orange-700";
  if (level === "MID") return "bg-amber-100 text-amber-700";
  return "bg-sky-100 text-sky-700";
}

/** 어두운 배경(그라데이션 배너 등) 위에서 쓰는 상대팀 수준 뱃지 색상 */
export function opponentLevelBadgeClassOnDark(level: OpponentLevelValue) {
  if (level === "TOP") return "bg-rose-400/20 text-rose-200";
  if (level === "HIGH") return "bg-orange-400/20 text-orange-200";
  if (level === "MID") return "bg-amber-400/20 text-amber-200";
  return "bg-sky-400/20 text-sky-200";
}

export function matchResultLabel(result: "WIN" | "DRAW" | "LOSS") {
  if (result === "WIN") return "승";
  if (result === "DRAW") return "무";
  return "패";
}

export function psoResultLabel(result: "WIN" | "LOSS") {
  return result === "WIN" ? "승부차기 승" : "승부차기 패";
}

export function formatMatchDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR");
}
