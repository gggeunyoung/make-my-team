type SessionLike = {
  user?: {
    email?: string | null;
    provider?: string | null;
    providerAccountId?: string | null;
  } | null;
} | null;

export function getSessionIdentity(session: SessionLike) {
  const user = session?.user;

  return {
    email: user?.email?.trim(),
    provider: user?.provider?.trim(),
    providerAccountId: user?.providerAccountId?.trim(),
  };
}
