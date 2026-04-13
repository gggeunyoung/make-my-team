import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TeamDashboard } from "@/components/team-dashboard";

export default async function Home() {
  const session = await auth();
  const userEmail = session?.user?.email?.trim();
  if (!userEmail) {
    redirect("/api/auth/signin");
  }

  return <TeamDashboard userEmail={userEmail} userName={session?.user?.name} />;
}
