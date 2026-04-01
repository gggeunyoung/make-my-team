import { AuthSection } from "@/components/auth-section";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-center text-2xl font-semibold text-zinc-900 sm:text-3xl">
        ⚽️ 햄토스트 팀 분석 서비스
      </h1>
      <AuthSection />
    </main>
  );
}
