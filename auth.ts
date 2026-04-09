import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import Naver from "next-auth/providers/naver";

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
