import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

function getSportTypeLabel(type: "FUTSAL" | "SOCCER") {
  return type === "FUTSAL" ? "풋살 팀" : "축구 팀";
}

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

  const email = session?.user?.email?.trim();
  const canManage = Boolean(email && team.admins.includes(email));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {team.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo} alt={`${team.name} 로고`} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full" style={{ backgroundColor: team.color ?? "#d4d4d8" }} />
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{team.name}</h1>
            <p className="text-sm text-zinc-600">{getSportTypeLabel(team.sport_type)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-zinc-700">
          <p>생성 연도: {team.createdAt.getFullYear()}</p>
          <p>선수 수: {team.players.length}</p>
        </div>

        {canManage ? (
          <div className="mt-6">
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              매니저 버튼
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
