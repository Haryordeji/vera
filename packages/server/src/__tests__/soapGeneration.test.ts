import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

const TEST_CLERK_ID = `soap_test_clerk_${Date.now()}`;

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
// Mock OpenAI client
// ---------------------------------------------------------------------------
const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

import { app } from "../index";
import { PrismaClient } from "../generated/prisma/client";
import { SoapGenerationService, SOAP_SYSTEM_PROMPT } from "../services/soapGeneration";

const prisma = new PrismaClient();
const AUTH = { "x-test-clerk-user-id": TEST_CLERK_ID };

const MOCK_SOAP = {
  subjective: "Patient reports persistent cough for two weeks.",
  objective: "No objective findings documented in this encounter.",
  assessment: "Upper respiratory infection, likely viral.",
  plan: "Rest, fluids, over-the-counter cough suppressant. Follow up in one week if not improving.",
};

const MOCK_LLM_RESPONSE = (content: string) => ({
  choices: [{ message: { content } }],
});

let physicianId: string;
let patientId: string;
let sessionId: string;

beforeAll(async () => {
  await prisma.$connect();
  process.env.LLM_API_KEY = "test-llm-key";

  const physician = await prisma.physician.create({
    data: {
      clerkId: TEST_CLERK_ID,
      fullName: "Dr. SOAP Test",
      email: `soap.${Date.now()}@vera.test`,
    },
  });
  physicianId = physician.id;

  const patient = await prisma.patient.create({
    data: { fullName: "SOAP Patient", mrn: `soap_mrn_${Date.now()}` },
  });
  patientId = patient.id;

  // Session with a transcript already stored
  const session = await prisma.session.create({
    data: {
      physicianId,
      patientId,
      status: "GENERATING_NOTE",
    },
  });
  sessionId = session.id;

  await prisma.transcript.create({
    data: {
      sessionId,
      rawDiarizedText: "[]",
      plainText:
        "Doctor: How can I help you today?\n\nPatient: I have a persistent cough.",
    },
  });
});

afterAll(async () => {
  await prisma.soapNote.deleteMany({ where: { session: { physicianId } } });
  await prisma.transcript.deleteMany({ where: { session: { physicianId } } });
  await prisma.auditEvent.deleteMany({ where: { session: { physicianId } } });
  await prisma.session.deleteMany({ where: { physicianId } });
  await prisma.patient.delete({ where: { id: patientId } });
  await prisma.physician.delete({ where: { id: physicianId } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// SoapGenerationService unit tests
// ---------------------------------------------------------------------------
describe("SoapGenerationService", () => {
  beforeAll(() => mockCreate.mockClear());

  it("returns all four SOAP fields from a valid LLM response", async () => {
    mockCreate.mockResolvedValue(
      MOCK_LLM_RESPONSE(JSON.stringify(MOCK_SOAP))
    );

    const service = new SoapGenerationService();
    const result = await service.generate("Doctor: Hello.\n\nPatient: I feel unwell.");

    expect(result.subjective).toBe(MOCK_SOAP.subjective);
    expect(result.objective).toBe(MOCK_SOAP.objective);
    expect(result.assessment).toBe(MOCK_SOAP.assessment);
    expect(result.plan).toBe(MOCK_SOAP.plan);
  });

  it("sends the SOAP system prompt as the system message", async () => {
    mockCreate.mockResolvedValue(MOCK_LLM_RESPONSE(JSON.stringify(MOCK_SOAP)));

    const service = new SoapGenerationService();
    await service.generate("test transcript");

    const call = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0];
    expect(call.messages[0].role).toBe("system");
    expect(call.messages[0].content).toBe(SOAP_SYSTEM_PROMPT);
  });

  it("includes the transcript in the user message", async () => {
    mockCreate.mockResolvedValue(MOCK_LLM_RESPONSE(JSON.stringify(MOCK_SOAP)));

    const service = new SoapGenerationService();
    const transcript = "Doctor: How are you?\n\nPatient: Not well.";
    await service.generate(transcript);

    const call = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0];
    expect(call.messages[1].role).toBe("user");
    expect(call.messages[1].content).toContain(transcript);
  });

  it("uses response_format json_object", async () => {
    mockCreate.mockResolvedValue(MOCK_LLM_RESPONSE(JSON.stringify(MOCK_SOAP)));

    const service = new SoapGenerationService();
    await service.generate("transcript");

    const call = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0];
    expect(call.response_format).toEqual({ type: "json_object" });
  });

  it("retries once on malformed JSON and succeeds on second attempt", async () => {
    mockCreate.mockClear();
    mockCreate
      .mockResolvedValueOnce(MOCK_LLM_RESPONSE("not valid json {{{"))
      .mockResolvedValueOnce(MOCK_LLM_RESPONSE(JSON.stringify(MOCK_SOAP)));

    const service = new SoapGenerationService();
    const result = await service.generate("transcript");

    expect(result.subjective).toBe(MOCK_SOAP.subjective);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws a descriptive error when both attempts return malformed JSON", async () => {
    mockCreate.mockResolvedValue(MOCK_LLM_RESPONSE("not valid json"));

    const service = new SoapGenerationService();
    await expect(service.generate("transcript")).rejects.toThrow(
      /SOAP generation failed after retry/i
    );
  });

  it("throws on missing required fields in JSON response", async () => {
    mockCreate.mockResolvedValue(
      MOCK_LLM_RESPONSE(JSON.stringify({ subjective: "Only one field" }))
    );

    const service = new SoapGenerationService();
    await expect(service.generate("transcript")).rejects.toThrow(
      /SOAP generation failed after retry/i
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/generate-soap endpoint tests
// ---------------------------------------------------------------------------
describe("POST /api/sessions/:id/generate-soap", () => {
  beforeAll(() => {
    mockCreate.mockReset();
  });

  it("creates SoapNote record, audit event, and transitions to IN_REVIEW", async () => {
    mockCreate.mockResolvedValue(MOCK_LLM_RESPONSE(JSON.stringify(MOCK_SOAP)));

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/generate-soap`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_REVIEW");
    expect(res.body.soapNote).toBeTruthy();
    expect(res.body.soapNote.subjective).toBe(MOCK_SOAP.subjective);
    expect(res.body.soapNote.workflowStatus).toBe("DRAFT");

    const event = await prisma.auditEvent.findFirst({
      where: { sessionId, eventType: "SOAP_DRAFT_CREATED" },
    });
    expect(event?.author).toBe("AI Engine");
  });

  it("returns 400 when session has no transcript", async () => {
    const noTxSession = await prisma.session.create({
      data: { physicianId, patientId, status: "GENERATING_NOTE" },
    });

    const res = await request(app)
      .post(`/api/sessions/${noTxSession.id}/generate-soap`)
      .set(AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/transcript/i);

    await prisma.session.delete({ where: { id: noTxSession.id } });
  });

  it("returns 404 for non-existent session", async () => {
    const res = await request(app)
      .post("/api/sessions/00000000-0000-0000-0000-000000000000/generate-soap")
      .set(AUTH);
    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post(
      `/api/sessions/${sessionId}/generate-soap`
    );
    expect(res.status).toBe(401);
  });
});
