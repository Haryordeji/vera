import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

interface PatientProfileBody {
  fullName?: string;
  dateOfBirth?: string | null;
  mrn?: string | null;
  sex?: string | null;
  heightCm?: number | null;
  eyeColor?: string | null;
  bloodType?: string | null;
}

/** POST /api/patients — create a patient */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      fullName,
      dateOfBirth,
      mrn,
      sex,
      heightCm,
      eyeColor,
      bloodType,
    } = req.body as PatientProfileBody;

    if (!fullName?.trim()) {
      res.status(400).json({ error: "fullName is required" });
      return;
    }

    const patient = await prisma.patient.create({
      data: {
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        mrn: mrn?.trim() || null,
        sex: sex?.trim() || null,
        heightCm: heightCm ?? null,
        eyeColor: eyeColor?.trim() || null,
        bloodType: bloodType?.trim() || null,
      },
    });

    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/patients — list patients with counts.
 *
 * Query params:
 *   search=<text>          → filter by fullName or MRN (case-insensitive)
 *   includeArchived=true   → include archived patients (default excludes them)
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string | undefined)?.trim();
    const includeArchived = req.query.includeArchived === "true";

    const where: Record<string, unknown> = {};
    if (!includeArchived) {
      where.archivedAt = null;
    }
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { mrn: { contains: search, mode: "insensitive" } },
      ];
    }

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: {
        _count: {
          select: { allergies: true, medications: true, sessions: true },
        },
      },
    });

    res.json(patients);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/patients/:id — patient detail with allergies, medications, and sessions.
 *
 * The patient itself is returned even if archived (you need to view it to unarchive it).
 * Nested sessions default to excluding archived; pass ?includeArchived=true to include them.
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeArchived = req.query.includeArchived === "true";

    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        allergies: { orderBy: { createdAt: "asc" } },
        medications: { orderBy: { createdAt: "asc" } },
        sessions: {
          where: includeArchived ? undefined : { archivedAt: null },
          orderBy: { recordedAt: "desc" },
          select: {
            id: true,
            status: true,
            recordedAt: true,
            archivedAt: true,
            physician: { select: { fullName: true } },
            soapNote: { select: { workflowStatus: true } },
          },
        },
      },
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
    const body = req.body as PatientProfileBody;

    const existing = await prisma.patient.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const data: Record<string, unknown> = {};
    if (body.fullName !== undefined) data.fullName = body.fullName.trim();
    if (body.dateOfBirth !== undefined) {
      data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    }
    if (body.mrn !== undefined) data.mrn = body.mrn?.trim() || null;
    if (body.sex !== undefined) data.sex = body.sex?.trim() || null;
    if (body.heightCm !== undefined) data.heightCm = body.heightCm;
    if (body.eyeColor !== undefined) data.eyeColor = body.eyeColor?.trim() || null;
    if (body.bloodType !== undefined) data.bloodType = body.bloodType?.trim() || null;

    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data,
    });

    res.json(patient);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Archive / unarchive
// ---------------------------------------------------------------------------

/** POST /api/patients/:id/archive — soft-delete (hide from default lists) */
router.post("/:id/archive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: { archivedAt: new Date() },
    });

    res.json(patient);
  } catch (err) {
    next(err);
  }
});

/** POST /api/patients/:id/unarchive — restore */
router.post("/:id/unarchive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: { archivedAt: null },
    });

    res.json(patient);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Allergies
// ---------------------------------------------------------------------------

/** POST /api/patients/:id/allergies — add an allergy */
router.post("/:id/allergies", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { name, severity, reaction } = req.body as {
      name?: string;
      severity?: string | null;
      reaction?: string | null;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const allergy = await prisma.allergy.create({
      data: {
        patientId: patient.id,
        name: name.trim(),
        severity: severity?.trim() || null,
        reaction: reaction?.trim() || null,
      },
    });

    res.status(201).json(allergy);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/patients/:id/allergies/:allergyId */
router.delete(
  "/:id/allergies/:allergyId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allergy = await prisma.allergy.findUnique({
        where: { id: req.params.allergyId },
      });

      if (!allergy || allergy.patientId !== req.params.id) {
        res.status(404).json({ error: "Allergy not found" });
        return;
      }

      await prisma.allergy.delete({ where: { id: allergy.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

/** POST /api/patients/:id/medications — add a medication */
router.post("/:id/medications", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { name, dosage, frequency } = req.body as {
      name?: string;
      dosage?: string | null;
      frequency?: string | null;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const medication = await prisma.medication.create({
      data: {
        patientId: patient.id,
        name: name.trim(),
        dosage: dosage?.trim() || null,
        frequency: frequency?.trim() || null,
      },
    });

    res.status(201).json(medication);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/patients/:id/medications/:medicationId — update a medication */
router.put(
  "/:id/medications/:medicationId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.medication.findUnique({
        where: { id: req.params.medicationId },
      });

      if (!existing || existing.patientId !== req.params.id) {
        res.status(404).json({ error: "Medication not found" });
        return;
      }

      const { name, dosage, frequency } = req.body as {
        name?: string;
        dosage?: string | null;
        frequency?: string | null;
      };

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name.trim();
      if (dosage !== undefined) data.dosage = dosage?.trim() || null;
      if (frequency !== undefined) data.frequency = frequency?.trim() || null;

      const medication = await prisma.medication.update({
        where: { id: existing.id },
        data,
      });

      res.json(medication);
    } catch (err) {
      next(err);
    }
  }
);

/** DELETE /api/patients/:id/medications/:medicationId */
router.delete(
  "/:id/medications/:medicationId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const medication = await prisma.medication.findUnique({
        where: { id: req.params.medicationId },
      });

      if (!medication || medication.patientId !== req.params.id) {
        res.status(404).json({ error: "Medication not found" });
        return;
      }

      await prisma.medication.delete({ where: { id: medication.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
