import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

const OWNER_CLERK = `xphys_owner_${Date.now()}`;
const OTHER_CLERK = `xphys_other_${Date.now()}`;

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
const OWNER_AUTH = { "x-test-clerk-user-id": OWNER_CLERK };
const OTHER_AUTH = { "x-test-clerk-user-id": OTHER_CLERK };
const NON_OWNER_ERROR = "You can only modify sessions you created";

let ownerId: string;
let otherId: string;
let johnsonPatientId: string;
let garciaPatientId: string;
// Sessions
let ownerDraftSessionId: string; // DRAFT soap note, owned by OWNER
let ownerPendingSessionId: string; // PENDING_REVIEW soap note, owned by OWNER
let ownerVitalsSessionId: string; // no vitals yet, owned by OWNER
let otherSessionId: string; // owned by OTHER — used for non-owner 403 probes
let otherVitalsSessionId: string; // owned by OTHER with existing vitals

beforeAll(async () => {
  await prisma.$connect();

  const owner = await prisma.physician.create({
    data: {
      clerkId: OWNER_CLERK,
      fullName: "Owner Doc",
      email: `owner.${Date.now()}@vera.test`,
    },
  });
  ownerId = owner.id;

  const other = await prisma.physician.create({
    data: {
      clerkId: OTHER_CLERK,
      fullName: "Other Doc",
      email: `other.${Date.now()}@vera.test`,
    },
  });
  otherId = other.id;

  const johnson = await prisma.patient.create({
    data: { fullName: "Sarah Johnson", mrn: `johnson_${Date.now()}` },
  });
  johnsonPatientId = johnson.id;

  const garcia = await prisma.patient.create({
    data: { fullName: "Maria Garcia", mrn: `garcia_${Date.now()}` },
  });
  garciaPatientId = garcia.id;

  // Owner-owned sessions
  const ownerDraft = await prisma.session.create({
    data: { physicianId: ownerId, patientId: johnsonPatientId, status: "IN_REVIEW" },
  });
  ownerDraftSessionId = ownerDraft.id;
  await prisma.soapNote.create({
    data: {
      sessionId: ownerDraftSessionId,
      subjective: "s",
      objective: "o",
      assessment: "a",
      plan: "p",
      workflowStatus: WorkflowStatus.DRAFT,
    },
  });

  const ownerPending = await prisma.session.create({
    data: { physicianId: ownerId, patientId: johnsonPatientId, status: "IN_REVIEW" },
  });
  ownerPendingSessionId = ownerPending.id;
  await prisma.soapNote.create({
    data: {
      sessionId: ownerPendingSessionId,
      subjective: "s",
      objective: "o",
      assessment: "a",
      plan: "p",
      workflowStatus: WorkflowStatus.PENDING_REVIEW,
    },
  });

  const ownerVitals = await prisma.session.create({
    data: { physicianId: ownerId, patientId: johnsonPatientId, status: "RECORDING" },
  });
  ownerVitalsSessionId = ownerVitals.id;

  // Other-owned sessions (used as probes for 403)
  const otherSession = await prisma.session.create({
    data: { physicianId: otherId, patientId: garciaPatientId, status: "IN_REVIEW" },
  });
  otherSessionId = otherSession.id;
  await prisma.soapNote.create({
    data: {
      sessionId: otherSessionId,
      subjective: "s",
      objective: "o",
      assessment: "a",
      plan: "p",
      workflowStatus: WorkflowStatus.DRAFT,
    },
  });

  const otherVitals = await prisma.session.create({
    data: { physicianId: otherId, patientId: garciaPatientId, status: "RECORDING" },
  });
  otherVitalsSessionId = otherVitals.id;
  await prisma.vitals.create({
    data: { sessionId: otherVitalsSessionId, heartRate: 72 },
  });
});

afterAll(async () => {
  const physicianIds = [ownerId, otherId];
  await prisma.auditEvent.deleteMany({
    where: { session: { physicianId: { in: physicianIds } } },
  });
  await prisma.vitals.deleteMany({
    where: { session: { physicianId: { in: physicianIds } } },
  });
  await prisma.soapNote.deleteMany({
    where: { session: { physicianId: { in: physicianIds } } },
  });
  await prisma.session.deleteMany({ where: { physicianId: { in: physicianIds } } });
  await prisma.patient.deleteMany({
    where: { id: { in: [johnsonPatientId, garciaPatientId] } },
  });
  await prisma.physician.deleteMany({ where: { id: { in: physicianIds } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// GET /api/sessions — scope, physician filter, search
// ---------------------------------------------------------------------------
describe("GET /api/sessions scoped queries", () => {
  it("scope=mine (default) returns only the caller's sessions", async () => {
    const res = await request(app).get("/api/sessions").set(OWNER_AUTH);
    expect(res.status).toBe(200);
    const ids = res.body.map((s: any) => s.id);
    expect(ids).toContain(ownerDraftSessionId);
    expect(ids).not.toContain(otherSessionId);
    expect(res.body.every((s: any) => s.physicianId === ownerId)).toBe(true);
  });

  it("explicit scope=mine matches default", async () => {
    const res = await request(app).get("/api/sessions?scope=mine").set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.every((s: any) => s.physicianId === ownerId)).toBe(true);
  });

  it("scope=all returns sessions from multiple physicians", async () => {
    const res = await request(app).get("/api/sessions?scope=all").set(OWNER_AUTH);
    expect(res.status).toBe(200);
    const ids = res.body.map((s: any) => s.id);
    expect(ids).toContain(ownerDraftSessionId);
    expect(ids).toContain(otherSessionId);

    // physician relation is included with id + fullName
    const otherRow = res.body.find((s: any) => s.id === otherSessionId);
    expect(otherRow.physician.id).toBe(otherId);
    expect(otherRow.physician.fullName).toBe("Other Doc");
  });

  it("scope=all&physician=<id> filters to that physician only", async () => {
    const res = await request(app)
      .get(`/api/sessions?scope=all&physician=${otherId}`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((s: any) => s.physicianId === otherId)).toBe(true);
  });

  it("scope=all&search=Johnson matches by patient fullName (case-insensitive)", async () => {
    const res = await request(app)
      .get("/api/sessions?scope=all&search=johnson")
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(
      res.body.every((s: any) => /johnson/i.test(s.patient.fullName))
    ).toBe(true);
  });

  it("scope=all&search=Garcia returns only Garcia's sessions", async () => {
    const res = await request(app)
      .get("/api/sessions?scope=all&search=Garcia")
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    const ids = res.body.map((s: any) => s.id);
    expect(ids).toContain(otherSessionId);
    expect(ids).not.toContain(ownerDraftSessionId);
  });

  it("status filter still works with scope=all", async () => {
    const res = await request(app)
      .get("/api/sessions?scope=all&status=IN_REVIEW")
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.every((s: any) => s.status === "IN_REVIEW")).toBe(true);
  });

  it("invalid scope returns 400", async () => {
    const res = await request(app).get("/api/sessions?scope=bogus").set(OWNER_AUTH);
    expect(res.status).toBe(400);
  });

  it("sessions are ordered by most recent first", async () => {
    const res = await request(app).get("/api/sessions?scope=all").set(OWNER_AUTH);
    for (let i = 1; i < res.body.length; i++) {
      const prev = new Date(res.body[i - 1].recordedAt).getTime();
      const cur = new Date(res.body[i].recordedAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions/:id — cross-physician read
// ---------------------------------------------------------------------------
describe("GET /api/sessions/:id cross-physician read", () => {
  it("any physician can read a session owned by another physician", async () => {
    const res = await request(app)
      .get(`/api/sessions/${otherSessionId}`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(otherSessionId);
    expect(res.body.physician.id).toBe(otherId);
    expect(res.body.physician.fullName).toBe("Other Doc");
    // credentials field is part of the include — present (nullable)
    expect("credentials" in res.body.physician).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Write endpoints — non-owner 403
// ---------------------------------------------------------------------------
describe("Write endpoints reject non-owner with 403", () => {
  it("POST /upload-audio returns 403 for non-owner", async () => {
    const res = await request(app)
      .post(`/api/sessions/${otherSessionId}/upload-audio`)
      .set(OWNER_AUTH)
      .attach("audio", Buffer.from("fake"), {
        filename: "r.webm",
        contentType: "audio/webm",
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NON_OWNER_ERROR);
  });

  it("POST /transcribe returns 403 for non-owner", async () => {
    const res = await request(app)
      .post(`/api/sessions/${otherSessionId}/transcribe`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NON_OWNER_ERROR);
  });

  it("POST /generate-soap returns 403 for non-owner", async () => {
    const res = await request(app)
      .post(`/api/sessions/${otherSessionId}/generate-soap`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NON_OWNER_ERROR);
  });

  it("PUT /soap-note returns 403 for non-owner", async () => {
    const res = await request(app)
      .put(`/api/sessions/${otherSessionId}/soap-note`)
      .set(OWNER_AUTH)
      .send({ subjective: "hijack" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NON_OWNER_ERROR);
  });

  it("POST /soap-note/submit-review returns 403 for non-owner", async () => {
    const res = await request(app)
      .post(`/api/sessions/${otherSessionId}/soap-note/submit-review`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NON_OWNER_ERROR);
  });

  it("POST /soap-note/approve returns 403 for non-owner", async () => {
    const res = await request(app)
      .post(`/api/sessions/${otherSessionId}/soap-note/approve`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NON_OWNER_ERROR);
  });

  it("POST /vitals returns 403 for non-owner", async () => {
    const res = await request(app)
      .post(`/api/sessions/${otherSessionId}/vitals`)
      .set(OWNER_AUTH)
      .send({ heartRate: 80 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NON_OWNER_ERROR);
  });

  it("PUT /vitals returns 403 for non-owner", async () => {
    const res = await request(app)
      .put(`/api/sessions/${otherVitalsSessionId}/vitals`)
      .set(OWNER_AUTH)
      .send({ heartRate: 80 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NON_OWNER_ERROR);
  });
});

// ---------------------------------------------------------------------------
// Write endpoints — owner success paths (covering ones not already in other files)
// ---------------------------------------------------------------------------
describe("Write endpoints succeed for the owning physician", () => {
  it("PUT /soap-note succeeds for the owner", async () => {
    const res = await request(app)
      .put(`/api/sessions/${ownerDraftSessionId}/soap-note`)
      .set(OWNER_AUTH)
      .send({ subjective: "Updated by owner" });
    expect(res.status).toBe(200);
    expect(res.body.subjective).toBe("Updated by owner");
  });

  it("POST /soap-note/submit-review succeeds for the owner", async () => {
    // ownerDraftSessionId still has DRAFT after the PUT above
    const res = await request(app)
      .post(`/api/sessions/${ownerDraftSessionId}/soap-note/submit-review`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.workflowStatus).toBe("PENDING_REVIEW");
  });

  it("POST /soap-note/approve succeeds for the owner", async () => {
    const res = await request(app)
      .post(`/api/sessions/${ownerPendingSessionId}/soap-note/approve`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.workflowStatus).toBe("APPROVED");
  });

  it("POST /vitals succeeds for the owner", async () => {
    const res = await request(app)
      .post(`/api/sessions/${ownerVitalsSessionId}/vitals`)
      .set(OWNER_AUTH)
      .send({ heartRate: 72, bloodPressureSys: 120, bloodPressureDia: 80 });
    expect(res.status).toBe(201);
    expect(res.body.heartRate).toBe(72);
  });

  it("PUT /vitals succeeds for the owner", async () => {
    const res = await request(app)
      .put(`/api/sessions/${ownerVitalsSessionId}/vitals`)
      .set(OWNER_AUTH)
      .send({ heartRate: 68 });
    expect(res.status).toBe(200);
    expect(res.body.heartRate).toBe(68);
  });
});

// ---------------------------------------------------------------------------
// GET /api/physicians
// ---------------------------------------------------------------------------
describe("GET /api/physicians", () => {
  it("returns all physicians with id and fullName", async () => {
    const res = await request(app).get("/api/physicians").set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(ownerId);
    expect(ids).toContain(otherId);

    const ownerRow = res.body.find((p: any) => p.id === ownerId);
    expect(ownerRow.fullName).toBe("Owner Doc");
    // Only id + fullName should be returned
    expect(Object.keys(ownerRow).sort()).toEqual(["fullName", "id"]);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/physicians");
    expect(res.status).toBe(401);
  });
});
