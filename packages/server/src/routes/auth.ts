import { Router, Request, Response, NextFunction } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * POST /api/auth/sync
 *
 * Called by the frontend immediately after sign-in.
 * Looks up the Physician record for the authenticated Clerk user.
 * Creates one on first login using the user's name and primary email.
 * Returns the physician record.
 */
router.post("/sync", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    let physician = await prisma.physician.findUnique({
      where: { clerkId: userId },
    });

    if (!physician) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email =
        clerkUser.emailAddresses[0]?.emailAddress ?? `${userId}@unknown`;
      const firstName = clerkUser.firstName ?? "";
      const lastName = clerkUser.lastName ?? "";
      const fullName = `${firstName} ${lastName}`.trim() || email;

      physician = await prisma.physician.create({
        data: { clerkId: userId, fullName, email },
      });
    }

    res.json(physician);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 *
 * Returns the Physician record for the authenticated Clerk user.
 * Used by the frontend to resolve the current physician's id for ownership
 * comparisons (e.g. to decide whether the Active Visit page is read-only).
 */
router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    const physician = await prisma.physician.findUnique({
      where: { clerkId: userId },
    });

    if (!physician) {
      res.status(404).json({ error: "Physician profile not found" });
      return;
    }

    res.json(physician);
  } catch (err) {
    next(err);
  }
});

export default router;
