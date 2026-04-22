import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { TeamManagerContent } from "@/components/team-manager-content";
import { prisma } from "@/lib/prisma";

type TeamManagerPageProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamManagerPage({ params }: TeamManagerPageProps) {
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

  const email = session?.user?.email?.trim();
  const canManage = Boolean(email && team.admins.includes(email));

  if (!canManage) {
    redirect(`/team/${teamId}`);
  }

  return (
    <TeamManagerContent
      teamId={team.id}
      initialTeam={{
        name: team.name,
        logo: team.logo,
        color: team.color,
        sportType: team.sport_type,
        accessCode: team.access_code,
      }}
    />
  );
}
