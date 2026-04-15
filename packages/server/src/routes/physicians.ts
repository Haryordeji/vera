import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

/** GET /api/physicians — list all physicians (id + fullName only). Used by filter UIs. */
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const physicians = await prisma.physician.findMany({
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
    res.json(physicians);
  } catch (err) {
    next(err);
  }
});

export default router;
