import type { SportType } from "@/app/generated/prisma/enums";

const ACCESS_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ACCESS_CODE_CHARS[Math.floor(Math.random() * ACCESS_CODE_CHARS.length)];
  }
  return code;
}

export function calculateTeamNameUnits(name: string) {
  let units = 0;
  for (const char of name) {
    const ascii = /^[\x00-\x7F]$/.test(char);
    units += ascii ? 1.2 : 2;
  }
  return Math.round(units * 10) / 10;
}

export function validateSportType(value: string): value is SportType {
  return value === "FUTSAL" || value === "SOCCER";
}
