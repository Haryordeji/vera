import { Router, Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { getPhysician } from "../lib/getPhysician";
import { SessionStatus } from "../generated/prisma/enums";

const router = Router();

/** POST /api/sessions — create a session for the authenticated physician */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    const physician = await getPhysician(userId);
    if (!physician) {
      res.status(400).json({
        error: "Physician profile not found. Please complete sign-in setup.",
      });
      return;
    }

    const { patientId } = req.body as { patientId?: string };
    if (!patientId) {
      res.status(400).json({ error: "patientId is required" });
      return;
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const session = await prisma.$transaction(async (tx) => {
      const s = await tx.session.create({
        data: { physicianId: physician.id, patientId, status: SessionStatus.RECORDING },
        include: { patient: true, physician: true },
      });

      await tx.auditEvent.create({
        data: {
          sessionId: s.id,
          eventType: "SESSION_CREATED",
          description: `Visit started for ${patient.fullName}`,
          author: physician.fullName,
        },
      });

      return s;
    });

    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

/** GET /api/sessions — list sessions for the authenticated physician */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    const physician = await getPhysician(userId);
    if (!physician) {
      res.status(400).json({ error: "Physician profile not found." });
      return;
    }

    const statusFilter = req.query.status as string | undefined;
    const validStatuses = Object.values(SessionStatus) as string[];

    if (statusFilter && !validStatuses.includes(statusFilter)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      return;
    }

    const sessions = await prisma.session.findMany({
      where: {
        physicianId: physician.id,
        ...(statusFilter ? { status: statusFilter as SessionStatus } : {}),
      },
      include: { patient: true },
      orderBy: { recordedAt: "desc" },
    });

    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

/** GET /api/sessions/:id — full session detail with all relations */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    const physician = await getPhysician(userId);
    if (!physician) {
      res.status(400).json({ error: "Physician profile not found." });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        patient: true,
        physician: true,
        transcript: true,
        soapNote: true,
        auditEvents: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Physicians can only view their own sessions
    if (session.physicianId !== physician.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(session);
  } catch (err) {
    next(err);
  }
});

export default router;
