import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

const TEST_CLERK_ID = `audit_test_clerk_${Date.now()}`;

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
const AUTH = { "x-test-clerk-user-id": TEST_CLERK_ID };

let physicianId: string;
let patientId: string;
let sessionId: string;

// Timestamps spread 1 second apart so ordering is deterministic
const T0 = new Date("2026-01-01T10:00:00Z");
const T1 = new Date("2026-01-01T10:00:01Z");
const T2 = new Date("2026-01-01T10:00:02Z");
const T3 = new Date("2026-01-01T10:00:03Z");

beforeAll(async () => {
  await prisma.$connect();

  const physician = await prisma.physician.create({
    data: {
      clerkId: TEST_CLERK_ID,
      fullName: "Dr. Audit Test",
      email: `audit.${Date.now()}@vera.test`,
    },
  });
  physicianId = physician.id;

  const patient = await prisma.patient.create({
    data: { fullName: "Audit Patient", mrn: `audit_mrn_${Date.now()}` },
  });
  patientId = patient.id;

  const session = await prisma.session.create({
    data: { physicianId, patientId, status: "IN_REVIEW" },
  });
  sessionId = session.id;

  // Create events out of insertion order to confirm ordering is by createdAt
  await prisma.auditEvent.create({
    data: {
      sessionId,
      eventType: "TRANSCRIPT_GENERATED",
      description: "Transcript generated",
      author: "System",
      createdAt: T2,
    },
  });
  await prisma.auditEvent.create({
    data: {
      sessionId,
      eventType: "SESSION_CREATED",
      description: "Visit started",
      author: "Dr. Audit Test",
      createdAt: T0,
    },
  });
  await prisma.auditEvent.create({
    data: {
      sessionId,
      eventType: "NOTE_APPROVED",
      description: "SOAP note approved",
      author: "Dr. Audit Test",
      createdAt: T3,
    },
  });
  await prisma.auditEvent.create({
    data: {
      sessionId,
      eventType: "AUDIO_CAPTURED",
      description: "Audio recording uploaded",
      author: "Dr. Audit Test",
      createdAt: T1,
    },
  });
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { sessionId } });
  await prisma.session.delete({ where: { id: sessionId } });
  await prisma.patient.delete({ where: { id: patientId } });
  await prisma.physician.delete({ where: { id: physicianId } });
  await prisma.$disconnect();
});

describe("GET /api/sessions/:id/audit-events", () => {
  it("returns events ordered by createdAt ASC regardless of insertion order", async () => {
    const res = await request(app)
      .get(`/api/sessions/${sessionId}/audit-events`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(4);

    const types = res.body.map((e: any) => e.eventType);
    expect(types).toEqual([
      "SESSION_CREATED",
      "AUDIO_CAPTURED",
      "TRANSCRIPT_GENERATED",
      "NOTE_APPROVED",
    ]);
  });

  it("includes eventType, description, author, createdAt fields", async () => {
    const res = await request(app)
      .get(`/api/sessions/${sessionId}/audit-events`)
      .set(AUTH);

    const first = res.body[0];
    expect(first.eventType).toBe("SESSION_CREATED");
    expect(first.description).toBe("Visit started");
    expect(first.author).toBe("Dr. Audit Test");
    expect(first.createdAt).toBeTruthy();
    expect(first.sessionId).toBe(sessionId);
  });

  it("returns empty array for session with no events", async () => {
    const empty = await prisma.session.create({
      data: { physicianId, patientId, status: "RECORDING" },
    });

    const res = await request(app)
      .get(`/api/sessions/${empty.id}/audit-events`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);

    await prisma.session.delete({ where: { id: empty.id } });
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}/audit-events`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent session", async () => {
    const res = await request(app)
      .get("/api/sessions/00000000-0000-0000-0000-000000000000/audit-events")
      .set(AUTH);
    expect(res.status).toBe(404);
  });

  it("returns 200 for a session belonging to another physician (practice-wide read)", async () => {
    const other = await prisma.physician.create({
      data: {
        clerkId: `other_${Date.now()}`,
        fullName: "Other Doctor",
        email: `other.${Date.now()}@vera.test`,
      },
    });
    const otherSession = await prisma.session.create({
      data: { physicianId: other.id, patientId, status: "RECORDING" },
    });

    const res = await request(app)
      .get(`/api/sessions/${otherSession.id}/audit-events`)
      .set(AUTH); // authenticated as TEST_CLERK_ID, not other doctor

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    await prisma.session.delete({ where: { id: otherSession.id } });
    await prisma.physician.delete({ where: { id: other.id } });
  });
});
