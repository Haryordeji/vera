import path from "path";
import fs from "fs";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { getPhysician } from "../lib/getPhysician";
import { SessionStatus } from "../generated/prisma/enums";
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

      const session = await prisma.session.findUnique({
        where: { id: req.params.id },
      });

      if (!session) {
        // Remove uploaded file — session doesn't exist
        fs.unlink(req.file.path, () => {});
        res.status(404).json({ error: "Session not found" });
        return;
      }

      if (session.physicianId !== physician.id) {
        fs.unlink(req.file.path, () => {});
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const audioFileUrl = req.file.path;

      const updated = await prisma.$transaction(async (tx) => {
        const s = await tx.session.update({
          where: { id: session.id },
          data: {
            audioFileUrl,
            status: SessionStatus.TRANSCRIBING,
          },
          include: { patient: true, physician: true },
        });

        await tx.auditEvent.create({
          data: {
            sessionId: session.id,
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

    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
    });

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.physicianId !== physician.id) {
      res.status(403).json({ error: "Forbidden" });
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
        soapNote: true,
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

    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { transcript: true },
    });

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.physicianId !== physician.id) {
      res.status(403).json({ error: "Forbidden" });
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
          soapNote: true,
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

export default router;
