"use client";

import { useState } from "react";
import Link from "next/link";

type TeamPageTabsProps = {
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  teamColor: string | null;
};

type TeamTab = "HOME" | "PLAYERS" | "MATCHES" | "STATS" | "TOURNAMENT" | "AWARD";

const tabs: Array<{ key: TeamTab; label: string }> = [
  { key: "HOME", label: "Home" },
  { key: "PLAYERS", label: "Players" },
  { key: "MATCHES", label: "Matches" },
  { key: "STATS", label: "Stats" },
  { key: "TOURNAMENT", label: "Tournament" },
  { key: "AWARD", label: "Award" },
];

function Placeholder({ title }: { title: string }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-600">{title} 탭 (준비 중)</div>
    </section>
  );
}

export function TeamPageTabs({ teamId, teamName, teamLogo, teamColor }: TeamPageTabsProps) {
  const [activeTab, setActiveTab] = useState<TeamTab>("HOME");

  const tabContent = (() => {
    if (activeTab === "HOME") return <Placeholder title="Home" />;
    if (activeTab === "PLAYERS") return <Placeholder title="Players" />;
    if (activeTab === "MATCHES") return <Placeholder title="Matches" />;
    if (activeTab === "STATS") return <Placeholder title="Stats" />;
    if (activeTab === "TOURNAMENT") return <Placeholder title="Tournament" />;
    return <Placeholder title="Award" />;
  })();

  return (
    <main className="min-h-screen bg-zinc-50">
      <header
        className="sticky top-0 z-20 border-b border-black/10 px-4 py-3"
        style={{ backgroundColor: teamColor ?? "#3f3f46" }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            {teamLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teamLogo} alt={`${teamName} 로고`} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-white/60" />
            )}
            <span className="text-lg font-semibold text-white">{teamName}</span>
          </Link>

          <nav className="flex items-center gap-2">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-white text-zinc-900" : "text-white/90 hover:bg-white/20"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
            <Link
              href={`/team/${teamId}/manager`}
              className="rounded-md px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/20"
            >
              Manager
            </Link>
          </nav>
        </div>
      </header>

      {tabContent}
    </main>
  );
}
