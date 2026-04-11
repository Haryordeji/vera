import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";

const TEST_CLERK_ID = `workflow_test_clerk_${Date.now()}`;

import { vi } from "vitest";

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

import { app } from "../index";
import { PrismaClient } from "../generated/prisma/client";
import { WorkflowStatus } from "../generated/prisma/enums";

const prisma = new PrismaClient();
const AUTH = { "x-test-clerk-user-id": TEST_CLERK_ID };

let physicianId: string;
let patientId: string;
// Main session used for sequential happy-path tests
let sessionId: string;

beforeAll(async () => {
  await prisma.$connect();

  const physician = await prisma.physician.create({
    data: {
      clerkId: TEST_CLERK_ID,
      fullName: "Dr. Workflow Test",
      email: `workflow.${Date.now()}@vera.test`,
    },
  });
  physicianId = physician.id;

  const patient = await prisma.patient.create({
    data: { fullName: "Workflow Patient", mrn: `wf_mrn_${Date.now()}` },
  });
  patientId = patient.id;

  const session = await prisma.session.create({
    data: { physicianId, patientId, status: "IN_REVIEW" },
  });
  sessionId = session.id;

  await prisma.soapNote.create({
    data: {
      sessionId,
      subjective: "Original subjective",
      objective: "Original objective",
      assessment: "Original assessment",
      plan: "Original plan",
      workflowStatus: WorkflowStatus.DRAFT,
    },
  });
});

afterAll(async () => {
  await prisma.soapNote.deleteMany({ where: { session: { physicianId } } });
  await prisma.auditEvent.deleteMany({ where: { session: { physicianId } } });
  await prisma.session.deleteMany({ where: { physicianId } });
  await prisma.patient.delete({ where: { id: patientId } });
  await prisma.physician.delete({ where: { id: physicianId } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// PUT /api/sessions/:id/soap-note
// ---------------------------------------------------------------------------
describe("PUT /api/sessions/:id/soap-note", () => {
  it("saves changes and creates SOAP_EDITED audit event with changedFields metadata", async () => {
    const res = await request(app)
      .put(`/api/sessions/${sessionId}/soap-note`)
      .set(AUTH)
      .send({ subjective: "Updated subjective", plan: "Updated plan" });

    expect(res.status).toBe(200);
    expect(res.body.subjective).toBe("Updated subjective");
    expect(res.body.plan).toBe("Updated plan");
    // Unchanged fields preserved
    expect(res.body.objective).toBe("Original objective");
    expect(res.body.assessment).toBe("Original assessment");

    const event = await prisma.auditEvent.findFirst({
      where: { sessionId, eventType: "SOAP_EDITED" },
      orderBy: { createdAt: "desc" },
    });
    expect(event).toBeTruthy();
    expect(event?.author).toBe("Dr. Workflow Test");
    const meta = event?.metadata as { changedFields: string[] };
    expect(meta.changedFields).toContain("subjective");
    expect(meta.changedFields).toContain("plan");
    expect(meta.changedFields).not.toContain("objective");
  });

  it("returns 401 without auth", async () => {
    const res = await request(app)
      .put(`/api/sessions/${sessionId}/soap-note`)
      .send({ subjective: "x" });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent session", async () => {
    const res = await request(app)
      .put("/api/sessions/00000000-0000-0000-0000-000000000000/soap-note")
      .set(AUTH)
      .send({ subjective: "x" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when SOAP note is APPROVED", async () => {
    // Create a separate session with an APPROVED note
    const approvedSession = await prisma.session.create({
      data: { physicianId, patientId, status: "COMPLETED" },
    });
    await prisma.soapNote.create({
      data: {
        sessionId: approvedSession.id,
        subjective: "s",
        objective: "o",
        assessment: "a",
        plan: "p",
        workflowStatus: WorkflowStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: physicianId,
      },
    });

    const res = await request(app)
      .put(`/api/sessions/${approvedSession.id}/soap-note`)
      .set(AUTH)
      .send({ subjective: "Changed" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/approved/i);

    // Cleanup
    await prisma.soapNote.delete({ where: { sessionId: approvedSession.id } });
    await prisma.session.delete({ where: { id: approvedSession.id } });
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/soap-note/submit-review
// ---------------------------------------------------------------------------
describe("POST /api/sessions/:id/soap-note/submit-review", () => {
  it("transitions DRAFT → PENDING_REVIEW and creates REVIEW_REQUESTED audit event", async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/soap-note/submit-review`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.workflowStatus).toBe("PENDING_REVIEW");

    const event = await prisma.auditEvent.findFirst({
      where: { sessionId, eventType: "REVIEW_REQUESTED" },
    });
    expect(event?.author).toBe("Dr. Workflow Test");
  });

  it("returns 400 when not in DRAFT status (already PENDING_REVIEW)", async () => {
    // sessionId is now PENDING_REVIEW from prior test
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/soap-note/submit-review`)
      .set(AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PENDING_REVIEW/);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post(
      `/api/sessions/${sessionId}/soap-note/submit-review`
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent session", async () => {
    const res = await request(app)
      .post("/api/sessions/00000000-0000-0000-0000-000000000000/soap-note/submit-review")
      .set(AUTH);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/soap-note/approve
// ---------------------------------------------------------------------------
describe("POST /api/sessions/:id/soap-note/approve", () => {
  it("returns 400 when approving from DRAFT (not PENDING_REVIEW)", async () => {
    const draftSession = await prisma.session.create({
      data: { physicianId, patientId, status: "IN_REVIEW" },
    });
    await prisma.soapNote.create({
      data: {
        sessionId: draftSession.id,
        subjective: "s",
        objective: "o",
        assessment: "a",
        plan: "p",
        workflowStatus: WorkflowStatus.DRAFT,
      },
    });

    const res = await request(app)
      .post(`/api/sessions/${draftSession.id}/soap-note/approve`)
      .set(AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/DRAFT/);

    await prisma.soapNote.delete({ where: { sessionId: draftSession.id } });
    await prisma.session.delete({ where: { id: draftSession.id } });
  });

  it("transitions PENDING_REVIEW → APPROVED, sets approvedAt/approvedById, session → COMPLETED", async () => {
    // sessionId is PENDING_REVIEW from submit-review tests above
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/soap-note/approve`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.workflowStatus).toBe("APPROVED");
    expect(res.body.approvedAt).toBeTruthy();
    expect(res.body.approvedById).toBe(physicianId);
    expect(res.body.approvedBy).toBeTruthy();
    expect(res.body.approvedBy.id).toBe(physicianId);

    // Session must be COMPLETED
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(session?.status).toBe("COMPLETED");

    // NOTE_APPROVED audit event
    const event = await prisma.auditEvent.findFirst({
      where: { sessionId, eventType: "NOTE_APPROVED" },
    });
    expect(event?.author).toBe("Dr. Workflow Test");
  });

  it("returns 400 when approving from APPROVED (already approved)", async () => {
    // sessionId is now APPROVED from prior test
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/soap-note/approve`)
      .set(AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/APPROVED/);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post(
      `/api/sessions/${sessionId}/soap-note/approve`
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent session", async () => {
    const res = await request(app)
      .post("/api/sessions/00000000-0000-0000-0000-000000000000/soap-note/approve")
      .set(AUTH);
    expect(res.status).toBe(404);
  });
});
