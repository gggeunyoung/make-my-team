import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { TeamPageTabs } from "@/components/team-page-tabs";
import { prisma } from "@/lib/prisma";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { teamId } = await params;

  const [session, team, matchCount] = await Promise.all([
    auth(),
    prisma.team.findUnique({
      where: { id: teamId },
    }),
    prisma.match.count({
      where: { teamId },
    }),
  ]);

  if (!team) {
    notFound();
  }
  const email = session?.user?.email?.trim();
  const canManage = Boolean(email && team.admins.includes(email));
  const hasNoMatches = matchCount === 0;

  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-50 px-4 py-10">
          <div className="mx-auto max-w-6xl rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">
            팀 페이지를 불러오는 중...
          </div>
        </main>
      }
    >
      <TeamPageTabs
        teamId={team.id}
        teamName={team.name}
        teamLogo={team.logo}
        teamColor={team.color}
        canManage={canManage}
        hasNoMatches={hasNoMatches}
      />
    </Suspense>
  );
}
