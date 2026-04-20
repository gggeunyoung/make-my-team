import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
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
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-600">Manager 페이지 (준비 중)</section>
    </main>
  );
}
