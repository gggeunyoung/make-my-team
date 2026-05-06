import { prisma } from "@/lib/prisma";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = req.headers.get("authorization")?.trim() ?? "";
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 1 * 60 * 1000);

  const result = await prisma.tournament.deleteMany({
    where: {
      is_completed: false,
      createdAt: {
        lte: cutoff,
      },
    },
  });

  return Response.json({
    success: true,
    deletedCount: result.count,
    cutoffIso: cutoff.toISOString(),
  });
}
