"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthSection() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <p className="text-sm text-zinc-500" aria-live="polite">
        세션 확인 중…
      </p>
    );
  }

  if (session?.user) {
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <p className="text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">
            {session.user.name ?? "사용자"}
          </span>
          {session.user.email ? (
            <span className="block text-zinc-500">{session.user.email}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col items-stretch gap-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
      <button
        type="button"
        onClick={() => signIn("google")}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Google로 로그인
      </button>
      <button
        type="button"
        onClick={() => signIn("naver")}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#03C75A] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#02b351]"
      >
        <span className="font-bold tracking-tight" aria-hidden>
          N
        </span>
        네이버로 로그인
      </button>
      <button
        type="button"
        onClick={() => signIn("kakao")}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-5 py-2.5 text-sm font-medium text-[#191919] shadow-sm transition hover:bg-[#f0d900]"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#191919"
            d="M12 4C7.03 4 3 7.37 3 11.64c0 3.09 1.79 5.83 4.5 7.32v4.04l4.09-2.24c.33.05.67.08 1.01.08 4.97 0 9-3.37 9-7.64S16.97 4 12 4z"
          />
        </svg>
        카카오로 로그인
      </button>
    </div>
  );
}
