import { MEDAL_COLORS, MEDAL_RIBBONS } from "@/components/award-theme";

/**
 * 카카오톡 공유 카드(시상식, 선수 순위)가 함께 쓰는 그리기 도구.
 * 카카오톡 피드 메시지에서 잘리지 않도록 정사각형으로 그리고,
 * 말풍선 안에서는 약 1/4 크기로 보이므로 글자는 크게 잡는다.
 */
export const SHARE_CARD_SIZE = 1080;

export const CARD_AMBER = "#fcd34d";

const FONT_FAMILY = 'Arial, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
const DEFAULT_ACCENT = "#3f3f46";
const PHOTO_TIMEOUT_MS = 8000;

export type Rect = { x: number; y: number; w: number; h: number };

/** 사진을 불러온 선수. 사진이 없거나 못 불러오면 img가 null이고 이니셜을 그린다. */
export type CardPlayer = { name: string; img: HTMLImageElement | null };

export function cardFont(weight: number, size: number) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

/** CORS가 허용된 사진만 그린다. 실패하거나 오래 걸리면 이니셜로 대체. */
export function loadPhoto(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(null), PHOTO_TIMEOUT_MS);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** maxWidth에 맞을 때까지 글자를 줄이고, 최소 크기에서도 넘치면 말줄임. ctx.font는 최종 크기로 남는다. */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  size: number,
  minSize: number,
) {
  let current = size;
  ctx.font = cardFont(weight, current);
  while (current > minSize && ctx.measureText(text).width > maxWidth) {
    current -= 1;
    ctx.font = cardFont(weight, current);
  }
  if (ctx.measureText(text).width <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

export function createCardCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_SIZE;
  canvas.height = SHARE_CARD_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context를 만들 수 없습니다.");
  return { canvas, ctx };
}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("카드 이미지를 만들지 못했습니다."))),
      "image/jpeg",
      0.92,
    );
  });
}

/** 팀 색상에서 어두운 색으로 내려가는 대각선 배경 */
export function fillCardBackground(ctx: CanvasRenderingContext2D, accentColor: string) {
  const gradient = ctx.createLinearGradient(0, 0, SHARE_CARD_SIZE, SHARE_CARD_SIZE);
  try {
    gradient.addColorStop(0, accentColor);
  } catch {
    gradient.addColorStop(0, DEFAULT_ACCENT);
  }
  gradient.addColorStop(1, "#18181b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SHARE_CARD_SIZE, SHARE_CARD_SIZE);
}

/** 순위 메달(1~3위). (x, y)는 메달 왼쪽 위, height는 리본을 포함한 높이. */
export function drawMedal(ctx: CanvasRenderingContext2D, rank: number, x: number, y: number, height: number) {
  const colors = MEDAL_COLORS[rank];
  if (!colors) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(height / 28, height / 28);
  for (const ribbon of MEDAL_RIBBONS) {
    ctx.fillStyle = ribbon.fill;
    ctx.fill(new Path2D(ribbon.d));
  }
  ctx.beginPath();
  ctx.arc(12, 17, 8, 0, Math.PI * 2);
  ctx.fillStyle = colors.disc;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.discDark;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = cardFont(700, 9);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(rank), 12, 20.5);
  ctx.restore();
}

/** 메달을 원형 사진의 오른쪽 아래에 살짝 걸쳐 그린다. ratio는 사진 지름 대비 메달 높이. */
export function drawAvatarMedal(
  ctx: CanvasRenderingContext2D,
  rank: number,
  cx: number,
  bottom: number,
  diameter: number,
  ratio = 0.42,
) {
  const medalHeight = diameter * ratio;
  const outset = diameter * 0.06;
  drawMedal(ctx, rank, cx + diameter / 2 + outset - (medalHeight * 24) / 28, bottom + outset - medalHeight, medalHeight);
}

/** 흰 테두리를 두른 원형 사진. 사진이 없으면 이니셜. */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  player: CardPlayer,
  cx: number,
  cy: number,
  diameter: number,
  shadow: { blur: number; offsetY: number } = { blur: 24, offsetY: 6 },
) {
  const radius = diameter / 2;
  const inner = radius - Math.max(4, Math.round(diameter * 0.035));

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = shadow.blur;
  ctx.shadowOffsetY = shadow.offsetY;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.clip();
  const { img } = player;
  if (img) {
    // object-cover: 가운데 정사각형으로 잘라 그린다
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      cx - inner,
      cy - inner,
      inner * 2,
      inner * 2,
    );
  } else {
    ctx.fillStyle = "#e4e4e7";
    ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2);
    ctx.fillStyle = "#71717a";
    ctx.font = cardFont(700, Math.round(inner * 0.8));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.name.trim().charAt(0) || "?", cx, cy + inner * 0.04);
  }
  ctx.restore();
}

/** 반투명 칸(시상 부문, 순위 줄) */
export function drawPanel(ctx: CanvasRenderingContext2D, rect: Rect, radius: number) {
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();
}
