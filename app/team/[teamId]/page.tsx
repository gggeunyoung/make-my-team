import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { TeamPageTabs } from "@/components/team-page-tabs";
import { formatAwardPeriodKorean } from "@/lib/award-period-label";
import { PERIOD_TYPES, type PeriodType } from "@/lib/player-period";
import { prisma } from "@/lib/prisma";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSiteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

function resolveOgImage(logo: string | null, origin: string) {
  if (logo && (logo.startsWith("http://") || logo.startsWith("https://"))) {
    return logo;
  }
  return `${origin}/og-default.png`;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export async function generateMetadata({ params, searchParams }: TeamPageProps): Promise<Metadata> {
  const { teamId } = await params;
  const query = await searchParams;
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true, logo: true },
  });

  if (!team) {
    return {
      title: "팀을 찾을 수 없습니다",
      description: "요청한 팀 페이지를 찾을 수 없습니다.",
    };
  }

  const origin = getSiteOrigin();
  const tab = firstParam(query.tab).toLowerCase();
  const period = firstParam(query.period);
  const subPeriod = firstParam(query.subPeriod);

  if (tab === "award" && PERIOD_TYPES.includes(period as PeriodType) && subPeriod) {
    const periodLabel = formatAwardPeriodKorean(period as PeriodType, subPeriod);
    const title = `${team.name} ${periodLabel} 시상식`;
    const description = `${periodLabel} 시상식 결과 나왔습니다!!`;
    const ogImage = `${origin}/awards-og-default.png`;
    const pageUrl = `${origin}/team/${teamId}?tab=award&period=${encodeURIComponent(period)}&subPeriod=${encodeURIComponent(subPeriod)}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: pageUrl,
        type: "website",
        images: [
          {
            url: ogImage,
            alt: `${team.name} 시상식`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
    };
  }

  const title = team.name;
  const description = `${team.name} 홈페이지입니다`;
  const ogImage = resolveOgImage(team.logo, origin);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${origin}/team/${teamId}`,
      type: "website",
      images: [
        {
          url: ogImage,
          alt: `${team.name} 로고`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [ogImage],
    },
  };
}

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
