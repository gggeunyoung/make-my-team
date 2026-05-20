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
