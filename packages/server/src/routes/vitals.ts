import { Router, Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { getPhysician } from "../lib/getPhysician";

const router = Router({ mergeParams: true });

interface VitalsBody {
  weightKg?: number | null;
  bloodPressureSys?: number | null;
  bloodPressureDia?: number | null;
  heartRate?: number | null;
  temperatureC?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
}

function pickVitalsFields(body: VitalsBody): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.weightKg !== undefined) data.weightKg = body.weightKg;
  if (body.bloodPressureSys !== undefined) data.bloodPressureSys = body.bloodPressureSys;
  if (body.bloodPressureDia !== undefined) data.bloodPressureDia = body.bloodPressureDia;
  if (body.heartRate !== undefined) data.heartRate = body.heartRate;
  if (body.temperatureC !== undefined) data.temperatureC = body.temperatureC;
  if (body.respiratoryRate !== undefined) data.respiratoryRate = body.respiratoryRate;
  if (body.oxygenSaturation !== undefined) data.oxygenSaturation = body.oxygenSaturation;
  return data;
}

async function loadAuthorizedSession(
  req: Request,
  res: Response
): Promise<{ sessionId: string; physicianName: string } | null> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthenticated" });
    return null;
  }

  const physician = await getPhysician(userId);
  if (!physician) {
    res.status(400).json({ error: "Physician profile not found." });
    return null;
  }

  const sessionId = req.params.id;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return null;
  }

  if (session.physicianId !== physician.id) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  return { sessionId: session.id, physicianName: physician.fullName };
}

/** POST /api/sessions/:id/vitals — record vitals */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = await loadAuthorizedSession(req, res);
    if (!auth) return;

    const existing = await prisma.vitals.findUnique({
      where: { sessionId: auth.sessionId },
    });
    if (existing) {
      res.status(409).json({ error: "Vitals already exist for this session" });
      return;
    }

    const data = pickVitalsFields(req.body as VitalsBody);

    const vitals = await prisma.$transaction(async (tx) => {
      const created = await tx.vitals.create({
        data: { ...data, sessionId: auth.sessionId },
      });

      await tx.auditEvent.create({
        data: {
          sessionId: auth.sessionId,
          eventType: "VITALS_RECORDED",
          description: "Vitals recorded for session",
          author: auth.physicianName,
        },
      });

      return created;
    });

    res.status(201).json(vitals);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/sessions/:id/vitals — update vitals */
router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = await loadAuthorizedSession(req, res);
    if (!auth) return;

    const existing = await prisma.vitals.findUnique({
      where: { sessionId: auth.sessionId },
    });
    if (!existing) {
      res.status(404).json({ error: "Vitals not found for this session" });
      return;
    }

    const data = pickVitalsFields(req.body as VitalsBody);

    const vitals = await prisma.vitals.update({
      where: { sessionId: auth.sessionId },
      data,
    });

    res.json(vitals);
  } catch (err) {
    next(err);
  }
});

export default router;
