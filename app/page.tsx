import { auth } from "@/auth";
import { AuthSection } from "@/components/auth-section";
import { TeamDashboard } from "@/components/team-dashboard";

export default async function Home() {
  const session = await auth();
  const userEmail = session?.user?.email?.trim();

  if (userEmail) {
    return <TeamDashboard userEmail={userEmail} userName={session?.user?.name} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-center text-2xl font-semibold text-zinc-900 sm:text-3xl">
        ⚽️ 햄토스트 팀 분석 서비스다다닷
      </h1>
      <AuthSection />
    </main>
  );
}
