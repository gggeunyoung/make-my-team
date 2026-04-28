import { getTeamLogoBucket } from "@/lib/supabase-service";

export function isValidTeamLogoPublicUrl(urlString: string, bucket = getTeamLogoBucket()) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== "https:") {
      return false;
    }
    const prefix = `/storage/v1/object/public/${bucket}/`;
    return u.pathname.startsWith(prefix);
  } catch {
    return false;
  }
}
