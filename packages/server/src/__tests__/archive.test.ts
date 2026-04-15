import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

const OWNER_CLERK = `archive_owner_${Date.now()}`;
const OTHER_CLERK = `archive_other_${Date.now()}`;
const SEED = `archive_test_${Date.now()}`;

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

const prisma = new PrismaClient();
const OWNER_AUTH = { "x-test-clerk-user-id": OWNER_CLERK };
const NON_OWNER_ERROR = "You can only modify sessions you created";

let ownerId: string;
let otherId: string;
let activePatientId: string;
let archivedPatientId: string;
// Sessions
let activeOwnerSessionId: string; // owner, not archived
let archivedOwnerSessionId: string; // owner, archived (seeded)
let otherSessionId: string; // owned by OTHER (for 403 probes)
let archiveFlowSessionId: string; // owner session used to exercise the full archive/unarchive flow

beforeAll(async () => {
  await prisma.$connect();

  // Wipe leftovers from any prior run (including crashed/interrupted ones).
  // Order matters: audit events → sessions → patients → physicians, because
  // of FK constraints. Uses stable prefixes so it catches every historical run.
  const stalePhysicians = await prisma.physician.findMany({
    where: { clerkId: { startsWith: "archive_" } },
    select: { id: true },
  });
  const stalePhysicianIds = stalePhysicians.map((p) => p.id);
  if (stalePhysicianIds.length > 0) {
    await prisma.auditEvent.deleteMany({
      where: { session: { physicianId: { in: stalePhysicianIds } } },
    });
    await prisma.session.deleteMany({
      where: { physicianId: { in: stalePhysicianIds } },
    });
  }
  await prisma.patient.deleteMany({
    where: { mrn: { startsWith: "archive_test_" } },
  });
  if (stalePhysicianIds.length > 0) {
    await prisma.physician.deleteMany({
      where: { id: { in: stalePhysicianIds } },
    });
  }

  const owner = await prisma.physician.create({
    data: {
      clerkId: OWNER_CLERK,
      fullName: "Archive Owner Doc",
      email: `archive.owner.${Date.now()}@vera.test`,
    },
  });
  ownerId = owner.id;

  const other = await prisma.physician.create({
    data: {
      clerkId: OTHER_CLERK,
      fullName: "Archive Other Doc",
      email: `archive.other.${Date.now()}@vera.test`,
    },
  });
  otherId = other.id;

  const active = await prisma.patient.create({
    data: { fullName: "Active Patient", mrn: `${SEED}_active` },
  });
  activePatientId = active.id;

  const archived = await prisma.patient.create({
    data: {
      fullName: "Archived Patient",
      mrn: `${SEED}_archived`,
      archivedAt: new Date(),
    },
  });
  archivedPatientId = archived.id;

  const activeSession = await prisma.session.create({
    data: { physicianId: ownerId, patientId: activePatientId, status: "IN_REVIEW" },
  });
  activeOwnerSessionId = activeSession.id;

  const archivedSession = await prisma.session.create({
    data: {
      physicianId: ownerId,
      patientId: activePatientId,
      status: "COMPLETED",
      archivedAt: new Date(),
    },
  });
  archivedOwnerSessionId = archivedSession.id;

  const otherSession = await prisma.session.create({
    data: { physicianId: otherId, patientId: activePatientId, status: "IN_REVIEW" },
  });
  otherSessionId = otherSession.id;

  const flow = await prisma.session.create({
    data: { physicianId: ownerId, patientId: activePatientId, status: "IN_REVIEW" },
  });
  archiveFlowSessionId = flow.id;
});

afterAll(async () => {
  const physicianIds = [ownerId, otherId];
  await prisma.auditEvent.deleteMany({
    where: { session: { physicianId: { in: physicianIds } } },
  });
  await prisma.session.deleteMany({ where: { physicianId: { in: physicianIds } } });
  await prisma.patient.deleteMany({
    where: { id: { in: [activePatientId, archivedPatientId] } },
  });
  await prisma.physician.deleteMany({ where: { id: { in: physicianIds } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// GET /api/patients — archive filtering
// ---------------------------------------------------------------------------
describe("GET /api/patients archive filtering", () => {
  it("excludes archived patients by default", async () => {
    const res = await request(app).get("/api/patients").set(OWNER_AUTH);
    expect(res.status).toBe(200);
    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(activePatientId);
    expect(ids).not.toContain(archivedPatientId);
  });

  it("includeArchived=true returns archived patients too", async () => {
    const res = await request(app)
      .get("/api/patients?includeArchived=true")
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(activePatientId);
    expect(ids).toContain(archivedPatientId);

    const archivedRow = res.body.find((p: any) => p.id === archivedPatientId);
    expect(archivedRow.archivedAt).toBeTruthy();
  });

  it("archive filter composes with ?search=", async () => {
    // Default excludes archived, so searching for the archived patient's seed should return nothing.
    const defaultRes = await request(app)
      .get(`/api/patients?search=${SEED}_archived`)
      .set(OWNER_AUTH);
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.body).toHaveLength(0);

    // With includeArchived it comes back.
    const withArchived = await request(app)
      .get(`/api/patients?search=${SEED}_archived&includeArchived=true`)
      .set(OWNER_AUTH);
    expect(withArchived.status).toBe(200);
    expect(withArchived.body.length).toBeGreaterThanOrEqual(1);
    expect(withArchived.body[0].id).toBe(archivedPatientId);
  });
});

// ---------------------------------------------------------------------------
// POST /api/patients/:id/archive and /unarchive
// ---------------------------------------------------------------------------
describe("POST /api/patients/:id/archive and /unarchive", () => {
  it("archive sets archivedAt and hides the patient from the default list", async () => {
    const res = await request(app)
      .post(`/api/patients/${activePatientId}/archive`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(activePatientId);
    expect(res.body.archivedAt).toBeTruthy();

    const list = await request(app).get("/api/patients").set(OWNER_AUTH);
    const ids = list.body.map((p: any) => p.id);
    expect(ids).not.toContain(activePatientId);
  });

  it("unarchive clears archivedAt and restores the patient to the default list", async () => {
    const res = await request(app)
      .post(`/api/patients/${activePatientId}/unarchive`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(activePatientId);
    expect(res.body.archivedAt).toBeNull();

    const list = await request(app).get("/api/patients").set(OWNER_AUTH);
    const ids = list.body.map((p: any) => p.id);
    expect(ids).toContain(activePatientId);
  });

  it("archive returns 404 for unknown patient", async () => {
    const res = await request(app)
      .post("/api/patients/00000000-0000-0000-0000-000000000000/archive")
      .set(OWNER_AUTH);
    expect(res.status).toBe(404);
  });

  it("GET /api/patients/:id still returns an archived patient", async () => {
    // archivedPatientId was seeded with archivedAt set and is never unarchived in this file.
    const res = await request(app)
      .get(`/api/patients/${archivedPatientId}`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(archivedPatientId);
    expect(res.body.archivedAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions — archive filtering
// ---------------------------------------------------------------------------
describe("GET /api/sessions archive filtering", () => {
  it("scope=mine excludes archived sessions by default", async () => {
    const res = await request(app).get("/api/sessions").set(OWNER_AUTH);
    expect(res.status).toBe(200);
    const ids = res.body.map((s: any) => s.id);
    expect(ids).toContain(activeOwnerSessionId);
    expect(ids).not.toContain(archivedOwnerSessionId);
  });

  it("scope=mine&includeArchived=true returns archived sessions", async () => {
    const res = await request(app)
      .get("/api/sessions?includeArchived=true")
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    const ids = res.body.map((s: any) => s.id);
    expect(ids).toContain(activeOwnerSessionId);
    expect(ids).toContain(archivedOwnerSessionId);
  });

  it("scope=all excludes archived sessions by default", async () => {
    const res = await request(app).get("/api/sessions?scope=all").set(OWNER_AUTH);
    expect(res.status).toBe(200);
    const ids = res.body.map((s: any) => s.id);
    expect(ids).toContain(activeOwnerSessionId);
    expect(ids).not.toContain(archivedOwnerSessionId);
  });

  it("scope=all&includeArchived=true returns archived sessions practice-wide", async () => {
    const res = await request(app)
      .get("/api/sessions?scope=all&includeArchived=true")
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    const ids = res.body.map((s: any) => s.id);
    expect(ids).toContain(archivedOwnerSessionId);
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/archive and /unarchive
// ---------------------------------------------------------------------------
describe("POST /api/sessions/:id/archive and /unarchive", () => {
  it("returns 403 when a non-owner tries to archive", async () => {
    const res = await request(app)
      .post(`/api/sessions/${otherSessionId}/archive`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NON_OWNER_ERROR);
  });

  it("returns 403 when a non-owner tries to unarchive", async () => {
    const res = await request(app)
      .post(`/api/sessions/${otherSessionId}/unarchive`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NON_OWNER_ERROR);
  });

  it("returns 404 for an unknown session id", async () => {
    const res = await request(app)
      .post("/api/sessions/00000000-0000-0000-0000-000000000000/archive")
      .set(OWNER_AUTH);
    expect(res.status).toBe(404);
  });

  it("owner can archive: sets archivedAt, creates a SESSION_ARCHIVED audit event, hides from default list", async () => {
    const res = await request(app)
      .post(`/api/sessions/${archiveFlowSessionId}/archive`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(archiveFlowSessionId);
    expect(res.body.archivedAt).toBeTruthy();

    const events = await prisma.auditEvent.findMany({
      where: { sessionId: archiveFlowSessionId, eventType: "SESSION_ARCHIVED" },
    });
    expect(events).toHaveLength(1);
    expect(events[0].author).toBe("Archive Owner Doc");

    const list = await request(app).get("/api/sessions").set(OWNER_AUTH);
    const ids = list.body.map((s: any) => s.id);
    expect(ids).not.toContain(archiveFlowSessionId);
  });

  it("owner can unarchive: clears archivedAt, creates a SESSION_UNARCHIVED audit event, restores to default list", async () => {
    const res = await request(app)
      .post(`/api/sessions/${archiveFlowSessionId}/unarchive`)
      .set(OWNER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(archiveFlowSessionId);
    expect(res.body.archivedAt).toBeNull();

    const events = await prisma.auditEvent.findMany({
      where: { sessionId: archiveFlowSessionId, eventType: "SESSION_UNARCHIVED" },
    });
    expect(events).toHaveLength(1);
    expect(events[0].author).toBe("Archive Owner Doc");

    const list = await request(app).get("/api/sessions").set(OWNER_AUTH);
    const ids = list.body.map((s: any) => s.id);
    expect(ids).toContain(archiveFlowSessionId);
  });

  it("patient detail nested sessions exclude archived by default and include them with ?includeArchived=true", async () => {
    // archivedOwnerSessionId is still archived (seeded that way).
    const defaultRes = await request(app)
      .get(`/api/patients/${activePatientId}`)
      .set(OWNER_AUTH);
    expect(defaultRes.status).toBe(200);
    const defaultIds = defaultRes.body.sessions.map((s: any) => s.id);
    expect(defaultIds).not.toContain(archivedOwnerSessionId);

    const withArchived = await request(app)
      .get(`/api/patients/${activePatientId}?includeArchived=true`)
      .set(OWNER_AUTH);
    expect(withArchived.status).toBe(200);
    const allIds = withArchived.body.sessions.map((s: any) => s.id);
    expect(allIds).toContain(archivedOwnerSessionId);
  });
});
