import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

/** POST /api/patients — create a patient */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, dateOfBirth, mrn } = req.body as {
      fullName?: string;
      dateOfBirth?: string;
      mrn?: string;
    };

    if (!fullName?.trim()) {
      res.status(400).json({ error: "fullName is required" });
      return;
    }

    const patient = await prisma.patient.create({
      data: {
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        mrn: mrn?.trim() || null,
      },
    });

    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
});

/** GET /api/patients — list patients, optional ?search= by name or MRN */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string | undefined)?.trim();

    const patients = await prisma.patient.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { mrn: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { fullName: "asc" },
    });

    res.json(patients);
  } catch (err) {
    next(err);
  }
});

/** GET /api/patients/:id — get a single patient */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
    });

    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    res.json(patient);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/patients/:id — update a patient */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, dateOfBirth, mrn } = req.body as {
      fullName?: string;
      dateOfBirth?: string | null;
      mrn?: string | null;
    };

    const existing = await prisma.patient.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: {
        ...(fullName !== undefined && { fullName: fullName.trim() }),
        ...(dateOfBirth !== undefined && {
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        }),
        ...(mrn !== undefined && { mrn: mrn?.trim() || null }),
      },
    });

    res.json(patient);
  } catch (err) {
    next(err);
  }
});

export default router;
