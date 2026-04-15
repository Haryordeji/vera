import path from "path";
import fs from "fs";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { getPhysician } from "../lib/getPhysician";
import { requireSessionOwner } from "../lib/requireSessionOwner";
import { SessionStatus, WorkflowStatus } from "../generated/prisma/enums";
import { TranscriptionService } from "../services/transcription";
import { SoapGenerationService } from "../services/soapGeneration";

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, _file, cb) => cb(null, `${req.params.id}.webm`),
});

const upload = multer({ storage });

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

/**
 * GET /api/sessions — list sessions.
 *
 * Query params:
 *   scope=mine (default) → only the current physician's sessions
 *   scope=all            → sessions from all physicians (practice-wide)
 *   physician=<id>       → when scope=all, filter to a specific physician
 *   search=<text>        → filter by patient fullName or mrn (case-insensitive)
 *   status=<SessionStatus> → filter by status
 *   includeArchived=true → include archived sessions (default excludes them)
 */
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

    const scopeParam = (req.query.scope as string | undefined) ?? "mine";
    if (scopeParam !== "mine" && scopeParam !== "all") {
      res.status(400).json({ error: "Invalid scope. Must be 'mine' or 'all'." });
      return;
    }

    const statusFilter = req.query.status as string | undefined;
    const validStatuses = Object.values(SessionStatus) as string[];
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
      return;
    }

    const physicianFilter = req.query.physician as string | undefined;
    const searchRaw = req.query.search as string | undefined;
    const search = searchRaw?.trim();
    const includeArchived = req.query.includeArchived === "true";

    const where: Record<string, unknown> = {};

    if (scopeParam === "mine") {
      where.physicianId = physician.id;
    } else if (physicianFilter) {
      where.physicianId = physicianFilter;
    }

    if (statusFilter) {
      where.status = statusFilter as SessionStatus;
    }

    if (search) {
      where.patient = {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { mrn: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    if (!includeArchived) {
      where.archivedAt = null;
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        patient: true,
        physician: { select: { id: true, fullName: true } },
      },
      orderBy: { recordedAt: "desc" },
    });

    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

/** GET /api/sessions/:id — full session detail with all relations (practice-wide read) */
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
        physician: {
          select: { id: true, fullName: true, credentials: true },
        },
        transcript: true,
        soapNote: { include: { approvedBy: true } },
        vitals: true,
        auditEvents: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json(session);
  } catch (err) {
    next(err);
  }
});

/** POST /api/sessions/:id/upload-audio — accept audio file, update session */
router.post(
  "/:id/upload-audio",
  upload.single("audio"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ error: "Unauthenticated" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      const physician = await getPhysician(userId);
      if (!physician) {
        res.status(400).json({ error: "Physician profile not found." });
        return;
      }

      const ownership = await requireSessionOwner(req.params.id, physician.id);
      if (!ownership.ok) {
        fs.unlink(req.file.path, () => {});
        res.status(ownership.status).json({ error: ownership.error });
        return;
      }

      const audioFileUrl = req.file.path;

      const updated = await prisma.$transaction(async (tx) => {
        const s = await tx.session.update({
          where: { id: ownership.session.id },
          data: {
            audioFileUrl,
            status: SessionStatus.TRANSCRIBING,
          },
          include: { patient: true, physician: true },
        });

        await tx.auditEvent.create({
          data: {
            sessionId: ownership.session.id,
            eventType: "AUDIO_CAPTURED",
            description: "Audio recording uploaded successfully",
            author: physician.fullName,
          },
        });

        return s;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/sessions/:id/transcribe — send audio to AssemblyAI, store transcript */
router.post("/:id/transcribe", async (req: Request, res: Response, next: NextFunction) => {
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

    const ownership = await requireSessionOwner(req.params.id, physician.id);
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: ownership.error });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: ownership.session.id },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (!session.audioFileUrl) {
      res.status(400).json({ error: "Session has no audio file. Upload audio first." });
      return;
    }

    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "ASSEMBLYAI_API_KEY is not configured." });
      return;
    }

    const txService = new TranscriptionService(apiKey);
    const result = await txService.transcribe(session.audioFileUrl);

    // Store transcript + transition to GENERATING_NOTE
    await prisma.$transaction(async (tx) => {
      await tx.transcript.upsert({
        where: { sessionId: session.id },
        create: {
          sessionId: session.id,
          rawDiarizedText: JSON.stringify(result.utterances),
          plainText: result.plainText,
        },
        update: {
          rawDiarizedText: JSON.stringify(result.utterances),
          plainText: result.plainText,
        },
      });
      await tx.session.update({
        where: { id: session.id },
        data: { status: SessionStatus.GENERATING_NOTE },
      });
      await tx.auditEvent.create({
        data: {
          sessionId: session.id,
          eventType: "TRANSCRIPT_GENERATED",
          description: `Transcript generated (${result.utterances.length} utterances)`,
          author: "System",
        },
      });
    });

    // Auto-chain: generate SOAP note from transcript
    const llmKey = process.env.LLM_API_KEY;
    if (llmKey) {
      const soapService = new SoapGenerationService();
      const soap = await soapService.generate(result.plainText);

      await prisma.$transaction(async (tx) => {
        await tx.soapNote.upsert({
          where: { sessionId: session.id },
          create: {
            sessionId: session.id,
            subjective: soap.subjective,
            objective: soap.objective,
            assessment: soap.assessment,
            plan: soap.plan,
          },
          update: {
            subjective: soap.subjective,
            objective: soap.objective,
            assessment: soap.assessment,
            plan: soap.plan,
          },
        });
        await tx.session.update({
          where: { id: session.id },
          data: { status: SessionStatus.IN_REVIEW },
        });
        await tx.auditEvent.create({
          data: {
            sessionId: session.id,
            eventType: "SOAP_DRAFT_CREATED",
            description: "SOAP note draft generated by AI",
            author: "AI Engine",
          },
        });
      });
    }

    // Return fully populated session
    const updated = await prisma.session.findUnique({
      where: { id: session.id },
      include: {
        patient: true,
        physician: true,
        transcript: true,
        soapNote: { include: { approvedBy: true } },
        auditEvents: { orderBy: { createdAt: "asc" } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /api/sessions/:id/generate-soap — generate SOAP note from stored transcript */
router.post("/:id/generate-soap", async (req: Request, res: Response, next: NextFunction) => {
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

    const ownership = await requireSessionOwner(req.params.id, physician.id);
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: ownership.error });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: ownership.session.id },
      include: { transcript: true },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (!session.transcript) {
      res.status(400).json({ error: "Session has no transcript. Transcribe audio first." });
      return;
    }

    if (!process.env.LLM_API_KEY) {
      res.status(500).json({ error: "LLM_API_KEY is not configured." });
      return;
    }

    const soapService = new SoapGenerationService();
    const soap = await soapService.generate(session.transcript.plainText);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.soapNote.upsert({
        where: { sessionId: session.id },
        create: {
          sessionId: session.id,
          subjective: soap.subjective,
          objective: soap.objective,
          assessment: soap.assessment,
          plan: soap.plan,
        },
        update: {
          subjective: soap.subjective,
          objective: soap.objective,
          assessment: soap.assessment,
          plan: soap.plan,
        },
      });

      const s = await tx.session.update({
        where: { id: session.id },
        data: { status: SessionStatus.IN_REVIEW },
        include: {
          patient: true,
          physician: true,
          transcript: true,
          soapNote: { include: { approvedBy: true } },
          auditEvents: { orderBy: { createdAt: "asc" } },
        },
      });

      await tx.auditEvent.create({
        data: {
          sessionId: session.id,
          eventType: "SOAP_DRAFT_CREATED",
          description: "SOAP note draft generated by AI",
          author: "AI Engine",
        },
      });

      return s;
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/sessions/:id/soap-note — edit SOAP note sections */
router.put("/:id/soap-note", async (req: Request, res: Response, next: NextFunction) => {
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

    const ownership = await requireSessionOwner(req.params.id, physician.id);
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: ownership.error });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: ownership.session.id },
      include: { soapNote: true },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (!session.soapNote) {
      res.status(400).json({ error: "Session has no SOAP note." });
      return;
    }

    if (session.soapNote.workflowStatus === WorkflowStatus.APPROVED) {
      res.status(400).json({ error: "Cannot edit an approved SOAP note." });
      return;
    }

    const { subjective, objective, assessment, plan } = req.body as {
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
    };

    // Track which fields actually changed
    const changedFields: string[] = [];
    if (subjective !== undefined && subjective !== session.soapNote.subjective) changedFields.push("subjective");
    if (objective !== undefined && objective !== session.soapNote.objective) changedFields.push("objective");
    if (assessment !== undefined && assessment !== session.soapNote.assessment) changedFields.push("assessment");
    if (plan !== undefined && plan !== session.soapNote.plan) changedFields.push("plan");

    const updateData: Record<string, string> = {};
    if (subjective !== undefined) updateData.subjective = subjective;
    if (objective !== undefined) updateData.objective = objective;
    if (assessment !== undefined) updateData.assessment = assessment;
    if (plan !== undefined) updateData.plan = plan;

    const updatedNote = await prisma.$transaction(async (tx) => {
      const note = await tx.soapNote.update({
        where: { sessionId: session.id },
        data: updateData,
        include: { approvedBy: true },
      });

      await tx.auditEvent.create({
        data: {
          sessionId: session.id,
          eventType: "SOAP_EDITED",
          description: `SOAP note edited by ${physician.fullName}`,
          author: physician.fullName,
          metadata: { changedFields },
        },
      });

      return note;
    });

    res.json(updatedNote);
  } catch (err) {
    next(err);
  }
});

/** POST /api/sessions/:id/soap-note/submit-review — DRAFT → PENDING_REVIEW */
router.post("/:id/soap-note/submit-review", async (req: Request, res: Response, next: NextFunction) => {
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

    const ownership = await requireSessionOwner(req.params.id, physician.id);
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: ownership.error });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: ownership.session.id },
      include: { soapNote: true },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (!session.soapNote) {
      res.status(400).json({ error: "Session has no SOAP note." });
      return;
    }

    if (session.soapNote.workflowStatus !== WorkflowStatus.DRAFT) {
      res.status(400).json({
        error: `Cannot submit for review from status: ${session.soapNote.workflowStatus}`,
      });
      return;
    }

    const updatedNote = await prisma.$transaction(async (tx) => {
      const note = await tx.soapNote.update({
        where: { sessionId: session.id },
        data: { workflowStatus: WorkflowStatus.PENDING_REVIEW },
        include: { approvedBy: true },
      });

      await tx.auditEvent.create({
        data: {
          sessionId: session.id,
          eventType: "REVIEW_REQUESTED",
          description: `Review requested by ${physician.fullName}`,
          author: physician.fullName,
        },
      });

      return note;
    });

    res.json(updatedNote);
  } catch (err) {
    next(err);
  }
});

/** POST /api/sessions/:id/soap-note/approve — PENDING_REVIEW → APPROVED */
router.post("/:id/soap-note/approve", async (req: Request, res: Response, next: NextFunction) => {
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

    const ownership = await requireSessionOwner(req.params.id, physician.id);
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: ownership.error });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: ownership.session.id },
      include: { soapNote: true },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (!session.soapNote) {
      res.status(400).json({ error: "Session has no SOAP note." });
      return;
    }

    if (session.soapNote.workflowStatus !== WorkflowStatus.PENDING_REVIEW) {
      res.status(400).json({
        error: `Cannot approve from status: ${session.soapNote.workflowStatus}`,
      });
      return;
    }

    const updatedNote = await prisma.$transaction(async (tx) => {
      const note = await tx.soapNote.update({
        where: { sessionId: session.id },
        data: {
          workflowStatus: WorkflowStatus.APPROVED,
          approvedAt: new Date(),
          approvedById: physician.id,
        },
        include: { approvedBy: true },
      });

      await tx.session.update({
        where: { id: session.id },
        data: { status: SessionStatus.COMPLETED },
      });

      await tx.auditEvent.create({
        data: {
          sessionId: session.id,
          eventType: "NOTE_APPROVED",
          description: `SOAP note approved by ${physician.fullName}`,
          author: physician.fullName,
        },
      });

      return note;
    });

    res.json(updatedNote);
  } catch (err) {
    next(err);
  }
});

/** POST /api/sessions/:id/archive — soft-delete (owner-only, audit event) */
router.post("/:id/archive", async (req: Request, res: Response, next: NextFunction) => {
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

    const ownership = await requireSessionOwner(req.params.id, physician.id);
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: ownership.error });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.session.update({
        where: { id: ownership.session.id },
        data: { archivedAt: new Date() },
        include: { patient: true, physician: true },
      });

      await tx.auditEvent.create({
        data: {
          sessionId: ownership.session.id,
          eventType: "SESSION_ARCHIVED",
          description: `Visit archived by ${physician.fullName}`,
          author: physician.fullName,
        },
      });

      return s;
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /api/sessions/:id/unarchive — restore (owner-only, audit event) */
router.post("/:id/unarchive", async (req: Request, res: Response, next: NextFunction) => {
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

    const ownership = await requireSessionOwner(req.params.id, physician.id);
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: ownership.error });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.session.update({
        where: { id: ownership.session.id },
        data: { archivedAt: null },
        include: { patient: true, physician: true },
      });

      await tx.auditEvent.create({
        data: {
          sessionId: ownership.session.id,
          eventType: "SESSION_UNARCHIVED",
          description: `Visit restored by ${physician.fullName}`,
          author: physician.fullName,
        },
      });

      return s;
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** GET /api/sessions/:id/audit-events — all audit events for a session, ASC (practice-wide read) */
router.get("/:id/audit-events", async (req: Request, res: Response, next: NextFunction) => {
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
      select: { id: true },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const events = await prisma.auditEvent.findMany({
      where: { sessionId: req.params.id },
      orderBy: { createdAt: "asc" },
    });

    res.json(events);
  } catch (err) {
    next(err);
  }
});

export default router;
