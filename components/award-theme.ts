/** 시상식 화면(SVG/CSS)과 공유 카드 이미지(canvas)가 함께 쓰는 시각 요소 */

export const MEDAL_COLORS: Record<number, { disc: string; discDark: string }> = {
  1: { disc: "#fbbf24", discDark: "#b45309" },
  2: { disc: "#d4d4d8", discDark: "#71717a" },
  3: { disc: "#d0824a", discDark: "#92400e" },
};

/** 메달 리본 (viewBox 0 0 24 28) */
export const MEDAL_RIBBONS = [
  { d: "M8 1 L4 12 L9 12.5 Z", fill: "#ef4444" },
  { d: "M16 1 L20 12 L15 12.5 Z", fill: "#3b82f6" },
] as const;

/** 트로피 (viewBox 0 0 24 24) */
export const TROPHY_CUP_PATH =
  "M7 2h10a1 1 0 0 1 1 1v3a5 5 0 0 1-4 4.9V13h1.5a1 1 0 1 1 0 2H14v4h2.5a1 1 0 1 1 0 2h-9a1 1 0 1 1 0-2H10v-4H8.5a1 1 0 1 1 0-2H10v-2.1A5 5 0 0 1 6 6V3a1 1 0 0 1 1-1z";

export const TROPHY_HANDLE_PATHS = [
  "M4 4H2.5A1.5 1.5 0 0 0 1 5.5v1A3.5 3.5 0 0 0 4.5 10H5",
  "M20 4h1.5A1.5 1.5 0 0 1 23 5.5v1A3.5 3.5 0 0 1 19.5 10H19",
] as const;

export const CONFETTI_PIECES = [
  { left: "6%", top: "18%", size: 8, color: "#fbbf24", rotate: 15, shape: "square" as const },
  { left: "14%", top: "62%", size: 6, color: "#f472b6", rotate: -20, shape: "circle" as const },
  { left: "22%", top: "30%", size: 5, color: "#38bdf8", rotate: 40, shape: "square" as const },
  { left: "9%", top: "82%", size: 7, color: "#ffffff", rotate: -10, shape: "circle" as const },
  { left: "30%", top: "12%", size: 6, color: "#a78bfa", rotate: 25, shape: "square" as const },
  { left: "88%", top: "20%", size: 8, color: "#fbbf24", rotate: -25, shape: "circle" as const },
  { left: "80%", top: "70%", size: 6, color: "#38bdf8", rotate: 10, shape: "square" as const },
  { left: "92%", top: "55%", size: 5, color: "#ffffff", rotate: 30, shape: "circle" as const },
  { left: "70%", top: "14%", size: 7, color: "#f472b6", rotate: -15, shape: "square" as const },
  { left: "95%", top: "85%", size: 6, color: "#a78bfa", rotate: 20, shape: "circle" as const },
  { left: "45%", top: "8%", size: 5, color: "#ffffff", rotate: -30, shape: "square" as const },
  { left: "55%", top: "90%", size: 7, color: "#fbbf24", rotate: 12, shape: "circle" as const },
];
