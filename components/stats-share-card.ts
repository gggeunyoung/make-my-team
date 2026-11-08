import {
  CARD_AMBER,
  SHARE_CARD_SIZE,
  canvasToJpeg,
  cardFont,
  createCardCanvas,
  drawAvatar,
  drawAvatarMedal,
  drawPanel,
  fillCardBackground,
  fitText,
  loadPhoto,
  type CardPlayer,
  type Rect,
} from "@/components/share-card-canvas";

export type StatsShareCardEntry = {
  rank: number;
  name: string;
  photo: string | null;
  /** 기록 (예: 13골). 공격수/수비수 랭킹처럼 점수를 숨기는 부문은 null */
  value: string | null;
};

export type StatsShareCardData = {
  teamName: string;
  periodLabel: string;
  /** 진행 중인 기간이라 언제 기준 순위인지 함께 적는다 (예: 11월 8일 기준) */
  asOfLabel: string;
  accentColor: string;
  /** 부문별 1~3위, 위에서부터 한 줄씩 */
  rows: { label: string; entries: StatsShareCardEntry[] }[];
};

const SIZE = SHARE_CARD_SIZE;
const PADDING_X = 56;
const PADDING_Y = 56;
const HEADER_HEIGHT = 96;
const HEADER_GAP = 36;
const ROW_GAP = 16;
const ROW_RADIUS = 24;
const ROW_PADDING_LEFT = 32;
const ROW_PADDING_RIGHT = 24;
const LABEL_WIDTH = 176;
const LABEL_GAP = 16;
const ENTRIES_PER_ROW = 3;
const AVATAR_DIAMETER = 92;
/** 사진이 작아 시상식 카드보다 메달을 크게 그린다 */
const MEDAL_RATIO = 0.48;
const AVATAR_TEXT_GAP = 16;

type LoadedEntry = StatsShareCardEntry & CardPlayer;
type LoadedRow = { label: string; entries: LoadedEntry[] };

function drawHeader(ctx: CanvasRenderingContext2D, data: StatsShareCardData) {
  const maxWidth = SIZE - PADDING_X * 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 팀 이름이 길면 팀 이름만 줄이고 기준일은 남긴다
  const suffix = data.asOfLabel ? ` · ${data.asOfLabel}` : "";
  ctx.font = cardFont(600, 30);
  const teamName = fitText(ctx, data.teamName, maxWidth - ctx.measureText(suffix).width, 600, 30, 30);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(`${teamName}${suffix}`, SIZE / 2, PADDING_Y + 15);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(fitText(ctx, `${data.periodLabel} 선수 스탯 순위`, maxWidth, 700, 52, 36), SIZE / 2, PADDING_Y + 68);
}

function drawEntry(ctx: CanvasRenderingContext2D, entry: LoadedEntry, x: number, cy: number, width: number) {
  const diameter = AVATAR_DIAMETER;
  const cx = x + diameter / 2;
  drawAvatar(ctx, entry, cx, cy, diameter, { blur: 12, offsetY: 3 });
  drawAvatarMedal(ctx, entry.rank, cx, cy + diameter / 2, diameter, MEDAL_RATIO);

  const textX = x + diameter + AVATAR_TEXT_GAP;
  const maxWidth = width - diameter - AVATAR_TEXT_GAP - 8;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const name = fitText(ctx, entry.name, maxWidth, 700, 34, 22);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name, textX, entry.value ? cy - 18 : cy);

  if (entry.value) {
    const value = fitText(ctx, entry.value, maxWidth, 700, 28, 20);
    ctx.fillStyle = CARD_AMBER;
    ctx.fillText(value, textX, cy + 20);
  }
}

function drawRow(ctx: CanvasRenderingContext2D, row: LoadedRow, rect: Rect) {
  drawPanel(ctx, rect, ROW_RADIUS);

  const cy = rect.y + rect.h / 2;
  const labelX = rect.x + ROW_PADDING_LEFT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const label = fitText(ctx, row.label, LABEL_WIDTH, 700, 30, 22);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, labelX, cy);

  const entriesX = labelX + LABEL_WIDTH + LABEL_GAP;
  const entryWidth = (rect.x + rect.w - ROW_PADDING_RIGHT - entriesX) / ENTRIES_PER_ROW;
  if (row.entries.length === 0) {
    const empty = fitText(ctx, "기록 없음", entryWidth * ENTRIES_PER_ROW, 500, 28, 20);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(empty, entriesX, cy);
    return;
  }
  row.entries.forEach((entry, i) => drawEntry(ctx, entry, entriesX + entryWidth * i, cy, entryWidth));
}

/** 부문별 1~3위 순위표를 1080×1080 JPEG 카드로 그린다. */
export async function renderStatsShareCard(data: StatsShareCardData): Promise<Blob> {
  // 한 선수가 여러 부문에 올라도 사진은 한 번만 불러온다
  const photos = new Map<string, Promise<HTMLImageElement | null>>();
  const photoOf = (src: string | null) => {
    if (!src) return Promise.resolve(null);
    let photo = photos.get(src);
    if (!photo) {
      photo = loadPhoto(src);
      photos.set(src, photo);
    }
    return photo;
  };

  const rows: LoadedRow[] = await Promise.all(
    data.rows.map(async (row) => ({
      label: row.label,
      entries: await Promise.all(
        row.entries
          .slice(0, ENTRIES_PER_ROW)
          .map(async (entry) => ({ ...entry, img: await photoOf(entry.photo) })),
      ),
    })),
  );

  const { canvas, ctx } = createCardCanvas();
  fillCardBackground(ctx, data.accentColor);
  drawHeader(ctx, data);

  const rowsTop = PADDING_Y + HEADER_HEIGHT + HEADER_GAP;
  const count = Math.max(1, rows.length);
  const rowHeight = (SIZE - PADDING_Y - rowsTop - ROW_GAP * (count - 1)) / count;
  rows.forEach((row, i) => {
    drawRow(ctx, row, {
      x: PADDING_X,
      y: rowsTop + i * (rowHeight + ROW_GAP),
      w: SIZE - PADDING_X * 2,
      h: rowHeight,
    });
  });

  return canvasToJpeg(canvas);
}
