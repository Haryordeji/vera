import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";

const TEST_CLERK_ID = `profile_api_clerk_${Date.now()}`;

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
const STAMP = Date.now();
const MRN_PREFIX = `profile_api_${STAMP}`;

let physicianId: string;
let patientId: string;

beforeAll(async () => {
  await prisma.$connect();

  const physician = await prisma.physician.create({
    data: {
      clerkId: TEST_CLERK_ID,
      fullName: "Dr. Profile API",
      email: `profile.api.${STAMP}@vera.test`,
    },
  });
  physicianId = physician.id;
});

afterAll(async () => {
  await prisma.vitals.deleteMany({ where: { session: { physicianId } } });
  await prisma.auditEvent.deleteMany({ where: { session: { physicianId } } });
  await prisma.session.deleteMany({ where: { physicianId } });
  // patient cascade will clear allergies/meds
  await prisma.patient.deleteMany({ where: { mrn: { startsWith: MRN_PREFIX } } });
  await prisma.physician.deleteMany({ where: { id: physicianId } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Patient profile fields
// ---------------------------------------------------------------------------
describe("POST /api/patients — new profile fields", () => {
  it("creates a patient with expanded profile fields", async () => {
    const res = await request(app)
      .post("/api/patients")
      .set(AUTH)
      .send({
        fullName: "Profile API Patient",
        mrn: `${MRN_PREFIX}_main`,
        dateOfBirth: "1990-05-15",
        sex: "Female",
        heightCm: 165.5,
        eyeColor: "Green",
        bloodType: "A+",
      });

    expect(res.status).toBe(201);
    expect(res.body.sex).toBe("Female");
    expect(res.body.heightCm).toBe(165.5);
    expect(res.body.eyeColor).toBe("Green");
    expect(res.body.bloodType).toBe("A+");
    patientId = res.body.id;
  });
});

describe("PUT /api/patients/:id — new profile fields", () => {
  it("updates expanded profile fields", async () => {
    const res = await request(app)
      .put(`/api/patients/${patientId}`)
      .set(AUTH)
      .send({ sex: "Male", heightCm: 180, eyeColor: "Brown", bloodType: "O-" });

    expect(res.status).toBe(200);
    expect(res.body.sex).toBe("Male");
    expect(res.body.heightCm).toBe(180);
    expect(res.body.eyeColor).toBe("Brown");
    expect(res.body.bloodType).toBe("O-");
  });
});

// ---------------------------------------------------------------------------
// Allergies
// ---------------------------------------------------------------------------
describe("Allergy endpoints", () => {
  let allergyId: string;

  it("POST adds an allergy", async () => {
    const res = await request(app)
      .post(`/api/patients/${patientId}/allergies`)
      .set(AUTH)
      .send({ name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Penicillin");
    expect(res.body.severity).toBe("Severe");
    expect(res.body.reaction).toBe("Anaphylaxis");
    expect(res.body.patientId).toBe(patientId);
    allergyId = res.body.id;
  });

  it("POST returns 400 when name missing", async () => {
    const res = await request(app)
      .post(`/api/patients/${patientId}/allergies`)
      .set(AUTH)
      .send({ severity: "Mild" });
    expect(res.status).toBe(400);
  });

  it("POST returns 404 for unknown patient", async () => {
    const res = await request(app)
      .post("/api/patients/00000000-0000-0000-0000-000000000000/allergies")
      .set(AUTH)
      .send({ name: "Latex" });
    expect(res.status).toBe(404);
  });

  it("DELETE removes an allergy", async () => {
    const res = await request(app)
      .delete(`/api/patients/${patientId}/allergies/${allergyId}`)
      .set(AUTH);
    expect(res.status).toBe(204);

    const check = await prisma.allergy.findUnique({ where: { id: allergyId } });
    expect(check).toBeNull();
  });

  it("DELETE returns 404 if allergy does not belong to the patient", async () => {
    const other = await prisma.patient.create({
      data: { fullName: "Other Allergy Patient", mrn: `${MRN_PREFIX}_other_alg` },
    });
    const otherAllergy = await prisma.allergy.create({
      data: { patientId: other.id, name: "Bee stings" },
    });

    const res = await request(app)
      .delete(`/api/patients/${patientId}/allergies/${otherAllergy.id}`)
      .set(AUTH);
    expect(res.status).toBe(404);

    // Should still exist
    const still = await prisma.allergy.findUnique({ where: { id: otherAllergy.id } });
    expect(still).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------
describe("Medication endpoints", () => {
  let medicationId: string;

  it("POST adds a medication", async () => {
    const res = await request(app)
      .post(`/api/patients/${patientId}/medications`)
      .set(AUTH)
      .send({ name: "Lisinopril", dosage: "10mg", frequency: "Once daily" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Lisinopril");
    expect(res.body.dosage).toBe("10mg");
    expect(res.body.frequency).toBe("Once daily");
    medicationId = res.body.id;
  });

  it("POST returns 400 when name missing", async () => {
    const res = await request(app)
      .post(`/api/patients/${patientId}/medications`)
      .set(AUTH)
      .send({ dosage: "5mg" });
    expect(res.status).toBe(400);
  });

  it("PUT updates dosage and frequency", async () => {
    const res = await request(app)
      .put(`/api/patients/${patientId}/medications/${medicationId}`)
      .set(AUTH)
      .send({ dosage: "20mg", frequency: "Twice daily" });

    expect(res.status).toBe(200);
    expect(res.body.dosage).toBe("20mg");
    expect(res.body.frequency).toBe("Twice daily");
    expect(res.body.name).toBe("Lisinopril");
  });

  it("PUT returns 404 when medication does not belong to the patient", async () => {
    const other = await prisma.patient.create({
      data: { fullName: "Other Med Patient", mrn: `${MRN_PREFIX}_other_med` },
    });
    const otherMed = await prisma.medication.create({
      data: { patientId: other.id, name: "Metformin" },
    });

    const res = await request(app)
      .put(`/api/patients/${patientId}/medications/${otherMed.id}`)
      .set(AUTH)
      .send({ dosage: "500mg" });
    expect(res.status).toBe(404);
  });

  it("DELETE removes a medication", async () => {
    const res = await request(app)
      .delete(`/api/patients/${patientId}/medications/${medicationId}`)
      .set(AUTH);
    expect(res.status).toBe(204);

    const check = await prisma.medication.findUnique({ where: { id: medicationId } });
    expect(check).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Patient list with counts
// ---------------------------------------------------------------------------
describe("GET /api/patients — includes counts", () => {
  it("includes _count with allergies, medications, and sessions", async () => {
    // Add 2 allergies, 1 med, 1 session
    await prisma.allergy.createMany({
      data: [
        { patientId, name: "Dust" },
        { patientId, name: "Cats" },
      ],
    });
    await prisma.medication.create({
      data: { patientId, name: "Loratadine", dosage: "10mg" },
    });
    await prisma.session.create({
      data: { physicianId, patientId },
    });

    const res = await request(app)
      .get(`/api/patients?search=${MRN_PREFIX}_main`)
      .set(AUTH);

    expect(res.status).toBe(200);
    const patient = res.body.find((p: any) => p.id === patientId);
    expect(patient).toBeDefined();
    expect(patient._count).toBeDefined();
    expect(patient._count.allergies).toBe(2);
    expect(patient._count.medications).toBe(1);
    expect(patient._count.sessions).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Patient detail with nested data
// ---------------------------------------------------------------------------
describe("GET /api/patients/:id — nested detail", () => {
  it("includes allergies, medications, and sessions with physician name", async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.allergies)).toBe(true);
    expect(res.body.allergies.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.medications)).toBe(true);
    expect(res.body.medications.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(1);

    const session = res.body.sessions[0];
    expect(session.physician.fullName).toBe("Dr. Profile API");
    expect(session.status).toBeDefined();
    expect(session.recordedAt).toBeDefined();
    // soapNote may be null or { workflowStatus }
    expect("soapNote" in session).toBe(true);
  });

  it("sessions are ordered by recordedAt desc", async () => {
    // Create a second session with an older recordedAt
    await prisma.session.create({
      data: {
        physicianId,
        patientId,
        recordedAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });

    const res = await request(app)
      .get(`/api/patients/${patientId}`)
      .set(AUTH);

    const dates = res.body.sessions.map((s: any) => new Date(s.recordedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Vitals endpoints
// ---------------------------------------------------------------------------
describe("Vitals endpoints", () => {
  let vitalsSessionId: string;

  beforeAll(async () => {
    const session = await prisma.session.create({
      data: { physicianId, patientId },
    });
    vitalsSessionId = session.id;
  });

  it("POST creates vitals for a session", async () => {
    const res = await request(app)
      .post(`/api/sessions/${vitalsSessionId}/vitals`)
      .set(AUTH)
      .send({
        weightKg: 70.5,
        bloodPressureSys: 120,
        bloodPressureDia: 80,
        heartRate: 72,
        temperatureC: 37.0,
        respiratoryRate: 16,
        oxygenSaturation: 98.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBe(vitalsSessionId);
    expect(res.body.weightKg).toBe(70.5);
    expect(res.body.bloodPressureSys).toBe(120);
    expect(res.body.heartRate).toBe(72);
  });

  it("POST creates a VITALS_RECORDED audit event", async () => {
    const events = await prisma.auditEvent.findMany({
      where: { sessionId: vitalsSessionId, eventType: "VITALS_RECORDED" },
    });
    expect(events.length).toBe(1);
    expect(events[0].author).toBe("Dr. Profile API");
  });

  it("POST returns 409 when vitals already exist", async () => {
    const res = await request(app)
      .post(`/api/sessions/${vitalsSessionId}/vitals`)
      .set(AUTH)
      .send({ heartRate: 80 });
    expect(res.status).toBe(409);
  });

  it("POST returns 404 for unknown session", async () => {
    const res = await request(app)
      .post("/api/sessions/00000000-0000-0000-0000-000000000000/vitals")
      .set(AUTH)
      .send({ heartRate: 70 });
    expect(res.status).toBe(404);
  });

  it("POST returns 403 when session belongs to another physician", async () => {
    const otherPhysician = await prisma.physician.create({
      data: {
        clerkId: `vitals_403_${STAMP}`,
        fullName: "Other Doc",
        email: `vitals.403.${STAMP}@vera.test`,
      },
    });
    const otherSession = await prisma.session.create({
      data: { physicianId: otherPhysician.id, patientId },
    });

    const res = await request(app)
      .post(`/api/sessions/${otherSession.id}/vitals`)
      .set(AUTH)
      .send({ heartRate: 70 });
    expect(res.status).toBe(403);

    await prisma.session.delete({ where: { id: otherSession.id } });
    await prisma.physician.delete({ where: { id: otherPhysician.id } });
  });

  it("PUT updates vitals", async () => {
    const res = await request(app)
      .put(`/api/sessions/${vitalsSessionId}/vitals`)
      .set(AUTH)
      .send({ heartRate: 88, temperatureC: 38.2 });

    expect(res.status).toBe(200);
    expect(res.body.heartRate).toBe(88);
    expect(res.body.temperatureC).toBe(38.2);
    // Unspecified fields stay put
    expect(res.body.weightKg).toBe(70.5);
  });

  it("PUT returns 404 when vitals do not yet exist", async () => {
    const session = await prisma.session.create({
      data: { physicianId, patientId },
    });

    const res = await request(app)
      .put(`/api/sessions/${session.id}/vitals`)
      .set(AUTH)
      .send({ heartRate: 70 });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Session include updates
// ---------------------------------------------------------------------------
describe("Session endpoint includes", () => {
  it("GET /api/sessions/:id returns vitals and physician", async () => {
    // Find a session that has vitals
    const session = await prisma.session.findFirst({
      where: { physicianId, vitals: { isNot: null } },
    });
    expect(session).not.toBeNull();

    const res = await request(app)
      .get(`/api/sessions/${session!.id}`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.vitals).not.toBeNull();
    expect(res.body.vitals.sessionId).toBe(session!.id);
    expect(res.body.physician.fullName).toBe("Dr. Profile API");
  });

  it("GET /api/sessions list includes physician name", async () => {
    const res = await request(app).get("/api/sessions").set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const s of res.body) {
      expect(s.physician).toBeDefined();
      expect(s.physician.fullName).toBe("Dr. Profile API");
    }
  });
});
