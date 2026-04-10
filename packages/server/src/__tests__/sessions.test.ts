import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

const TEST_CLERK_ID = `sessions_test_clerk_${Date.now()}`;

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

beforeAll(async () => {
  await prisma.$connect();

  const physician = await prisma.physician.create({
    data: {
      clerkId: TEST_CLERK_ID,
      fullName: "Dr. Sessions Test",
      email: `sessions.${Date.now()}@vera.test`,
    },
  });
  physicianId = physician.id;

  const patient = await prisma.patient.create({
    data: { fullName: "Sessions Patient", mrn: `sess_mrn_${Date.now()}` },
  });
  patientId = patient.id;
});

afterAll(async () => {
  // Delete in dependency order
  await prisma.auditEvent.deleteMany({ where: { session: { physicianId } } });
  await prisma.session.deleteMany({ where: { physicianId } });
  await prisma.patient.delete({ where: { id: patientId } });
  await prisma.physician.delete({ where: { id: physicianId } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// POST /api/sessions
// ---------------------------------------------------------------------------
describe("POST /api/sessions", () => {
  it("creates a session linked to physician and patient", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set(AUTH)
      .send({ patientId });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.status).toBe("RECORDING");
    expect(res.body.patientId).toBe(patientId);
    expect(res.body.physicianId).toBe(physicianId);
    expect(res.body.patient.fullName).toBe("Sessions Patient");

    sessionId = res.body.id;
  });

  it("creates an initial SESSION_CREATED audit event", async () => {
    const events = await prisma.auditEvent.findMany({
      where: { sessionId, eventType: "SESSION_CREATED" },
    });
    expect(events).toHaveLength(1);
    expect(events[0].author).toBe("Dr. Sessions Test");
  });

  it("returns 400 when patientId is missing", async () => {
    const res = await request(app).post("/api/sessions").set(AUTH).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/patientId/i);
  });

  it("returns 404 when patientId does not exist", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set(AUTH)
      .send({ patientId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/sessions").send({ patientId });
    expect(res.status).toBe(401);
  });

  it("returns 400 when physician has no profile", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set({ "x-test-clerk-user-id": "no_profile_user" })
      .send({ patientId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/physician/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions
// ---------------------------------------------------------------------------
describe("GET /api/sessions", () => {
  it("returns sessions for the authenticated physician", async () => {
    const res = await request(app).get("/api/sessions").set(AUTH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const session = res.body.find((s: any) => s.id === sessionId);
    expect(session).toBeDefined();
    expect(session.patient.fullName).toBe("Sessions Patient");
  });

  it("orders sessions by most recent first", async () => {
    // Create a second session to test ordering
    const second = await prisma.session.create({
      data: { physicianId, patientId },
    });

    const res = await request(app).get("/api/sessions").set(AUTH);
    expect(res.status).toBe(200);

    const ids = res.body.map((s: any) => s.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(sessionId));

    await prisma.session.delete({ where: { id: second.id } });
  });

  it("filters by ?status=RECORDING", async () => {
    const res = await request(app)
      .get("/api/sessions?status=RECORDING")
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.every((s: any) => s.status === "RECORDING")).toBe(true);
  });

  it("returns 400 for invalid status filter", async () => {
    const res = await request(app)
      .get("/api/sessions?status=INVALID")
      .set(AUTH);
    expect(res.status).toBe(400);
  });

  it("does not return sessions belonging to other physicians", async () => {
    // Create a session for a different physician
    const otherPhysician = await prisma.physician.create({
      data: {
        clerkId: `other_${Date.now()}`,
        fullName: "Other Doc",
        email: `other.${Date.now()}@vera.test`,
      },
    });
    const otherSession = await prisma.session.create({
      data: { physicianId: otherPhysician.id, patientId },
    });

    const res = await request(app).get("/api/sessions").set(AUTH);
    const ids = res.body.map((s: any) => s.id);
    expect(ids).not.toContain(otherSession.id);

    await prisma.session.delete({ where: { id: otherSession.id } });
    await prisma.physician.delete({ where: { id: otherPhysician.id } });
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions/:id
// ---------------------------------------------------------------------------
describe("GET /api/sessions/:id", () => {
  it("returns full session with all relations", async () => {
    const res = await request(app)
      .get(`/api/sessions/${sessionId}`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sessionId);
    expect(res.body.patient.fullName).toBe("Sessions Patient");
    expect(res.body.physician.fullName).toBe("Dr. Sessions Test");
    expect(res.body.transcript).toBeNull();
    expect(res.body.soapNote).toBeNull();
    expect(Array.isArray(res.body.auditEvents)).toBe(true);
    expect(res.body.auditEvents[0].eventType).toBe("SESSION_CREATED");
  });

  it("audit events are ordered by createdAt asc", async () => {
    // Add a second event
    await prisma.auditEvent.create({
      data: { sessionId, eventType: "TEST_EVENT", author: "System" },
    });

    const res = await request(app)
      .get(`/api/sessions/${sessionId}`)
      .set(AUTH);

    const times = res.body.auditEvents.map((e: any) => new Date(e.createdAt).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    }
  });

  it("returns 404 for unknown session", async () => {
    const res = await request(app)
      .get("/api/sessions/00000000-0000-0000-0000-000000000000")
      .set(AUTH);
    expect(res.status).toBe(404);
  });

  it("returns 403 when session belongs to another physician", async () => {
    const otherPhysician = await prisma.physician.create({
      data: {
        clerkId: `403_test_${Date.now()}`,
        fullName: "Forbidden Doc",
        email: `forbidden.${Date.now()}@vera.test`,
      },
    });
    const otherSession = await prisma.session.create({
      data: { physicianId: otherPhysician.id, patientId },
    });

    const res = await request(app)
      .get(`/api/sessions/${otherSession.id}`)
      .set(AUTH);
    expect(res.status).toBe(403);

    await prisma.session.delete({ where: { id: otherSession.id } });
    await prisma.physician.delete({ where: { id: otherPhysician.id } });
  });
});
