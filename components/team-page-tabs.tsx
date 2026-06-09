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

function parseTabFromUrl(tabParam: string | null): TeamTab {
  if (!tabParam) return "HOME";
  return URL_NAME_TO_TAB[tabParam.toLowerCase()] ?? "HOME";
}

export function TeamPageTabs({ teamId, teamName, teamLogo, teamColor, canManage }: TeamPageTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; right: number } | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const tabParam = searchParams.get("tab");
  const matchIdParam = searchParams.get("matchId");
  const urlMatchId = matchIdParam?.trim() || null;
  const activeTab = urlMatchId ? "MATCHES" : parseTabFromUrl(tabParam);

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
        className="sticky top-0 z-20 overflow-x-hidden border-b border-black/10 px-4 py-3"
        style={{ backgroundColor: teamColor ?? "#3f3f46" }}
      >
        <div className="mx-auto flex w-full max-w-6xl min-w-0 items-center justify-between gap-2 md:gap-4">
          {canManage ? (
            <Link
              href="/"
              aria-label="대시보드로 이동"
              className="shrink-0 rounded-md px-2 py-1 text-xl font-semibold text-white/90 transition hover:bg-white/20"
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
              <TeamLogo src={teamLogo} alt={`${teamName} 로고`} className="h-10 w-10 shrink-0" rounded="lg" />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-full bg-white/60" />
            )}
            <span className="min-w-0 truncate text-lg font-semibold text-white">{teamName}</span>
          </button>

          <nav className="hidden shrink-0 items-center gap-2 md:flex">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => selectTab(tab.key)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${active ? "bg-white text-zinc-900" : "text-white/90 hover:bg-white/20"
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
            {canManage ? (
              <Link
                href={`/team/${teamId}/manager`}
                className="rounded-md px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/20"
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
                className="rounded-md px-2 py-1 text-2xl leading-none text-white/90 transition hover:bg-white/20"
              >
                ≡
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
                    className="block px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
                  >
                    Manager
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {tabContent}
    </main>
  );
}
