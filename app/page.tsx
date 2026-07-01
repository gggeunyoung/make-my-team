import { auth } from "@/auth";
import { AuthSection } from "@/components/auth-section";
import { TeamDashboard } from "@/components/team-dashboard";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
        <h1 className="text-center text-2xl font-semibold text-zinc-900 sm:text-3xl">
          ⚽️ 동네프로 ⚽️
        </h1>
        <AuthSection />
      </main>
    );
  }

  const user = session.user as
    | (NonNullable<typeof session>["user"] & { providerAccountId?: string })
    | undefined;
  const userEmail = user?.email?.trim();
  const providerAccountId = user?.providerAccountId?.trim();
  const dashboardIdentity = userEmail ?? providerAccountId;

  if (dashboardIdentity) {
    return <TeamDashboard userEmail={dashboardIdentity} userName={session.user?.name} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-center text-2xl font-semibold text-zinc-900 sm:text-3xl">
        ⚽️ 우리 축구/풋살 팀 분석 서비스다다닷
      </h1>
      <AuthSection />
    </main>
  );
}
