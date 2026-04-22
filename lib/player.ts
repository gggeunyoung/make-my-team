export const PLAYER_STYLE_OPTIONS = ["OFFENSIVE", "BALANCED", "DEFENSIVE", "GOALKEEPER"] as const;
export type PlayerStyleValue = (typeof PLAYER_STYLE_OPTIONS)[number];

export const POSITION_OPTIONS = ["FW", "MF", "DF", "GK"] as const;
export type PositionValue = (typeof POSITION_OPTIONS)[number];

export function isPlayerStyle(value: string): value is PlayerStyleValue {
  return PLAYER_STYLE_OPTIONS.includes(value as PlayerStyleValue);
}

export function parsePlayerPositions(rawPositions: unknown) {
  if (!Array.isArray(rawPositions)) return [] as PositionValue[];
  const set = new Set<PositionValue>();
  for (const value of rawPositions) {
    if (typeof value === "string" && POSITION_OPTIONS.includes(value as PositionValue)) {
      set.add(value as PositionValue);
    }
  }
  return [...set];
}

export function normalizePlayerName(name: string) {
  return name.trim();
}
