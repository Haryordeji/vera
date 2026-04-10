import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Mock @clerk/express BEFORE importing anything that depends on it.
//
// Strategy:
//   - clerkMiddleware() → no-op (just calls next())
//   - requireAuth()     → reads x-test-clerk-user-id header; 401 if absent
//   - getAuth(req)      → returns the auth object we attached in requireAuth
//   - clerkClient.users.getUser → vi.fn(), configured per test
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();

vi.mock("@clerk/express", () => {
  return {
    clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
    requireAuth:
      () => (req: any, res: any, next: any) => {
        const userId = req.headers["x-test-clerk-user-id"] as
          | string
          | undefined;
        if (!userId) {
          return res.status(401).json({ error: "Unauthenticated" });
        }
        req.__clerkAuth = { userId };
        next();
      },
    getAuth: (req: any) => req.__clerkAuth ?? { userId: null },
    clerkClient: {
      users: { getUser: (...args: any[]) => mockGetUser(...args) },
    },
  };
});

// Import AFTER mocks are set up
import { app } from "../index";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient();

const TEST_CLERK_ID = `auth_test_${Date.now()}`;
const TEST_EMAIL = `auth.test.${Date.now()}@vera.test`;

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.physician.deleteMany({ where: { clerkId: { startsWith: "auth_test_" } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  mockGetUser.mockReset();
});

// ---------------------------------------------------------------------------
// Health check — stays public (no auth required)
// ---------------------------------------------------------------------------
describe("GET /api/health", () => {
  it("returns 200 without auth token", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Auth protection — protected routes reject unauthenticated requests
// ---------------------------------------------------------------------------
describe("Protected routes", () => {
  it("returns 401 on /api/auth/sync without auth header", async () => {
    const res = await request(app).post("/api/auth/sync");
    expect(res.status).toBe(401);
  });

  it("returns 401 on an arbitrary protected route without auth", async () => {
    const res = await request(app).get("/api/sessions");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/sync
// ---------------------------------------------------------------------------
describe("POST /api/auth/sync", () => {
  it("creates a new physician on first call", async () => {
    mockGetUser.mockResolvedValueOnce({
      firstName: "Jane",
      lastName: "Doe",
      emailAddresses: [{ emailAddress: TEST_EMAIL }],
    });

    const res = await request(app)
      .post("/api/auth/sync")
      .set("x-test-clerk-user-id", TEST_CLERK_ID);

    expect(res.status).toBe(200);
    expect(res.body.clerkId).toBe(TEST_CLERK_ID);
    expect(res.body.fullName).toBe("Jane Doe");
    expect(res.body.email).toBe(TEST_EMAIL);
    expect(res.body.id).toBeTruthy();

    // Confirm record is in DB
    const dbRecord = await prisma.physician.findUnique({
      where: { clerkId: TEST_CLERK_ID },
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord!.email).toBe(TEST_EMAIL);
  });

  it("returns the existing physician on subsequent calls (no duplicate created)", async () => {
    // Second call — getUser should NOT be called since record already exists
    const res = await request(app)
      .post("/api/auth/sync")
      .set("x-test-clerk-user-id", TEST_CLERK_ID);

    expect(res.status).toBe(200);
    expect(res.body.clerkId).toBe(TEST_CLERK_ID);
    expect(mockGetUser).not.toHaveBeenCalled();

    // Only one record in DB for this clerkId
    const count = await prisma.physician.count({
      where: { clerkId: TEST_CLERK_ID },
    });
    expect(count).toBe(1);
  });

  it("handles a user with no last name gracefully", async () => {
    const singleNameClerkId = `auth_test_single_${Date.now()}`;
    const singleEmail = `single.${Date.now()}@vera.test`;

    mockGetUser.mockResolvedValueOnce({
      firstName: "Cher",
      lastName: null,
      emailAddresses: [{ emailAddress: singleEmail }],
    });

    const res = await request(app)
      .post("/api/auth/sync")
      .set("x-test-clerk-user-id", singleNameClerkId);

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe("Cher");
  });

  it("falls back to email as fullName when both name fields are empty", async () => {
    const noNameClerkId = `auth_test_noname_${Date.now()}`;
    const noNameEmail = `noname.${Date.now()}@vera.test`;

    mockGetUser.mockResolvedValueOnce({
      firstName: null,
      lastName: null,
      emailAddresses: [{ emailAddress: noNameEmail }],
    });

    const res = await request(app)
      .post("/api/auth/sync")
      .set("x-test-clerk-user-id", noNameClerkId);

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe(noNameEmail);
  });
});
