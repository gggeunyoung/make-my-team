import type { PrismaClient } from "@/app/generated/prisma/client";

export async function getPlayerIdsReferencedInTournamentMatches(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<Set<string>> {
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    include: {
      games: {
        include: { goal_events: true },
      },
    },
  });

  const ids = new Set<string>();

  for (const match of matches) {
    for (const pid of match.attendees) {
      if (pid) ids.add(pid);
    }
    for (const game of match.games) {
      for (const pid of [
        ...game.players_all,
        ...game.players_fw,
        ...game.players_mf,
        ...game.players_df,
        ...game.players_gk,
      ]) {
        if (pid) ids.add(pid);
      }
      for (const ev of game.goal_events) {
        if (ev.scorer_type === "PLAYER" && ev.scorer_id) ids.add(ev.scorer_id);
        if (ev.assister_type === "PLAYER" && ev.assister_id) ids.add(ev.assister_id);
      }
    }
  }

  return ids;
}
