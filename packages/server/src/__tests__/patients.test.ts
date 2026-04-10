import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

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
const AUTH = { "x-test-clerk-user-id": "patients_test_user" };
const SEED = `pt_test_${Date.now()}`;

let createdId: string;

beforeAll(async () => {
  await prisma.$connect();
  // Clean up any stale data from prior runs
  await prisma.patient.deleteMany({ where: { mrn: { startsWith: SEED } } });
});

afterAll(async () => {
  await prisma.patient.deleteMany({ where: { mrn: { startsWith: SEED } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// POST /api/patients
// ---------------------------------------------------------------------------
describe("POST /api/patients", () => {
  it("creates a patient with all fields", async () => {
    const res = await request(app)
      .post("/api/patients")
      .set(AUTH)
      .send({ fullName: "Alice Test", dateOfBirth: "1990-05-15", mrn: `${SEED}_alice` });

    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe("Alice Test");
    expect(res.body.mrn).toBe(`${SEED}_alice`);
    expect(res.body.id).toBeTruthy();
    createdId = res.body.id;
  });

  it("creates a patient with only fullName (optional fields null)", async () => {
    const res = await request(app)
      .post("/api/patients")
      .set(AUTH)
      .send({ fullName: "Bob Minimal" });

    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe("Bob Minimal");
    expect(res.body.mrn).toBeNull();
    expect(res.body.dateOfBirth).toBeNull();

    await prisma.patient.delete({ where: { id: res.body.id } });
  });

  it("returns 400 when fullName is missing", async () => {
    const res = await request(app)
      .post("/api/patients")
      .set(AUTH)
      .send({ mrn: "X001" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fullName/i);
  });

  it("returns 400 when fullName is empty string", async () => {
    const res = await request(app)
      .post("/api/patients")
      .set(AUTH)
      .send({ fullName: "   " });

    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/patients").send({ fullName: "Ghost" });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/patients
// ---------------------------------------------------------------------------
describe("GET /api/patients", () => {
  beforeAll(async () => {
    // Seed extra patients for search tests
    await prisma.patient.createMany({
      data: [
        { fullName: "Charlie Searchable", mrn: `${SEED}_charlie` },
        { fullName: "Diana Findme", mrn: `${SEED}_diana` },
      ],
    });
  });

  it("returns all patients (at least the seeded ones)", async () => {
    const res = await request(app).get("/api/patients").set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by name with ?search=", async () => {
    const res = await request(app)
      .get("/api/patients?search=Searchable")
      .set(AUTH);

    expect(res.status).toBe(200);
    const names = res.body.map((p: any) => p.fullName);
    expect(names).toContain("Charlie Searchable");
    expect(names).not.toContain("Diana Findme");
  });

  it("filters by MRN with ?search=", async () => {
    const res = await request(app)
      .get(`/api/patients?search=${SEED}_diana`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body[0].fullName).toBe("Diana Findme");
  });

  it("is case-insensitive", async () => {
    const res = await request(app)
      .get("/api/patients?search=searchable")
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body[0].fullName).toBe("Charlie Searchable");
  });

  it("returns empty array for no matches", async () => {
    const res = await request(app)
      .get("/api/patients?search=ZZZNOMATCH999")
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/patients/:id
// ---------------------------------------------------------------------------
describe("GET /api/patients/:id", () => {
  it("returns the patient by id", async () => {
    const res = await request(app)
      .get(`/api/patients/${createdId}`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdId);
    expect(res.body.fullName).toBe("Alice Test");
  });

  it("returns 404 for unknown id", async () => {
    const res = await request(app)
      .get("/api/patients/00000000-0000-0000-0000-000000000000")
      .set(AUTH);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/patients/:id
// ---------------------------------------------------------------------------
describe("PUT /api/patients/:id", () => {
  it("updates patient fields", async () => {
    const res = await request(app)
      .put(`/api/patients/${createdId}`)
      .set(AUTH)
      .send({ fullName: "Alice Updated", mrn: `${SEED}_alice_v2` });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe("Alice Updated");
    expect(res.body.mrn).toBe(`${SEED}_alice_v2`);
  });

  it("can clear optional fields by sending null", async () => {
    const res = await request(app)
      .put(`/api/patients/${createdId}`)
      .set(AUTH)
      .send({ mrn: null });

    expect(res.status).toBe(200);
    expect(res.body.mrn).toBeNull();
  });

  it("returns 404 for unknown id", async () => {
    const res = await request(app)
      .put("/api/patients/00000000-0000-0000-0000-000000000000")
      .set(AUTH)
      .send({ fullName: "Ghost" });

    expect(res.status).toBe(404);
  });
});
