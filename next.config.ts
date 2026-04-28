import type { NextConfig } from "next";

function supabaseStorageRemotePatterns(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const hostname = new URL(raw).hostname;
    return [{ protocol: "https", hostname, pathname: "/storage/v1/object/public/**" }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseStorageRemotePatterns(),
  },
};

export default nextConfig;
