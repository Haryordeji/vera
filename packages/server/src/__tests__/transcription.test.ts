import "dotenv/config";
import path from "path";
import fs from "fs";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Mock Clerk — same pattern as other test files
// ---------------------------------------------------------------------------
const TEST_CLERK_ID = `transcribe_test_clerk_${Date.now()}`;

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  requireAuth:
    () => (req: any, res: any, next: any) => {
      const userId = req.headers["x-test-clerk-user-id"] as string | undefined;
      if (!userId) return res.status(401).json({ error: "Unauthenticated" });
      req.__clerkAuth = { userId };
      next();
    },
  getAuth: (req: any) => req.__clerkAuth ?? { userId: null },
  clerkClient: { users: { getUser: vi.fn() } },
}));

// ---------------------------------------------------------------------------
// Mock AssemblyAI — avoid real API calls
// ---------------------------------------------------------------------------
const mockTranscribe = vi.fn();

vi.mock("assemblyai", () => ({
  AssemblyAI: vi.fn().mockImplementation(() => ({
    transcripts: { transcribe: mockTranscribe },
  })),
}));

// ---------------------------------------------------------------------------
// Mock SoapGenerationService — transcribe endpoint auto-chains SOAP gen
// ---------------------------------------------------------------------------
const mockSoapGenerate = vi.fn().mockResolvedValue({
  subjective: "Test subjective",
  objective: "Test objective",
  assessment: "Test assessment",
  plan: "Test plan",
});

vi.mock("../services/soapGeneration", () => ({
  SoapGenerationService: vi.fn().mockImplementation(() => ({
    generate: mockSoapGenerate,
  })),
}));

import { app } from "../index";
import { PrismaClient } from "../generated/prisma/client";
import { TranscriptionService } from "../services/transcription";

const prisma = new PrismaClient();
const AUTH = { "x-test-clerk-user-id": TEST_CLERK_ID };

const UPLOAD_DIR = path.resolve("./uploads");
const FAKE_AUDIO = path.join(UPLOAD_DIR, `transcription_test_${Date.now()}.webm`);

let physicianId: string;
let patientId: string;
let sessionId: string;

beforeAll(async () => {
  await prisma.$connect();

  // Ensure uploads dir exists and create a fake audio file
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(FAKE_AUDIO, "fake audio content");

  const physician = await prisma.physician.create({
    data: {
      clerkId: TEST_CLERK_ID,
      fullName: "Dr. Transcription Test",
      email: `transcription.${Date.now()}@vera.test`,
    },
  });
  physicianId = physician.id;

  const patient = await prisma.patient.create({
    data: { fullName: "Transcript Patient", mrn: `tx_mrn_${Date.now()}` },
  });
  patientId = patient.id;

  const session = await prisma.session.create({
    data: {
      physicianId,
      patientId,
      audioFileUrl: FAKE_AUDIO,
      status: "TRANSCRIBING",
    },
  });
  sessionId = session.id;
});

afterAll(async () => {
  await prisma.soapNote.deleteMany({ where: { session: { physicianId } } });
  await prisma.transcript.deleteMany({ where: { sessionId } });
  await prisma.auditEvent.deleteMany({ where: { session: { physicianId } } });
  await prisma.session.deleteMany({ where: { physicianId } });
  await prisma.patient.delete({ where: { id: patientId } });
  await prisma.physician.delete({ where: { id: physicianId } });
  if (fs.existsSync(FAKE_AUDIO)) fs.unlinkSync(FAKE_AUDIO);
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// TranscriptionService unit tests (AssemblyAI mocked)
// ---------------------------------------------------------------------------
describe("TranscriptionService", () => {
  const makeUtterance = (speaker: string, text: string, start: number, end: number) => ({
    speaker,
    text,
    start,  // ms
    end,
  });

  it("maps first speaker to Doctor, second to Patient", async () => {
    mockTranscribe.mockResolvedValue({
      status: "completed",
      utterances: [
        makeUtterance("A", "Good morning, how are you?", 0, 2500),
        makeUtterance("B", "Not great, I have a cough.", 3000, 5500),
        makeUtterance("A", "How long has it been?", 6000, 8000),
      ],
    });

    const service = new TranscriptionService("test-api-key");
    const result = await service.transcribe("/fake/path.webm");

    expect(result.utterances[0].speaker).toBe("Doctor");
    expect(result.utterances[1].speaker).toBe("Patient");
    expect(result.utterances[2].speaker).toBe("Doctor");
  });

  it("converts milliseconds to seconds", async () => {
    mockTranscribe.mockResolvedValue({
      status: "completed",
      utterances: [makeUtterance("A", "Hello", 1500, 3500)],
    });

    const service = new TranscriptionService("test-api-key");
    const result = await service.transcribe("/fake/path.webm");

    expect(result.utterances[0].start).toBe(1.5);
    expect(result.utterances[0].end).toBe(3.5);
  });

  it("builds plainText as 'Speaker: text' lines joined by double newlines", async () => {
    mockTranscribe.mockResolvedValue({
      status: "completed",
      utterances: [
        makeUtterance("A", "Good morning.", 0, 1000),
        makeUtterance("B", "Hello doctor.", 2000, 3000),
      ],
    });

    const service = new TranscriptionService("test-api-key");
    const result = await service.transcribe("/fake/path.webm");

    expect(result.plainText).toBe("Doctor: Good morning.\n\nPatient: Hello doctor.");
  });

  it("handles empty utterances array gracefully", async () => {
    mockTranscribe.mockResolvedValue({ status: "completed", utterances: [] });

    const service = new TranscriptionService("test-api-key");
    const result = await service.transcribe("/fake/path.webm");

    expect(result.utterances).toHaveLength(0);
    expect(result.plainText).toBe("");
  });

  it("throws when AssemblyAI returns an error status", async () => {
    mockTranscribe.mockResolvedValue({
      status: "error",
      error: "Audio file too short",
    });

    const service = new TranscriptionService("test-api-key");
    await expect(service.transcribe("/fake/path.webm")).rejects.toThrow(
      "Transcription failed: Audio file too short"
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/transcribe endpoint tests
// ---------------------------------------------------------------------------
describe("POST /api/sessions/:id/transcribe", () => {
  const MOCK_UTTERANCES = [
    { speaker: "A", text: "How can I help you today?", start: 0, end: 2000 },
    { speaker: "B", text: "I have a headache.", start: 3000, end: 5000 },
  ];

  beforeAll(() => {
    process.env.ASSEMBLYAI_API_KEY = "test-key-for-route";
    process.env.LLM_API_KEY = "test-llm-key"; // enables SOAP auto-chain
  });

  it("creates Transcript + SOAP note and transitions session to IN_REVIEW", async () => {
    mockTranscribe.mockResolvedValue({
      status: "completed",
      utterances: MOCK_UTTERANCES,
    });

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/transcribe`)
      .set(AUTH);

    expect(res.status).toBe(200);
    // Pipeline chains: TRANSCRIBING → GENERATING_NOTE → IN_REVIEW
    expect(res.body.status).toBe("IN_REVIEW");
    expect(res.body.transcript).toBeTruthy();
    expect(res.body.transcript.plainText).toContain("Doctor:");
    expect(res.body.transcript.plainText).toContain("Patient:");
    // SOAP note auto-generated
    expect(res.body.soapNote).toBeTruthy();
    expect(res.body.soapNote.subjective).toBe("Test subjective");

    // Audit events
    const txEvent = await prisma.auditEvent.findFirst({
      where: { sessionId, eventType: "TRANSCRIPT_GENERATED" },
    });
    expect(txEvent?.author).toBe("System");

    const soapEvent = await prisma.auditEvent.findFirst({
      where: { sessionId, eventType: "SOAP_DRAFT_CREATED" },
    });
    expect(soapEvent?.author).toBe("AI Engine");
  });

  it("returns 400 when session has no audio file", async () => {
    const noAudioSession = await prisma.session.create({
      data: { physicianId, patientId, status: "RECORDING" },
    });

    const res = await request(app)
      .post(`/api/sessions/${noAudioSession.id}/transcribe`)
      .set(AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/audio/i);

    await prisma.session.delete({ where: { id: noAudioSession.id } });
  });

  it("returns 404 for non-existent session", async () => {
    const res = await request(app)
      .post("/api/sessions/00000000-0000-0000-0000-000000000000/transcribe")
      .set(AUTH);
    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post(`/api/sessions/${sessionId}/transcribe`);
    expect(res.status).toBe(401);
  });
});
