import Image from "next/image";
import { auth } from "@/auth";
import { AuthSection } from "@/components/auth-section";
import { TeamDashboard } from "@/components/team-dashboard";

const FEATURES = [
  {
    src: "/landing/matches.png",
    title: "매치 기록",
    description: "경기 결과와 골, 도움을 간편하게 기록하세요",
  },
  {
    src: "/landing/stats.png",
    title: "자동 스탯 계산",
    description: "선수 스탯, 팀 스탯, 상대 비교까지 자동으로",
  },
  {
    src: "/landing/award.png",
    title: "시상식",
    description: "매달, 매분기 우리 팀만의 MVP를 시상하세요",
  },
] as const;

export default async function Home() {
  const session = await auth();

  if (!session) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <section className="flex flex-col items-center px-4 pb-8 pt-16 sm:pt-24">
          <h1 className="text-center text-2xl font-semibold text-zinc-900 sm:text-3xl">
            ⚽️ 동네프로 ⚽️
          </h1>
          <p className="mt-6 max-w-5xl text-center text-lg font-bold leading-snug text-zinc-900 sm:text-2xl md:text-3xl">
            우리 팀도 EPL처럼
            <br />
            우리 팀만의 홈페이지를 만들고 경기와 스탯을 기록하세요
          </p>
          <div className="mt-8">
            <AuthSection />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {FEATURES.map((feature) => (
              <article key={feature.src} className="flex flex-col gap-4">
                <div className="relative aspect-video overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                  <Image
                    src={feature.src}
                    alt={feature.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="space-y-1.5 px-0.5">
                  <h2 className="text-lg font-semibold text-zinc-900">{feature.title}</h2>
                  <p className="text-sm text-zinc-600">{feature.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
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
