import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "../generated/prisma/client";
import { SessionStatus, WorkflowStatus } from "../generated/prisma/enums";

const prisma = new PrismaClient();

// Isolated test data — cleaned up after each suite
const TEST_EMAIL = `test.physician.${Date.now()}@vera.test`;
const TEST_CLERK_ID = `test_clerk_${Date.now()}`;
const TEST_MRN = `TEST-MRN-${Date.now()}`;

let physicianId: string;
let patientId: string;
let sessionId: string;

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Clean up in reverse-dependency order
  await prisma.auditEvent.deleteMany({ where: { session: { physicianId } } });
  await prisma.soapNote.deleteMany({ where: { session: { physicianId } } });
  await prisma.transcript.deleteMany({ where: { session: { physicianId } } });
  await prisma.session.deleteMany({ where: { physicianId } });
  await prisma.patient.deleteMany({ where: { mrn: TEST_MRN } });
  await prisma.physician.deleteMany({ where: { id: physicianId } });
  await prisma.$disconnect();
});

describe("Physician model", () => {
  it("creates a physician with all fields", async () => {
    const physician = await prisma.physician.create({
      data: {
        clerkId: TEST_CLERK_ID,
        fullName: "Dr. Test Physician",
        email: TEST_EMAIL,
        credentials: "MD",
      },
    });

    physicianId = physician.id;

    expect(physician.id).toBeTruthy();
    expect(physician.fullName).toBe("Dr. Test Physician");
    expect(physician.email).toBe(TEST_EMAIL);
    expect(physician.credentials).toBe("MD");
    expect(physician.createdAt).toBeInstanceOf(Date);
  });

  it("enforces unique clerkId constraint", async () => {
    await expect(
      prisma.physician.create({
        data: {
          clerkId: TEST_CLERK_ID,
          fullName: "Duplicate",
          email: `duplicate-${Date.now()}@vera.test`,
        },
      })
    ).rejects.toThrow();
  });
});

describe("Patient model", () => {
  it("creates a patient with all fields", async () => {
    const patient = await prisma.patient.create({
      data: {
        fullName: "Test Patient",
        dateOfBirth: new Date("1985-06-15"),
        mrn: TEST_MRN,
      },
    });

    patientId = patient.id;

    expect(patient.id).toBeTruthy();
    expect(patient.fullName).toBe("Test Patient");
    expect(patient.mrn).toBe(TEST_MRN);
    expect(patient.dateOfBirth).toEqual(new Date("1985-06-15"));
  });

  it("enforces unique MRN constraint", async () => {
    await expect(
      prisma.patient.create({
        data: { fullName: "Duplicate Patient", mrn: TEST_MRN },
      })
    ).rejects.toThrow();
  });
});

describe("Session model", () => {
  it("creates a session linked to physician and patient", async () => {
    const session = await prisma.session.create({
      data: {
        physicianId,
        patientId,
        status: SessionStatus.RECORDING,
      },
      include: { physician: true, patient: true },
    });

    sessionId = session.id;

    expect(session.id).toBeTruthy();
    expect(session.status).toBe(SessionStatus.RECORDING);
    expect(session.physician.id).toBe(physicianId);
    expect(session.patient.id).toBe(patientId);
    expect(session.audioFileUrl).toBeNull();
  });

  it("defaults status to RECORDING", async () => {
    const session = await prisma.session.create({
      data: { physicianId, patientId },
    });
    expect(session.status).toBe(SessionStatus.RECORDING);
    // Clean up immediately
    await prisma.session.delete({ where: { id: session.id } });
  });

  it("transitions through all SessionStatus values", async () => {
    for (const status of Object.values(SessionStatus)) {
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { status },
      });
      expect(updated.status).toBe(status);
    }
    // Reset to RECORDING for subsequent tests
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.RECORDING },
    });
  });
});

describe("Transcript model", () => {
  it("creates a transcript linked to a session", async () => {
    const raw = JSON.stringify({
      utterances: [
        { speaker: "Doctor", text: "How are you?", start: 0, end: 1.5 },
        { speaker: "Patient", text: "Not great.", start: 2.0, end: 3.0 },
      ],
    });

    const transcript = await prisma.transcript.create({
      data: {
        sessionId,
        rawDiarizedText: raw,
        plainText: "Doctor: How are you?\nPatient: Not great.",
      },
    });

    expect(transcript.id).toBeTruthy();
    expect(transcript.sessionId).toBe(sessionId);
    expect(JSON.parse(transcript.rawDiarizedText).utterances).toHaveLength(2);
  });

  it("enforces one-to-one: cannot create a second transcript for same session", async () => {
    await expect(
      prisma.transcript.create({
        data: {
          sessionId,
          rawDiarizedText: "{}",
          plainText: "duplicate",
        },
      })
    ).rejects.toThrow();
  });
});

describe("SoapNote model", () => {
  it("creates a SOAP note linked to a session with DRAFT status", async () => {
    const note = await prisma.soapNote.create({
      data: {
        sessionId,
        subjective: "Patient reports persistent cough for 2 weeks.",
        objective: "No objective findings documented.",
        assessment: "Acute bronchitis, likely viral.",
        plan: "Rest, fluids, follow up in 1 week.",
      },
    });

    expect(note.id).toBeTruthy();
    expect(note.sessionId).toBe(sessionId);
    expect(note.workflowStatus).toBe(WorkflowStatus.DRAFT);
    expect(note.approvedAt).toBeNull();
    expect(note.approvedById).toBeNull();
  });

  it("transitions through all WorkflowStatus values", async () => {
    const note = await prisma.soapNote.findUniqueOrThrow({
      where: { sessionId },
    });

    for (const status of Object.values(WorkflowStatus)) {
      const updated = await prisma.soapNote.update({
        where: { id: note.id },
        data: { workflowStatus: status },
      });
      expect(updated.workflowStatus).toBe(status);
    }
  });

  it("can be approved with approvedById and approvedAt", async () => {
    const note = await prisma.soapNote.findUniqueOrThrow({
      where: { sessionId },
    });

    const now = new Date();
    const approved = await prisma.soapNote.update({
      where: { id: note.id },
      data: {
        workflowStatus: WorkflowStatus.APPROVED,
        approvedAt: now,
        approvedById: physicianId,
      },
      include: { approvedBy: true },
    });

    expect(approved.workflowStatus).toBe(WorkflowStatus.APPROVED);
    expect(approved.approvedAt).toEqual(now);
    expect(approved.approvedBy?.id).toBe(physicianId);
  });
});

describe("AuditEvent model", () => {
  it("creates multiple audit events linked to a session", async () => {
    const events = await prisma.$transaction([
      prisma.auditEvent.create({
        data: {
          sessionId,
          eventType: "AUDIO_CAPTURED",
          description: "Audio file uploaded successfully.",
          author: "System",
        },
      }),
      prisma.auditEvent.create({
        data: {
          sessionId,
          eventType: "TRANSCRIPT_GENERATED",
          author: "AI Engine",
          metadata: { provider: "AssemblyAI", durationMs: 4200 },
        },
      }),
      prisma.auditEvent.create({
        data: {
          sessionId,
          eventType: "NOTE_APPROVED",
          author: "Dr. Test Physician",
          metadata: { workflowStatus: "APPROVED" },
        },
      }),
    ]);

    expect(events).toHaveLength(3);
    expect(events[0].eventType).toBe("AUDIO_CAPTURED");
    expect(events[1].eventType).toBe("TRANSCRIPT_GENERATED");
    expect(events[2].eventType).toBe("NOTE_APPROVED");
  });

  it("fetches audit events ordered by createdAt", async () => {
    const events = await prisma.auditEvent.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    expect(events.length).toBeGreaterThanOrEqual(3);
    // Verify ascending order
    for (let i = 1; i < events.length; i++) {
      expect(events[i].createdAt.getTime()).toBeGreaterThanOrEqual(
        events[i - 1].createdAt.getTime()
      );
    }
  });
});

describe("Relationships", () => {
  it("fetches a session with all nested relations", async () => {
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        physician: true,
        patient: true,
        transcript: true,
        soapNote: true,
        auditEvents: { orderBy: { createdAt: "asc" } },
      },
    });

    expect(session.physician.fullName).toBe("Dr. Test Physician");
    expect(session.patient.fullName).toBe("Test Patient");
    expect(session.transcript).not.toBeNull();
    expect(session.soapNote).not.toBeNull();
    expect(session.auditEvents.length).toBeGreaterThanOrEqual(3);
  });

  it("physician can have multiple sessions", async () => {
    const extraSession = await prisma.session.create({
      data: { physicianId, patientId },
    });

    const physician = await prisma.physician.findUniqueOrThrow({
      where: { id: physicianId },
      include: { sessions: true },
    });

    expect(physician.sessions.length).toBeGreaterThanOrEqual(2);
    await prisma.session.delete({ where: { id: extraSession.id } });
  });
});
