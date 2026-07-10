"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TeamAwardTab } from "@/components/team-award-tab";
import { TeamLogo } from "@/components/team-logo";
import { TeamHomeTab } from "@/components/team-home-tab";
import { TeamMatchesTab } from "@/components/team-matches-tab";
import { TeamPlayersTab } from "@/components/team-players-tab";
import { TeamStatsTab } from "@/components/team-stats-tab";
import { TeamTournamentTab } from "@/components/team-tournament-tab";

type TeamPageTabsProps = {
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  teamColor: string | null;
  canManage: boolean;
  hasNoMatches: boolean;
};

type TeamTab = "HOME" | "PLAYERS" | "MATCHES" | "STATS" | "TOURNAMENT" | "AWARD";

const tabs: Array<{ key: TeamTab; label: string }> = [
  { key: "PLAYERS", label: "Players" },
  { key: "MATCHES", label: "Matches" },
  { key: "STATS", label: "Stats" },
  { key: "TOURNAMENT", label: "Tournament" },
  { key: "AWARD", label: "Award" },
];

const ACTIVE_TAB_LABELS: Record<TeamTab, string> = {
  HOME: "Home",
  PLAYERS: "Players",
  MATCHES: "Matches",
  STATS: "Stats",
  TOURNAMENT: "Tournament",
  AWARD: "Award",
};

const TAB_URL_NAMES: Record<TeamTab, string> = {
  HOME: "home",
  PLAYERS: "players",
  MATCHES: "matches",
  STATS: "stats",
  TOURNAMENT: "tournament",
  AWARD: "award",
};

const URL_NAME_TO_TAB = Object.fromEntries(
  Object.entries(TAB_URL_NAMES).map(([tab, name]) => [name, tab as TeamTab]),
) as Record<string, TeamTab>;

/* Manager tab highlight — canManage && hasNoMatches (designer-tunable) */
const MANAGER_HIGHLIGHT = {
  arrow: "h-3 w-3 shrink-0 animate-bounce text-white",
  tooltip:
    "pointer-events-none fixed z-40 w-max max-w-[11rem] rounded-lg bg-amber-900 px-2.5 py-1.5 text-[10px] font-medium leading-snug text-white shadow-lg",
  tooltipTail: "pointer-events-none fixed z-40 h-2 w-2 rotate-45 bg-amber-900",
  tooltipContent: "relative flex items-start gap-1",
  linkDesktop:
    "rounded-md border border-amber-300 bg-amber-400/25 px-3 py-2 text-sm font-semibold text-white shadow-sm",
  hamburgerButton: "ring-2 ring-amber-300",
  hamburgerBadge: "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-300",
  linkMobile: "border-l-2 border-amber-300 bg-amber-500/20 font-semibold text-white",
} as const;

type ManagerTooltipStyle = {
  top: number;
  right: number;
  tailLeft: number;
};

function parseTabFromUrl(tabParam: string | null): TeamTab {
  if (!tabParam) return "HOME";
  return URL_NAME_TO_TAB[tabParam.toLowerCase()] ?? "HOME";
}

const TOURNAMENT_DRAFT_KEY_PREFIX = "tournament-match-form-draft:";

function findTournamentDraftId(): string | null {
  if (typeof window === "undefined") return null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(TOURNAMENT_DRAFT_KEY_PREFIX)) {
      return key.slice(TOURNAMENT_DRAFT_KEY_PREFIX.length);
    }
  }
  return null;
}

export function TeamPageTabs({
  teamId,
  teamName,
  teamLogo,
  teamColor,
  canManage,
  hasNoMatches,
}: TeamPageTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; right: number } | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const managerLinkRef = useRef<HTMLAnchorElement>(null);
  const draftRedirectDoneRef = useRef(false);
  const [managerTooltipStyle, setManagerTooltipStyle] = useState<ManagerTooltipStyle | null>(null);

  const tabParam = searchParams.get("tab");
  const matchIdParam = searchParams.get("matchId");
  const urlMatchId = matchIdParam?.trim() || null;
  const activeTab = urlMatchId ? "MATCHES" : parseTabFromUrl(tabParam);
  const highlightManager = canManage && hasNoMatches;

  const updateManagerTooltipPosition = useCallback(() => {
    const button = managerLinkRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    setManagerTooltipStyle({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
      tailLeft: rect.left + rect.width / 2 - 4,
    });
  }, []);

  const replaceUrl = useCallback(
    (tab: TeamTab, matchId?: string | null) => {
      const params = new URLSearchParams();
      params.set("tab", TAB_URL_NAMES[tab]);
      if (tab === "MATCHES" && matchId) {
        params.set("matchId", matchId);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const selectTab = useCallback(
    (tab: TeamTab, matchId?: string | null) => {
      replaceUrl(tab, matchId);
      setMobileMenuOpen(false);
    },
    [replaceUrl],
  );

  const handleMobileMenuToggle = () => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
      return;
    }
    const button = mobileMenuButtonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      setDropdownStyle({ top: rect.bottom + 4, right: 16 });
    }
    setMobileMenuOpen(true);
  };

  useEffect(() => {
    if (!highlightManager) return;

    const update = () => updateManagerTooltipPosition();
    const frame = requestAnimationFrame(update);

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    const button = managerLinkRef.current;
    const resizeObserver =
      button && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;
    if (button) {
      resizeObserver?.observe(button);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      resizeObserver?.disconnect();
    };
  }, [highlightManager, updateManagerTooltipPosition]);

  useEffect(() => {
    if (draftRedirectDoneRef.current) return;
    draftRedirectDoneRef.current = true;

    if (!canManage) return;
    if (searchParams.size > 0) return;

    const matchDraftKey = `match-form-draft:${teamId}`;
    if (localStorage.getItem(matchDraftKey)) {
      const params = new URLSearchParams();
      params.set("section", "match");
      params.set("action", "create");
      router.replace(`/team/${teamId}/manager?${params.toString()}`, { scroll: false });
      return;
    }

    const tournamentId = findTournamentDraftId();
    if (tournamentId) {
      const params = new URLSearchParams();
      params.set("section", "tournament");
      params.set("tournamentId", tournamentId);
      params.set("action", "create-match");
      router.replace(`/team/${teamId}/manager?${params.toString()}`, { scroll: false });
    }
  }, [canManage, router, searchParams, teamId]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);

  const tabContent = (() => {
    if (activeTab === "HOME")
      return (
        <TeamHomeTab
          teamId={teamId}
          teamColor={teamColor}
          onMatchClick={(matchId) => replaceUrl("MATCHES", matchId)}
        />
      );
    if (activeTab === "PLAYERS") return <TeamPlayersTab teamId={teamId} teamColor={teamColor} />;
    if (activeTab === "MATCHES")
      return (
        <TeamMatchesTab
          teamId={teamId}
          teamColor={teamColor}
          openMatchId={urlMatchId}
          onMatchOpen={(matchId) => replaceUrl("MATCHES", matchId)}
          onMatchBack={() => replaceUrl("MATCHES")}
        />
      );
    if (activeTab === "STATS") return <TeamStatsTab teamId={teamId} teamColor={teamColor} />;
    if (activeTab === "TOURNAMENT") return <TeamTournamentTab teamId={teamId} teamColor={teamColor} />;
    if (activeTab === "AWARD") return <TeamAwardTab teamId={teamId} teamColor={teamColor} />;
    return null;
  })();

  return (
    <main className="min-h-screen bg-zinc-50">
      <header
        className="sticky top-0 z-20 overflow-x-hidden px-4 py-3.5 shadow-md"
        style={{ backgroundColor: teamColor ?? "#3f3f46" }}
      >
        <div className="mx-auto flex w-full max-w-6xl min-w-0 items-center justify-between gap-2 md:gap-4">
          {canManage ? (
            <Link
              href="/"
              aria-label="대시보드로 이동"
              className="shrink-0 rounded-full px-2 py-1 text-xl font-semibold text-white/90 transition hover:bg-white/20"
            >
              ←
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => selectTab("HOME")}
            className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden md:gap-3"
          >
            {teamLogo ? (
              <TeamLogo
                src={teamLogo}
                alt={`${teamName} 로고`}
                className="h-10 w-10 shrink-0 ring-2 ring-white/30"
                rounded="lg"
              />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-full bg-white/60 ring-2 ring-white/30" />
            )}
            <span className="min-w-0 truncate text-lg font-bold tracking-tight text-white">{teamName}</span>
          </button>

          <nav className="hidden shrink-0 items-center gap-1.5 md:flex">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => selectTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                    active ? "bg-white shadow-sm" : "text-white/80 hover:bg-white/25 hover:text-white"
                  }`}
                  style={active ? { color: teamColor ?? "#3f3f46" } : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
            {canManage ? (
              <Link
                ref={managerLinkRef}
                href={`/team/${teamId}/manager`}
                className={
                  highlightManager
                    ? MANAGER_HIGHLIGHT.linkDesktop
                    : "rounded-full px-4 py-2 text-sm font-semibold text-white/80 transition-all duration-150 hover:bg-white/25 hover:text-white"
                }
              >
                Manager
              </Link>
            ) : null}
          </nav>

          <div ref={mobileMenuRef} className="shrink-0 md:hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{ACTIVE_TAB_LABELS[activeTab]}</span>
              <button
                ref={mobileMenuButtonRef}
                type="button"
                aria-label="메뉴 열기"
                aria-expanded={mobileMenuOpen}
                onClick={handleMobileMenuToggle}
                className={`relative rounded-full px-2 py-1 text-2xl leading-none text-white/90 transition hover:bg-white/20 ${
                  highlightManager ? MANAGER_HIGHLIGHT.hamburgerButton : ""
                }`}
              >
                ≡
                {highlightManager ? <span className={MANAGER_HIGHLIGHT.hamburgerBadge} aria-hidden="true" /> : null}
              </button>
            </div>

            {mobileMenuOpen && dropdownStyle ? (
              <div
                className="fixed z-30 min-w-[10rem] overflow-hidden rounded-lg border border-white/20 bg-zinc-900 py-1 shadow-lg"
                style={{ top: dropdownStyle.top, right: dropdownStyle.right }}
              >
                {tabs.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => selectTab(tab.key)}
                      className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition ${
                        active ? "bg-white/15 text-white" : "text-white/90 hover:bg-white/10"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
                {canManage ? (
                  <Link
                    href={`/team/${teamId}/manager`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-2.5 text-sm font-medium transition ${
                      highlightManager
                        ? MANAGER_HIGHLIGHT.linkMobile
                        : "text-white/90 hover:bg-white/10"
                    }`}
                  >
                    Manager
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {highlightManager && managerTooltipStyle ? (
        <>
          <span
            aria-hidden="true"
            className={MANAGER_HIGHLIGHT.tooltipTail}
            style={{ top: managerTooltipStyle.top - 4, left: managerTooltipStyle.tailLeft }}
          />
          <div
            role="tooltip"
            className={MANAGER_HIGHLIGHT.tooltip}
            style={{ top: managerTooltipStyle.top, right: managerTooltipStyle.right }}
          >
            <div className={MANAGER_HIGHLIGHT.tooltipContent}>
              <svg
                viewBox="0 0 12 12"
                fill="currentColor"
                aria-hidden="true"
                className={MANAGER_HIGHLIGHT.arrow}
              >
                <path d="M6 8.5 2.5 5h7L6 8.5Z" />
              </svg>
              <span>여기서 선수와 매치를 등록하세요</span>
            </div>
          </div>
        </>
      ) : null}

      {tabContent}
    </main>
  );
}
