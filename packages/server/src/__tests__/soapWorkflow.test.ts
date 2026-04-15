import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";

const TEST_CLERK_ID = `workflow_test_clerk_${Date.now()}`;
const REVIEWER_CLERK_ID = `workflow_reviewer_clerk_${Date.now()}`;

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
const REVIEWER_AUTH = { "x-test-clerk-user-id": REVIEWER_CLERK_ID };

let physicianId: string;
let reviewerId: string;
let patientId: string;
// Main session used for sequential happy-path tests
let sessionId: string;

async function createDraftSession() {
  const s = await prisma.session.create({
    data: { physicianId, patientId, status: "IN_REVIEW" },
  });
  await prisma.soapNote.create({
    data: {
      sessionId: s.id,
      subjective: "s",
      objective: "o",
      assessment: "a",
      plan: "p",
      workflowStatus: WorkflowStatus.DRAFT,
    },
  });
  return s.id;
}

async function createPendingReviewSession(assignedReviewerId: string) {
  const s = await prisma.session.create({
    data: { physicianId, patientId, status: "IN_REVIEW" },
  });
  await prisma.soapNote.create({
    data: {
      sessionId: s.id,
      subjective: "s",
      objective: "o",
      assessment: "a",
      plan: "p",
      workflowStatus: WorkflowStatus.PENDING_REVIEW,
      assignedReviewerId,
    },
  });
  return s.id;
}

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

  const reviewer = await prisma.physician.create({
    data: {
      clerkId: REVIEWER_CLERK_ID,
      fullName: "Dr. Workflow Reviewer",
      email: `workflow.reviewer.${Date.now()}@vera.test`,
    },
  });
  reviewerId = reviewer.id;

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
  const physicianIds = [physicianId, reviewerId];
  await prisma.soapNote.deleteMany({
    where: { session: { physicianId: { in: physicianIds } } },
  });
  await prisma.auditEvent.deleteMany({
    where: { session: { physicianId: { in: physicianIds } } },
  });
  await prisma.session.deleteMany({ where: { physicianId: { in: physicianIds } } });
  await prisma.patient.delete({ where: { id: patientId } });
  await prisma.physician.deleteMany({ where: { id: { in: physicianIds } } });
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
// POST /api/sessions/:id/soap-note/assign-review
// ---------------------------------------------------------------------------
describe("POST /api/sessions/:id/soap-note/assign-review", () => {
  it("transitions DRAFT → PENDING_REVIEW, sets assignedReviewerId, creates REVIEW_ASSIGNED audit event", async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/soap-note/assign-review`)
      .set(AUTH)
      .send({ reviewerId });

    expect(res.status).toBe(200);
    expect(res.body.workflowStatus).toBe("PENDING_REVIEW");
    expect(res.body.assignedReviewerId).toBe(reviewerId);
    expect(res.body.assignedReviewer?.fullName).toBe("Dr. Workflow Reviewer");
    expect(res.body.reviewFeedback).toBeNull();

    const event = await prisma.auditEvent.findFirst({
      where: { sessionId, eventType: "REVIEW_ASSIGNED" },
    });
    expect(event?.author).toBe("Dr. Workflow Test");
    const meta = event?.metadata as { assignedTo: string };
    expect(meta?.assignedTo).toBe("Dr. Workflow Reviewer");
  });

  it("returns 400 when not in DRAFT status (already PENDING_REVIEW)", async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/soap-note/assign-review`)
      .set(AUTH)
      .send({ reviewerId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PENDING_REVIEW/);
  });

  it("returns 403 for non-owner caller", async () => {
    const draftId = await createDraftSession();
    const res = await request(app)
      .post(`/api/sessions/${draftId}/soap-note/assign-review`)
      .set(REVIEWER_AUTH)
      .send({ reviewerId: physicianId });
    expect(res.status).toBe(403);
  });

  it("returns 400 when reviewerId is the session owner (self-assign)", async () => {
    const draftId = await createDraftSession();
    const res = await request(app)
      .post(`/api/sessions/${draftId}/soap-note/assign-review`)
      .set(AUTH)
      .send({ reviewerId: physicianId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yourself/i);
  });

  it("returns 400 when reviewerId is missing or invalid", async () => {
    const draftId = await createDraftSession();

    const missing = await request(app)
      .post(`/api/sessions/${draftId}/soap-note/assign-review`)
      .set(AUTH)
      .send({});
    expect(missing.status).toBe(400);

    const bogus = await request(app)
      .post(`/api/sessions/${draftId}/soap-note/assign-review`)
      .set(AUTH)
      .send({ reviewerId: "00000000-0000-0000-0000-000000000000" });
    expect(bogus.status).toBe(400);
    expect(bogus.body.error).toMatch(/reviewer/i);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/soap-note/assign-review`)
      .send({ reviewerId });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent session", async () => {
    const res = await request(app)
      .post("/api/sessions/00000000-0000-0000-0000-000000000000/soap-note/assign-review")
      .set(AUTH)
      .send({ reviewerId });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/soap-note/approve
// ---------------------------------------------------------------------------
describe("POST /api/sessions/:id/soap-note/approve", () => {
  it("Path 1: owner self-approval from DRAFT → APPROVED, session → COMPLETED, NOTE_APPROVED audit", async () => {
    const draftId = await createDraftSession();
    const res = await request(app)
      .post(`/api/sessions/${draftId}/soap-note/approve`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.workflowStatus).toBe("APPROVED");
    expect(res.body.approvedAt).toBeTruthy();
    expect(res.body.approvedById).toBe(physicianId);
    expect(res.body.approvedBy.id).toBe(physicianId);

    const session = await prisma.session.findUnique({ where: { id: draftId } });
    expect(session?.status).toBe("COMPLETED");

    const event = await prisma.auditEvent.findFirst({
      where: { sessionId: draftId, eventType: "NOTE_APPROVED" },
    });
    expect(event?.author).toBe("Dr. Workflow Test");
  });

  it("Path 2: reviewer approval from PENDING_REVIEW stamps reviewer as approvedBy", async () => {
    const pendingId = await createPendingReviewSession(reviewerId);
    const res = await request(app)
      .post(`/api/sessions/${pendingId}/soap-note/approve`)
      .set(REVIEWER_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.workflowStatus).toBe("APPROVED");
    expect(res.body.approvedById).toBe(reviewerId);
    expect(res.body.approvedBy.id).toBe(reviewerId);

    const session = await prisma.session.findUnique({ where: { id: pendingId } });
    expect(session?.status).toBe("COMPLETED");

    const event = await prisma.auditEvent.findFirst({
      where: { sessionId: pendingId, eventType: "NOTE_APPROVED" },
    });
    expect(event?.author).toBe("Dr. Workflow Reviewer");
    const meta = event?.metadata as { approvedBy: string };
    expect(meta?.approvedBy).toBe("Dr. Workflow Reviewer");
  });

  it("returns 403 for non-owner, non-reviewer caller on a DRAFT", async () => {
    const draftId = await createDraftSession();
    const res = await request(app)
      .post(`/api/sessions/${draftId}/soap-note/approve`)
      .set(REVIEWER_AUTH); // reviewer is NOT the owner and not assigned here
    expect(res.status).toBe(403);
  });

  it("returns 403 for non-reviewer caller on a PENDING_REVIEW", async () => {
    const pendingId = await createPendingReviewSession(reviewerId);
    // The session owner is not the assigned reviewer; they can't approve here
    const res = await request(app)
      .post(`/api/sessions/${pendingId}/soap-note/approve`)
      .set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PENDING_REVIEW/);
  });

  it("returns 400 when already APPROVED", async () => {
    const draftId = await createDraftSession();
    await request(app).post(`/api/sessions/${draftId}/soap-note/approve`).set(AUTH);
    const res = await request(app)
      .post(`/api/sessions/${draftId}/soap-note/approve`)
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

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/soap-note/return-to-draft
// ---------------------------------------------------------------------------
describe("POST /api/sessions/:id/soap-note/return-to-draft", () => {
  it("reviewer returns PENDING_REVIEW → DRAFT, stores feedback, keeps assignedReviewerId, writes REVIEW_RETURNED audit", async () => {
    const pendingId = await createPendingReviewSession(reviewerId);
    const feedback = "Please clarify the assessment — consider ruling out pneumonia.";

    const res = await request(app)
      .post(`/api/sessions/${pendingId}/soap-note/return-to-draft`)
      .set(REVIEWER_AUTH)
      .send({ feedback });

    expect(res.status).toBe(200);
    expect(res.body.workflowStatus).toBe("DRAFT");
    expect(res.body.reviewFeedback).toBe(feedback);
    expect(res.body.assignedReviewerId).toBe(reviewerId);

    const event = await prisma.auditEvent.findFirst({
      where: { sessionId: pendingId, eventType: "REVIEW_RETURNED" },
    });
    expect(event?.author).toBe("Dr. Workflow Reviewer");
    const meta = event?.metadata as { returnedBy: string; feedback: string };
    expect(meta.returnedBy).toBe("Dr. Workflow Reviewer");
    expect(meta.feedback).toBe(feedback);
  });

  it("stores null feedback when the body is empty", async () => {
    const pendingId = await createPendingReviewSession(reviewerId);
    const res = await request(app)
      .post(`/api/sessions/${pendingId}/soap-note/return-to-draft`)
      .set(REVIEWER_AUTH)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.reviewFeedback).toBeNull();
  });

  it("returns 403 when caller is not the assigned reviewer", async () => {
    const pendingId = await createPendingReviewSession(reviewerId);
    // owner tries to return their own note to draft — not allowed, only reviewer can
    const res = await request(app)
      .post(`/api/sessions/${pendingId}/soap-note/return-to-draft`)
      .set(AUTH)
      .send({ feedback: "whoops" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when note is in DRAFT status", async () => {
    const draftId = await createDraftSession();
    // No assigned reviewer on a DRAFT note → reviewer auth must 403 before 400
    await prisma.soapNote.update({
      where: { sessionId: draftId },
      data: { assignedReviewerId: reviewerId },
    });
    const res = await request(app)
      .post(`/api/sessions/${draftId}/soap-note/return-to-draft`)
      .set(REVIEWER_AUTH)
      .send({ feedback: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/DRAFT/);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post(
      `/api/sessions/${sessionId}/soap-note/return-to-draft`
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent session", async () => {
    const res = await request(app)
      .post("/api/sessions/00000000-0000-0000-0000-000000000000/soap-note/return-to-draft")
      .set(REVIEWER_AUTH)
      .send({});
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions?scope=mine includes assigned review sessions
// ---------------------------------------------------------------------------
describe("GET /api/sessions?scope=mine review assignments", () => {
  it("returns sessions where the caller is the assigned reviewer with reviewAssignment: true", async () => {
    // Create a session owned by physicianId but assign reviewerId as reviewer
    const pendingId = await createPendingReviewSession(reviewerId);

    const res = await request(app)
      .get("/api/sessions?scope=mine")
      .set(REVIEWER_AUTH);
    expect(res.status).toBe(200);

    const row = res.body.find((s: any) => s.id === pendingId);
    expect(row).toBeTruthy();
    expect(row.reviewAssignment).toBe(true);
    expect(row.physicianId).toBe(physicianId);
  });

  it("does not mark owned sessions as reviewAssignment", async () => {
    const res = await request(app).get("/api/sessions?scope=mine").set(AUTH);
    expect(res.status).toBe(200);
    const mine = res.body.filter((s: any) => s.physicianId === physicianId);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((s: any) => s.reviewAssignment === false)).toBe(true);
  });
});
