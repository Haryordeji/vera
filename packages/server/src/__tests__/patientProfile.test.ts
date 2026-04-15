import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient();

const STAMP = Date.now();
const TEST_EMAIL = `test.profile.${STAMP}@vera.test`;
const TEST_CLERK_ID = `test_profile_clerk_${STAMP}`;
const TEST_MRN = `TEST-PROFILE-MRN-${STAMP}`;

let physicianId: string;
const createdPatientIds: string[] = [];

beforeAll(async () => {
  await prisma.$connect();
  const physician = await prisma.physician.create({
    data: {
      clerkId: TEST_CLERK_ID,
      fullName: "Dr. Profile Test",
      email: TEST_EMAIL,
      credentials: "MD",
    },
  });
  physicianId = physician.id;
});

afterAll(async () => {
  await prisma.vitals.deleteMany({ where: { session: { physicianId } } });
  await prisma.auditEvent.deleteMany({ where: { session: { physicianId } } });
  await prisma.session.deleteMany({ where: { physicianId } });
  // Allergies/medications cascade on patient delete, but be explicit
  await prisma.allergy.deleteMany({ where: { patientId: { in: createdPatientIds } } });
  await prisma.medication.deleteMany({ where: { patientId: { in: createdPatientIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: createdPatientIds } } });
  await prisma.physician.deleteMany({ where: { id: physicianId } });
  await prisma.$disconnect();
});

describe("Patient profile fields", () => {
  it("saves and retrieves expanded profile fields", async () => {
    const patient = await prisma.patient.create({
      data: {
        fullName: "Profile Patient",
        mrn: TEST_MRN,
        dateOfBirth: new Date("1985-06-15"),
        sex: "Female",
        heightCm: 165.5,
        eyeColor: "Green",
        bloodType: "AB-",
      },
    });
    createdPatientIds.push(patient.id);

    const fetched = await prisma.patient.findUniqueOrThrow({
      where: { id: patient.id },
    });

    expect(fetched.sex).toBe("Female");
    expect(fetched.heightCm).toBe(165.5);
    expect(fetched.eyeColor).toBe("Green");
    expect(fetched.bloodType).toBe("AB-");
  });

  it("allows all new profile fields to be null", async () => {
    const patient = await prisma.patient.create({
      data: {
        fullName: "Minimal Patient",
        mrn: `${TEST_MRN}-min`,
      },
    });
    createdPatientIds.push(patient.id);

    expect(patient.sex).toBeNull();
    expect(patient.heightCm).toBeNull();
    expect(patient.eyeColor).toBeNull();
    expect(patient.bloodType).toBeNull();
  });
});

describe("Allergy model", () => {
  it("creates an allergy linked to a patient and retrieves it via relation", async () => {
    const patient = await prisma.patient.create({
      data: { fullName: "Allergy Patient", mrn: `${TEST_MRN}-allergy` },
    });
    createdPatientIds.push(patient.id);

    await prisma.allergy.createMany({
      data: [
        { patientId: patient.id, name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis" },
        { patientId: patient.id, name: "Peanuts", severity: "Moderate", reaction: "Hives" },
      ],
    });

    const withAllergies = await prisma.patient.findUniqueOrThrow({
      where: { id: patient.id },
      include: { allergies: true },
    });

    expect(withAllergies.allergies).toHaveLength(2);
    const names = withAllergies.allergies.map((a) => a.name).sort();
    expect(names).toEqual(["Peanuts", "Penicillin"]);
    const penicillin = withAllergies.allergies.find((a) => a.name === "Penicillin")!;
    expect(penicillin.severity).toBe("Severe");
    expect(penicillin.reaction).toBe("Anaphylaxis");
  });
});

describe("Medication model", () => {
  it("creates a medication linked to a patient and retrieves it via relation", async () => {
    const patient = await prisma.patient.create({
      data: { fullName: "Med Patient", mrn: `${TEST_MRN}-med` },
    });
    createdPatientIds.push(patient.id);

    await prisma.medication.create({
      data: {
        patientId: patient.id,
        name: "Lisinopril",
        dosage: "10mg",
        frequency: "Once daily",
      },
    });

    const withMeds = await prisma.patient.findUniqueOrThrow({
      where: { id: patient.id },
      include: { medications: true },
    });

    expect(withMeds.medications).toHaveLength(1);
    expect(withMeds.medications[0].name).toBe("Lisinopril");
    expect(withMeds.medications[0].dosage).toBe("10mg");
    expect(withMeds.medications[0].frequency).toBe("Once daily");
  });
});

describe("Cascade delete on Patient", () => {
  it("removes allergies and medications when the patient is deleted", async () => {
    const patient = await prisma.patient.create({
      data: {
        fullName: "Cascade Patient",
        mrn: `${TEST_MRN}-cascade`,
        allergies: {
          create: [{ name: "Latex", severity: "Mild" }],
        },
        medications: {
          create: [{ name: "Ibuprofen", dosage: "400mg", frequency: "As needed" }],
        },
      },
      include: { allergies: true, medications: true },
    });

    expect(patient.allergies).toHaveLength(1);
    expect(patient.medications).toHaveLength(1);

    const allergyId = patient.allergies[0].id;
    const medicationId = patient.medications[0].id;

    await prisma.patient.delete({ where: { id: patient.id } });

    const remainingAllergy = await prisma.allergy.findUnique({ where: { id: allergyId } });
    const remainingMedication = await prisma.medication.findUnique({
      where: { id: medicationId },
    });

    expect(remainingAllergy).toBeNull();
    expect(remainingMedication).toBeNull();
  });
});

describe("Vitals model", () => {
  it("creates vitals linked to a session", async () => {
    const patient = await prisma.patient.create({
      data: { fullName: "Vitals Patient", mrn: `${TEST_MRN}-vitals` },
    });
    createdPatientIds.push(patient.id);

    const session = await prisma.session.create({
      data: { physicianId, patientId: patient.id },
    });

    const vitals = await prisma.vitals.create({
      data: {
        sessionId: session.id,
        weightKg: 70.5,
        bloodPressureSys: 120,
        bloodPressureDia: 80,
        heartRate: 72,
        temperatureC: 37.0,
        respiratoryRate: 16,
        oxygenSaturation: 98.5,
      },
    });

    expect(vitals.id).toBeTruthy();
    expect(vitals.sessionId).toBe(session.id);
    expect(vitals.weightKg).toBe(70.5);
    expect(vitals.bloodPressureSys).toBe(120);
    expect(vitals.bloodPressureDia).toBe(80);
    expect(vitals.heartRate).toBe(72);
    expect(vitals.temperatureC).toBe(37.0);
    expect(vitals.respiratoryRate).toBe(16);
    expect(vitals.oxygenSaturation).toBe(98.5);
    expect(vitals.recordedAt).toBeInstanceOf(Date);

    const sessionWithVitals = await prisma.session.findUniqueOrThrow({
      where: { id: session.id },
      include: { vitals: true },
    });
    expect(sessionWithVitals.vitals?.id).toBe(vitals.id);
  });

  it("enforces unique sessionId constraint — one vitals per session", async () => {
    const patient = await prisma.patient.create({
      data: { fullName: "Vitals Unique Patient", mrn: `${TEST_MRN}-vitals-unique` },
    });
    createdPatientIds.push(patient.id);

    const session = await prisma.session.create({
      data: { physicianId, patientId: patient.id },
    });

    await prisma.vitals.create({
      data: { sessionId: session.id, heartRate: 70 },
    });

    await expect(
      prisma.vitals.create({
        data: { sessionId: session.id, heartRate: 80 },
      })
    ).rejects.toThrow();
  });
});
