import { prisma } from "./prisma";
import { Physician } from "../generated/prisma/client";

/**
 * Looks up the Physician record for a given Clerk user ID.
 * Returns null if no record exists yet (before /api/auth/sync is called).
 */
export async function getPhysician(clerkId: string): Promise<Physician | null> {
  return prisma.physician.findUnique({ where: { clerkId } });
}
