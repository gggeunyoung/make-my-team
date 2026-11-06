import {
  CONFETTI_PIECES,
  MEDAL_COLORS,
  MEDAL_RIBBONS,
  TROPHY_CUP_PATH,
  TROPHY_HANDLE_PATHS,
} from "@/components/award-theme";

export type AwardShareCardPlayer = {
  name: string;
  photo: string | null;
};

export type AwardShareCardData = {
  teamName: string;
  periodLabel: string;
  accentColor: string;
  /** MVP 1~3위. 공동 순위면 players가 여러 명 */
  podium: { rank: 1 | 2 | 3; players: AwardShareCardPlayer[] }[];
  /** MVP를 제외한 부문별 1위 */
  winners: { label: string; names: string | null; value: string | null }[];
};

/**
 * 카카오톡 피드 메시지에서 잘리지 않도록 정사각형으로 그린다.
 * 말풍선 안에서는 약 1/4 크기로 보이므로 글자는 크게 잡는다.
 */
export const AWARD_SHARE_CARD_SIZE = 1080;

const SIZE = AWARD_SHARE_CARD_SIZE;
const PADDING_X = 64;
const PADDING_Y = 60;
const FONT_FAMILY = 'Arial, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
const DEFAULT_ACCENT = "#3f3f46";
const AMBER = "#fcd34d";
const PHOTO_TIMEOUT_MS = 8000;

const HEADER_HEIGHT = 96;
const TITLE_HEIGHT = 40;
const TITLE_TEXT = "최우수 선수";
const TROPHY_SIZE = 40;
const TROPHY_GAP = 14;
const PODIUM_NAME_SPACE = 64;
const PODIUM_SIDE_GAP = 40;
const PODIUM_SIDE_RATIO = 0.72;
const AVATAR_OVERLAP = 0.62;
const GRID_COLUMNS = 3;
const GRID_GAP = 14;
const KEEP_OUT_MARGIN = 14;

type Rect = { x: number; y: number; w: number; h: number };
type LoadedPlayer = { name: string; img: HTMLImageElement | null };
type LoadedSlot = { rank: 1 | 2 | 3; players: LoadedPlayer[] };
type PodiumSlot = LoadedSlot & {
  centerX: number;
  diameter: number;
  groupWidth: number;
  nameMaxWidth: number;
};

type Layout = {
  headerTop: number;
  titleTop: number;
  podiumTop: number;
  podiumBottom: number;
  slots: PodiumSlot[];
  gridTop: number;
  gridRows: number;
  cellWidth: number;
  cellHeight: number;
  keepOut: Rect[];
};

function font(weight: number, size: number) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

/** CORS가 허용된 사진만 그린다. 실패하거나 오래 걸리면 이니셜로 대체. */
function loadPhoto(src: string | null): Promise<HTMLImageElement | null> {
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

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** maxWidth에 맞을 때까지 글자를 줄이고, 최소 크기에서도 넘치면 말줄임. ctx.font는 최종 크기로 남는다. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  size: number,
  minSize: number,
) {
  let current = size;
  ctx.font = font(weight, current);
  while (current > minSize && ctx.measureText(text).width > maxWidth) {
    current -= 1;
    ctx.font = font(weight, current);
  }
  if (ctx.measureText(text).width <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

/**
 * 시상대: 슬롯마다 차지하는 폭(공동 수상 사진 묶음, 이름 칸)을 재서 겹치지 않게 배치하고,
 * 카드 폭을 넘으면 전체를 같은 비율로 줄인다. 2위는 왼쪽, 3위는 오른쪽.
 */
function layoutPodium(slots: LoadedSlot[], firstDiameter: number): PodiumSlot[] {
  const center = slots.find((slot) => slot.rank === 1) ?? slots[0];
  if (!center) return [];
  const sides = slots.filter((slot) => slot !== center);

  const measure = (slot: LoadedSlot, scale: number) => {
    const diameter = (slot.rank === 1 ? firstDiameter : firstDiameter * PODIUM_SIDE_RATIO) * scale;
    const groupWidth = diameter * (1 + AVATAR_OVERLAP * (slot.players.length - 1));
    const nameMaxWidth = Math.max(groupWidth, (slot.rank === 1 ? 260 : 200) * scale);
    return { diameter, groupWidth, nameMaxWidth };
  };

  const widestSide = Math.max(0, ...sides.map((slot) => measure(slot, 1).nameMaxWidth));
  const totalWidth = measure(center, 1).nameMaxWidth + (widestSide + PODIUM_SIDE_GAP) * 2;
  const scale = Math.min(1, (SIZE - PADDING_X * 2) / totalWidth);

  const centerMetrics = measure(center, scale);
  return [
    { ...center, ...centerMetrics, centerX: SIZE / 2 },
    ...sides.map((slot) => {
      const metrics = measure(slot, scale);
      const distance = centerMetrics.nameMaxWidth / 2 + PODIUM_SIDE_GAP + metrics.nameMaxWidth / 2;
      return { ...slot, ...metrics, centerX: SIZE / 2 + (slot.rank === 3 ? distance : -distance) };
    }),
  ];
}

function computeLayout(ctx: CanvasRenderingContext2D, data: AwardShareCardData, slots: LoadedSlot[]): Layout {
  const gridRows = Math.ceil(data.winners.length / GRID_COLUMNS);
  const cellHeight = gridRows >= 3 ? 140 : 164;
  const gridHeight = gridRows > 0 ? gridRows * cellHeight + (gridRows - 1) * GRID_GAP : 0;
  const firstDiameter = gridRows >= 3 ? 220 : 250;
  const podiumHeight = firstDiameter + PODIUM_NAME_SPACE;

  const blocks = HEADER_HEIGHT + TITLE_HEIGHT + podiumHeight + gridHeight;
  const gapCount = gridRows > 0 ? 3 : 2;
  const gap = Math.max(20, (SIZE - PADDING_Y * 2 - blocks) / gapCount);

  const headerTop = PADDING_Y;
  const titleTop = headerTop + HEADER_HEIGHT + gap;
  const podiumTop = titleTop + TITLE_HEIGHT + gap;
  const podiumBottom = podiumTop + firstDiameter;
  const gridTop = podiumTop + podiumHeight + gap;
  const cellWidth = (SIZE - PADDING_X * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const placed = layoutPodium(slots, firstDiameter);

  // 장식(색종이)이 글자·사진 밑에 깔리지 않도록 비워 둘 영역
  ctx.font = font(700, 52);
  const periodWidth = ctx.measureText(`${data.periodLabel} 시상식`).width;
  ctx.font = font(600, 30);
  const headerWidth = Math.min(SIZE - PADDING_X * 2, Math.max(periodWidth, ctx.measureText(data.teamName).width));
  ctx.font = font(700, 40);
  const titleWidth = ctx.measureText(TITLE_TEXT).width + (TROPHY_GAP + TROPHY_SIZE) * 2;
  const podiumLeft = Math.min(...placed.map((slot) => slot.centerX - slot.nameMaxWidth / 2));
  const podiumRight = Math.max(...placed.map((slot) => slot.centerX + slot.nameMaxWidth / 2));

  const keepOut: Rect[] = [
    { x: (SIZE - headerWidth) / 2, y: headerTop, w: headerWidth, h: HEADER_HEIGHT },
    { x: (SIZE - titleWidth) / 2, y: titleTop, w: titleWidth, h: TITLE_HEIGHT },
    { x: PADDING_X, y: gridTop, w: SIZE - PADDING_X * 2, h: gridHeight },
  ];
  if (placed.length > 0) {
    keepOut.push({ x: podiumLeft, y: podiumTop - 30, w: podiumRight - podiumLeft, h: podiumHeight + 30 });
  }

  return {
    headerTop,
    titleTop,
    podiumTop,
    podiumBottom,
    slots: placed,
    gridTop,
    gridRows,
    cellWidth,
    cellHeight,
    keepOut: keepOut.map((rect) => ({
      x: rect.x - KEEP_OUT_MARGIN,
      y: rect.y - KEEP_OUT_MARGIN,
      w: rect.w + KEEP_OUT_MARGIN * 2,
      h: rect.h + KEEP_OUT_MARGIN * 2,
    })),
  };
}

function drawBackground(ctx: CanvasRenderingContext2D, accentColor: string, keepOut: Rect[]) {
  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  try {
    gradient.addColorStop(0, accentColor);
  } catch {
    gradient.addColorStop(0, DEFAULT_ACCENT);
  }
  gradient.addColorStop(1, "#18181b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.save();
  ctx.globalAlpha = 0.4;
  for (const piece of CONFETTI_PIECES) {
    const s = piece.size * 1.8;
    const x = (parseFloat(piece.left) / 100) * SIZE;
    const y = (parseFloat(piece.top) / 100) * SIZE;
    if (keepOut.some((rect) => intersects(rect, { x, y, w: s, h: s }))) continue;

    ctx.save();
    ctx.translate(x + s / 2, y + s / 2);
    ctx.rotate((piece.rotate * Math.PI) / 180);
    ctx.fillStyle = piece.color;
    if (piece.shape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
    } else {
      roundedRect(ctx, -s / 2, -s / 2, s, s, s * 0.25);
    }
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawHeader(ctx: CanvasRenderingContext2D, data: AwardShareCardData, top: number) {
  const maxWidth = SIZE - PADDING_X * 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(fitText(ctx, data.teamName, maxWidth, 600, 30, 22), SIZE / 2, top + 15);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(fitText(ctx, `${data.periodLabel} 시상식`, maxWidth, 700, 52, 36), SIZE / 2, top + 68);
}

function drawTrophy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = AMBER;
  ctx.fill(new Path2D(TROPHY_CUP_PATH));
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (const d of TROPHY_HANDLE_PATHS) ctx.stroke(new Path2D(d));
  ctx.restore();
}

function drawTitle(ctx: CanvasRenderingContext2D, top: number) {
  const centerY = top + TITLE_HEIGHT / 2;
  ctx.font = font(700, 40);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(TITLE_TEXT, SIZE / 2, centerY);

  const half = ctx.measureText(TITLE_TEXT).width / 2;
  drawTrophy(ctx, SIZE / 2 - half - TROPHY_GAP - TROPHY_SIZE, centerY - TROPHY_SIZE / 2, TROPHY_SIZE);
  drawTrophy(ctx, SIZE / 2 + half + TROPHY_GAP, centerY - TROPHY_SIZE / 2, TROPHY_SIZE);
}

function drawMedal(ctx: CanvasRenderingContext2D, rank: number, x: number, y: number, height: number) {
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
  ctx.font = font(700, 9);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(rank), 12, 20.5);
  ctx.restore();
}

function drawAvatar(ctx: CanvasRenderingContext2D, player: LoadedPlayer, cx: number, cy: number, diameter: number) {
  const radius = diameter / 2;
  const inner = radius - Math.max(4, Math.round(diameter * 0.035));

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
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
    ctx.font = font(700, Math.round(inner * 0.8));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.name.trim().charAt(0) || "?", cx, cy + inner * 0.04);
  }
  ctx.restore();
}

function drawPodium(ctx: CanvasRenderingContext2D, layout: Layout) {
  const { slots, podiumTop, podiumBottom } = layout;
  if (slots.length === 0) {
    ctx.font = font(500, 30);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("수상자 없음", SIZE / 2, (podiumTop + podiumBottom) / 2);
    return;
  }

  for (const slot of slots) {
    const { diameter, centerX } = slot;
    const isFirst = slot.rank === 1;
    const cy = podiumBottom - diameter / 2;
    const firstCx = centerX - slot.groupWidth / 2 + diameter / 2;
    const step = diameter * AVATAR_OVERLAP;

    if (isFirst) {
      const glow = ctx.createRadialGradient(centerX, cy, diameter * 0.3, centerX, cy, diameter);
      glow.addColorStop(0, "rgba(255,255,255,0.22)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(centerX - slot.groupWidth / 2 - diameter, cy - diameter, slot.groupWidth + diameter * 2, diameter * 2);
    }

    slot.players.forEach((player, i) => drawAvatar(ctx, player, firstCx + step * i, cy, diameter));

    const lastCx = firstCx + step * (slot.players.length - 1);
    const medalHeight = diameter * 0.42;
    const outset = diameter * 0.06;
    drawMedal(
      ctx,
      slot.rank,
      lastCx + diameter / 2 + outset - (medalHeight * 24) / 28,
      podiumBottom + outset - medalHeight,
      medalHeight,
    );

    const names = slot.players.map((player) => player.name).join(" & ");
    const label = fitText(ctx, names, slot.nameMaxWidth, isFirst ? 700 : 600, isFirst ? 42 : 36, 22);
    ctx.fillStyle = isFirst ? "#ffffff" : "rgba(255,255,255,0.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, centerX, podiumBottom + (isFirst ? 42 : 38));
  }
}

function drawWinnerCell(
  ctx: CanvasRenderingContext2D,
  winner: AwardShareCardData["winners"][number],
  rect: Rect,
) {
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 24);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();

  const cx = rect.x + rect.w / 2;
  const maxWidth = rect.w - 32;
  const hasValue = Boolean(winner.names && winner.value);
  const blockHeight = hasValue ? 28 + 10 + 38 + 8 + 30 : 28 + 12 + 38;
  const top = rect.y + (rect.h - blockHeight) / 2;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(fitText(ctx, winner.label, maxWidth, 600, 28, 20), cx, top + 14);

  const nameY = top + 28 + (hasValue ? 10 : 12) + 19;
  if (winner.names) {
    ctx.fillStyle = "#ffffff";
    ctx.fillText(fitText(ctx, winner.names, maxWidth, 700, 38, 22), cx, nameY);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(fitText(ctx, "수상자 없음", maxWidth, 500, 30, 20), cx, nameY);
  }

  if (hasValue && winner.value) {
    ctx.fillStyle = AMBER;
    ctx.fillText(fitText(ctx, winner.value, maxWidth, 700, 30, 20), cx, nameY + 19 + 8 + 15);
  }
}

function drawWinnerGrid(ctx: CanvasRenderingContext2D, winners: AwardShareCardData["winners"], layout: Layout) {
  const { cellWidth, cellHeight, gridTop } = layout;
  winners.forEach((winner, index) => {
    const row = Math.floor(index / GRID_COLUMNS);
    const col = index % GRID_COLUMNS;
    const inRow = Math.min(GRID_COLUMNS, winners.length - row * GRID_COLUMNS);
    // 마지막 줄이 덜 차면 가운데 정렬
    const rowOffset = ((GRID_COLUMNS - inRow) * (cellWidth + GRID_GAP)) / 2;
    drawWinnerCell(ctx, winner, {
      x: PADDING_X + rowOffset + col * (cellWidth + GRID_GAP),
      y: gridTop + row * (cellHeight + GRID_GAP),
      w: cellWidth,
      h: cellHeight,
    });
  });
}

/** 시상식 결과를 1080×1080 JPEG 카드로 그린다. */
export async function renderAwardShareCard(data: AwardShareCardData): Promise<Blob> {
  const slots: LoadedSlot[] = await Promise.all(
    data.podium
      .filter((slot) => slot.players.length > 0)
      .map(async (slot) => ({
        rank: slot.rank,
        players: await Promise.all(
          slot.players.map(async (player) => ({ name: player.name, img: await loadPhoto(player.photo) })),
        ),
      })),
  );

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context를 만들 수 없습니다.");

  const layout = computeLayout(ctx, data, slots);
  drawBackground(ctx, data.accentColor, layout.keepOut);
  drawHeader(ctx, data, layout.headerTop);
  drawTitle(ctx, layout.titleTop);
  drawPodium(ctx, layout);
  drawWinnerGrid(ctx, data.winners, layout);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("카드 이미지를 만들지 못했습니다."))),
      "image/jpeg",
      0.92,
    );
  });
}
