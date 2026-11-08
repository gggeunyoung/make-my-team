"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import { formatAwardPeriodKorean } from "@/lib/award-period-label";
import {
  formatMatchDate,
  matchResultLabel,
  opponentLevelBadgeClass,
  opponentLevelLabel,
  type OpponentLevelValue,
} from "@/lib/player-display";
import { getCurrentQuarterInfo } from "@/lib/player-period";
import { KAKAO_SDK_SRC, KAKAO_TEXT_MAX_LENGTH, initKakaoSdk } from "@/components/kakao-sdk";
import { KakaoShareDialog, type KakaoShareDraft } from "@/components/kakao-share-dialog";
import { renderStatsShareCard, type StatsShareCardData } from "@/components/stats-share-card";
import { TeamLogo } from "@/components/team-logo";

type MatchResult = "WIN" | "DRAW" | "LOSS";

type RankingItem = {
  rank: number;
  id: string;
  name: string;
  photo: string | null;
  value: number;
};

type RankingCategory = {
  key: string;
  title: string;
  items: RankingItem[];
};

type RecentMatchItem = {
  id: string;
  opponentName: string;
  opponentLevel: OpponentLevelValue;
  date: string;
  totalScoreUs: number;
  totalScoreThem: number;
  totalResult: MatchResult;
  countWin: number;
  countDraw: number;
  countLoss: number;
  momName: string | null;
};

type HomeResponse = {
  quarterLabel: string;
  hasQuarterMatches: boolean;
  rankings: RankingCategory[];
  recentMatches: RecentMatchItem[];
};

type TeamHomeTabProps = {
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  teamColor: string | null;
  onMatchClick: (matchId: string) => void;
  /** 순위 카드를 누르면 그 분기·부문의 선수 스탯으로 이동 */
  onRankingClick: (categoryKey: string, quarter: string) => void;
};

/** 카카오톡으로 공유할 부문 (위에서부터 카드 한 줄씩) */
const SHARE_RANKINGS = [
  { key: "goals", label: "골" },
  { key: "assists", label: "도움" },
  { key: "attackPoints", label: "공격포인트" },
  { key: "attack", label: "공격수 랭킹" },
  { key: "defense", label: "수비수 랭킹" },
] as const;

const SHARE_TOP_COUNT = 3;

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
      {message}
    </div>
  );
}

function DefaultPlayerPhoto({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initial = name.trim().charAt(0) || "?";
  const cls = size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-base";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-500 ${cls}`}
    >
      {initial}
    </div>
  );
}

function formatRankingTitle(title: string) {
  return title.replace(/경기당/g, "매치당");
}

/** 공격수/수비수 랭킹은 점수를 보여주지 않는다 */
function isScoreHidden(key: string) {
  return key === "attack" || key === "defense";
}

function formatRankingValue(key: string, value: number) {
  if (key === "attack" || key === "defense") return value.toFixed(2);
  if (key === "goals" || key === "goalsPerMatch") {
    const n = key === "goalsPerMatch" ? value.toFixed(2) : String(value);
    return `${n}골`;
  }
  if (key === "assists" || key === "assistsPerMatch") {
    const n = key === "assistsPerMatch" ? value.toFixed(2) : String(value);
    return `${n}도움`;
  }
  if (key === "attackPoints" || key === "attackPointsPerMatch") {
    const n = key === "attackPointsPerMatch" ? value.toFixed(2) : String(value);
    return `${n}P`;
  }
  if (key === "attendanceRate") return `${value}%`;
  return String(value);
}

function resultAccent(result: MatchResult) {
  if (result === "WIN") {
    return { bar: "bg-emerald-500", badgeBg: "bg-emerald-50", badgeText: "text-emerald-600" };
  }
  if (result === "DRAW") {
    return { bar: "bg-zinc-300", badgeBg: "bg-zinc-100", badgeText: "text-zinc-600" };
  }
  return { bar: "bg-rose-500", badgeBg: "bg-rose-50", badgeText: "text-rose-600" };
}

function getTeamHomeUrl(teamId: string) {
  return `${window.location.origin}/team/${teamId}`;
}

/** 홈 순위는 서버 기준 이번 분기라, 라벨(예: 26년 4분기)에서 기간 값(2026-Q4)을 되살린다. */
function quarterFromLabel(quarterLabel: string) {
  const match = /^(\d{2})년 ([1-4])분기$/.exec(quarterLabel.trim());
  if (match) return `20${match[1]}-Q${match[2]}`;
  const { year, quarter } = getCurrentQuarterInfo();
  return `${year}-Q${quarter}`;
}

function getQuarterStatsUrl(teamId: string, quarter: string) {
  const params = new URLSearchParams({ tab: "stats", period: "QUARTERLY", subPeriod: quarter });
  return `${window.location.origin}/team/${teamId}?${params.toString()}`;
}

function topRankingsByKey(rankings: RankingCategory[]) {
  return new Map(rankings.map((cat) => [cat.key, cat.items.slice(0, SHARE_TOP_COUNT)]));
}

/** 공유 이미지에 그릴 내용: 부문별 1~3위 */
function buildRankingShareCard(
  teamName: string,
  periodLabel: string,
  asOfLabel: string,
  accentColor: string,
  rankings: RankingCategory[],
): StatsShareCardData {
  const topByKey = topRankingsByKey(rankings);
  return {
    teamName,
    periodLabel,
    asOfLabel,
    accentColor,
    rows: SHARE_RANKINGS.map(({ key, label }) => ({
      label,
      entries: (topByKey.get(key) ?? []).map((item) => ({
        rank: item.rank,
        name: item.name,
        photo: item.photo,
        value: isScoreHidden(key) ? null : formatRankingValue(key, item.value),
      })),
    })),
  };
}

/** 카카오톡 메시지 설명(최대 2줄 표시): 기록이 있는 부문의 1위만 */
function buildRankingShareSummary(rankings: RankingCategory[]) {
  const topByKey = topRankingsByKey(rankings);
  return SHARE_RANKINGS.filter(({ key }) => !isScoreHidden(key))
    .flatMap(({ key, label }) => {
      const first = topByKey.get(key)?.[0];
      return first ? [`${label} ${first.name}`] : [];
    })
    .join(" · ");
}

/** 이미지를 올리지 못했을 때 보낼 텍스트 메시지 (카카오 텍스트 템플릿 200자 제한) */
function buildRankingShareMessage(periodLabel: string, asOfLabel: string, rankings: RankingCategory[]) {
  const topByKey = topRankingsByKey(rankings);
  const lines = SHARE_RANKINGS.flatMap(({ key, label }) => {
    const top = topByKey.get(key) ?? [];
    if (top.length === 0) return [];
    const names = top.map((item) => (isScoreHidden(key) ? item.name : `${item.name} ${item.value}`));
    return [`${label} : ${names.join(" · ")}`];
  });

  let message = `${periodLabel} 선수 스탯 순위 (${asOfLabel})`;
  if (lines.length === 0) return message;

  message += "\n----------------";
  for (const line of lines) {
    const next = `${message}\n${line}`;
    if (next.length > KAKAO_TEXT_MAX_LENGTH) break;
    message = next;
  }
  return message;
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="h-4 w-4 text-zinc-500">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"
      />
    </svg>
  );
}

export function TeamHomeTab({
  teamId,
  teamName,
  teamLogo,
  teamColor,
  onMatchClick,
  onRankingClick,
}: TeamHomeTabProps) {
  const accent = teamColor ?? "#3f3f46";
  const [data, setData] = useState<HomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [rankingShareDraft, setRankingShareDraft] = useState<KakaoShareDraft | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/home?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" });
        const json = (await res.json()) as HomeResponse | { message?: string };
        if (cancelled) return;
        if (!res.ok || !("rankings" in json)) {
          setData(null);
          return;
        }
        setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const handleShareHome = async () => {
    if (sharing) return;
    const url = getTeamHomeUrl(teamId);
    setSharing(true);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: teamName,
          text: `${teamName} 홈페이지입니다`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToastMessage("링크가 복사되었습니다");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setToastMessage("링크가 복사되었습니다");
      } catch {
        setToastMessage("공유에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setSharing(false);
    }
  };

  const closeRankingShare = useCallback(() => setRankingShareDraft(null), []);

  const kakaoScript = <Script src={KAKAO_SDK_SRC} strategy="afterInteractive" onReady={initKakaoSdk} />;

  const shareHeader = (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        {teamLogo ? (
          <TeamLogo src={teamLogo} alt={`${teamName} 로고`} className="h-11 w-11 shrink-0" rounded="lg" />
        ) : (
          <div className="h-11 w-11 shrink-0 rounded-lg bg-zinc-100" />
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-zinc-900">{teamName}</p>
          <p className="text-xs text-zinc-500">팀 홈페이지</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleShareHome()}
        disabled={sharing}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
      >
        <ShareIcon />
        팀 홈페이지 공유하기
      </button>
    </div>
  );

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        {kakaoScript}
        {shareHeader}
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">홈 정보를 불러오는 중...</div>
        {toastMessage ? <Toast message={toastMessage} /> : null}
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        {kakaoScript}
        {shareHeader}
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">
          홈 정보를 불러오지 못했습니다.
        </div>
        {toastMessage ? <Toast message={toastMessage} /> : null}
      </section>
    );
  }

  const quarter = quarterFromLabel(data.quarterLabel);
  const canShareRankings =
    data.hasQuarterMatches &&
    data.rankings.some((cat) => cat.items.length > 0 && SHARE_RANKINGS.some(({ key }) => key === cat.key));

  const openRankingShare = () => {
    const periodLabel = formatAwardPeriodKorean("QUARTERLY", quarter);
    const today = new Date();
    const asOfLabel = `${today.getMonth() + 1}월 ${today.getDate()}일 기준`;
    const card = buildRankingShareCard(teamName, periodLabel, asOfLabel, accent, data.rankings);
    setRankingShareDraft({
      heading: "선수 순위 공유",
      url: getQuarterStatsUrl(teamId, quarter),
      imageKey: JSON.stringify(card),
      renderImage: () => renderStatsShareCard(card),
      title: `${periodLabel} 선수 스탯 순위`,
      description: buildRankingShareSummary(data.rankings),
      fallbackText: buildRankingShareMessage(periodLabel, asOfLabel, data.rankings),
      fileName: `${teamName} ${periodLabel} 선수 스탯 순위.jpg`.replace(/[\\/:*?"<>|]/g, ""),
    });
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-10 px-4 py-6">
      {kakaoScript}
      {shareHeader}

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">이번 분기 선수 스탯 순위</h2>
            <p className="text-sm text-zinc-500">{data.quarterLabel}</p>
          </div>
          {canShareRankings ? (
            <button
              type="button"
              onClick={openRankingShare}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <ShareIcon />
              공유하기
            </button>
          ) : null}
        </div>

        {!data.hasQuarterMatches ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-zinc-100 py-10 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
              className="h-8 w-8 text-zinc-300"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.5V21h3v-7.5H3zm7.5-6V21h3V7.5h-3zM18 3v18h3V3h-3z"
              />
            </svg>
            <p className="text-sm font-medium text-zinc-500">이번 분기엔 아직 기록된 매치가 없어요</p>
            <p className="text-xs text-zinc-400">매치를 등록하면 여기에 선수 순위가 표시돼요</p>
          </div>
        ) : (
          <div className="custom-scrollbar flex gap-4 overflow-x-auto pb-2">
            {data.rankings.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => onRankingClick(cat.key, quarter)}
                className="group flex w-56 shrink-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900">{formatRankingTitle(cat.title)}</p>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                {cat.items.length === 0 ? (
                  <p className="text-xs text-zinc-400">데이터 없음</p>
                ) : (
                  <ul className="space-y-3">
                    {cat.items.map((item) => {
                      const hideValue = isScoreHidden(cat.key);

                      return (
                        <li key={item.id} className="flex items-center gap-2">
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: accent }}
                          >
                            {item.rank}
                          </span>
                          {item.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.photo}
                              alt={item.name}
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <DefaultPlayerPhoto name={item.name} size="sm" />
                          )}
                          {hideValue ? (
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                            </div>
                          ) : (
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                              <p className="shrink-0 text-xs font-semibold text-zinc-600">
                                {formatRankingValue(cat.key, item.value)}
                              </p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">최근 매치</h2>
        {data.recentMatches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">
            진행한 매치가 없어요
          </p>
        ) : (
          <div className="custom-scrollbar flex gap-4 overflow-x-auto pb-2">
            {data.recentMatches.map((match) => {
              const matchAccent = resultAccent(match.totalResult);
              return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => onMatchClick(match.id)}
                  className="relative w-72 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 pl-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${matchAccent.bar}`} aria-hidden="true" />

                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-lg font-bold text-zinc-900">
                      <span className="mr-1 text-xs font-semibold text-zinc-400">VS</span>
                      {match.opponentName}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${matchAccent.badgeBg} ${matchAccent.badgeText}`}
                    >
                      {matchResultLabel(match.totalResult)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <p className="text-xs text-zinc-500">{formatMatchDate(match.date)}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${opponentLevelBadgeClass(match.opponentLevel)}`}
                    >
                      상대팀 수준: {opponentLevelLabel(match.opponentLevel)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums text-zinc-900">{match.totalScoreUs}</span>
                    <span className="text-xl font-bold text-zinc-300">:</span>
                    <span className="text-2xl font-bold tabular-nums text-zinc-900">{match.totalScoreThem}</span>
                    <span className="ml-auto text-xs text-zinc-500">
                      {match.countWin}승 {match.countDraw}무 {match.countLoss}패
                    </span>
                  </div>

                  {match.momName ? (
                    <div className="mt-3 flex items-center gap-1.5 border-t border-zinc-100 pt-2">
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-amber-400"
                      >
                        <path d="M10 1.5l2.46 4.99 5.5.8-3.98 3.88.94 5.48L10 13.98l-4.92 2.67.94-5.48L2.04 7.29l5.5-.8L10 1.5z" />
                      </svg>
                      <p className="truncate text-xs text-zinc-500">
                        MOM <span className="font-semibold text-zinc-800">{match.momName}</span>
                      </p>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {rankingShareDraft ? (
        <KakaoShareDialog draft={rankingShareDraft} onClose={closeRankingShare} onToast={setToastMessage} />
      ) : null}
      {toastMessage ? <Toast message={toastMessage} /> : null}
    </section>
  );
}
