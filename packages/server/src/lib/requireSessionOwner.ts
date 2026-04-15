import { prisma } from "./prisma";

export type OwnershipResult =
  | { ok: true; session: { id: string; physicianId: string } }
  | { ok: false; status: 404 | 403; error: string };

/**
 * Verifies that the given physician owns the given session.
 * Use on any write endpoint that mutates session-scoped state.
 */
export async function requireSessionOwner(
  sessionId: string,
  physicianId: string
): Promise<OwnershipResult> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, physicianId: true },
  });

  if (!session) {
    return { ok: false, status: 404, error: "Session not found" };
  }

  if (session.physicianId !== physicianId) {
    return {
      ok: false,
      status: 403,
      error: "You can only modify sessions you created",
    };
  }

  return { ok: true, session };
}
