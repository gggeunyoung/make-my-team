import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { TeamPageTabs } from "@/components/team-page-tabs";
import { prisma } from "@/lib/prisma";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { teamId } = await params;

  const [session, team] = await Promise.all([
    auth(),
    prisma.team.findUnique({
      where: { id: teamId },
    }),
  ]);

  if (!team) {
    notFound();
  }
  void session;

  return <TeamPageTabs teamId={team.id} teamName={team.name} teamLogo={team.logo} teamColor={team.color} />;
}
