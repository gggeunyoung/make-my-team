import { inspect } from "node:util";

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import Naver from "next-auth/providers/naver";

import { prisma } from "@/lib/prisma";

const googleClientId =
  process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

const naverClientId =
  process.env.AUTH_NAVER_ID ?? process.env.NAVER_CLIENT_ID;
const naverClientSecret =
  process.env.AUTH_NAVER_SECRET ?? process.env.NAVER_CLIENT_SECRET;

const kakaoClientId =
  process.env.AUTH_KAKAO_ID ?? process.env.KAKAO_CLIENT_ID;
const kakaoClientSecret =
  process.env.AUTH_KAKAO_SECRET ?? process.env.KAKAO_CLIENT_SECRET;

/** 네이버는 이름이 profile.response.name 에 옴 (user.name 은 비는 경우가 많음) */
function resolveUsername(
  provider: string | null,
  user: { name?: string | null },
  profile: unknown,
): string | null {
  if (provider === "naver") {
    const p = profile as { response?: { name?: string } } | null | undefined;
    const fromNaver = p?.response?.name?.trim();
    if (fromNaver) return fromNaver;
  }
  return user.name?.trim() || null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  providers: [
    Google({
      clientId: googleClientId ?? "",
      clientSecret: googleClientSecret ?? "",
    }),
    Naver({
      clientId: naverClientId ?? "",
      clientSecret: naverClientSecret ?? "",
    }),
    Kakao({
      clientId: kakaoClientId ?? "",
      clientSecret: kakaoClientSecret ?? "",
    }),
  ],
  trustHost: true,
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("✅ [signIn 콜백] user:", user);
      console.log("✅ [signIn 콜백] account:", account);
      console.log("✅ [signIn 콜백] profile:", profile);

      const email = user.email?.trim() || undefined;
      const provider = account?.provider ?? null;
      const providerAccountId = account?.providerAccountId ?? null;
      const username = resolveUsername(provider, user, profile);

      try {
        if (email) {
          console.log("upsert 시도 (email)");
          await prisma.user.upsert({
            where: { email },
            create: {
              email,
              username,
              provider,
              providerAccountId,
            },
            update: {
              username: username ?? undefined,
              ...(provider != null ? { provider } : {}),
              ...(providerAccountId != null ? { providerAccountId } : {}),
            },
          });
          console.log("✅ [signIn] User upsert 성공 (email):", {
            email,
            provider,
          });
        } else if (provider && providerAccountId) {
          console.log("upsert 시도 (provider + providerAccountId)");
          await prisma.user.upsert({
            where: {
              provider_providerAccountId: {
                provider,
                providerAccountId,
              },
            },
            create: {
              email: null,
              username,
              provider,
              providerAccountId,
            },
            update: {
              username: username ?? undefined,
            },
          });
          console.log("✅ [signIn] User upsert 성공 (provider+providerAccountId):", {
            provider,
            providerAccountId,
          });
        } else {
          console.warn(
            "⚠️ [signIn] 이메일도 없고 provider+providerAccountId도 없어 User upsert를 건너뜁니다.",
          );
        }
      } catch (e) {
        console.error("❌ [signIn] User upsert 실패 (inspect):", inspect(e, { depth: 8, colors: false }));
        if (e instanceof Error) {
          console.error("❌ [signIn] error.name:", e.name);
          console.error("❌ [signIn] error.message:", e.message);
          console.error("❌ [signIn] error.stack:", e.stack);
          if (e.cause !== undefined) {
            console.error("❌ [signIn] error.cause:", inspect(e.cause, { depth: 6, colors: false }));
          }
        }
        const err = e as Record<string, unknown>;
        if (typeof err.code === "string") {
          console.error("❌ [signIn] err.code (Prisma 등):", err.code);
        }
        if (err.meta !== undefined) {
          console.error("❌ [signIn] err.meta:", inspect(err.meta, { depth: 6, colors: false }));
        }
        return false;
      }

      return true;
    },
    async session({ session, token }) {
      console.log("✅ [session 콜백] session:", session);
      return session;
    },
    async jwt({ token, user }) {
      console.log("✅ [jwt 콜백] token:", token);
      return token;
    },
  },
});
