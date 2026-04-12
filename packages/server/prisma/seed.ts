import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

// Realistic demo transcript: doctor-patient cough encounter
const DEMO_TRANSCRIPT_UTTERANCES = [
  { speaker: "Doctor", text: "Good morning, Mr. Okafor. What brings you in today?", start: 0.0, end: 4.2 },
  { speaker: "Patient", text: "Good morning, Doctor. I've had this persistent cough for about two weeks now. It started after I got a bit of a cold, but the cold cleared up and the cough just stayed.", start: 4.8, end: 14.1 },
  { speaker: "Doctor", text: "I see. Is the cough dry, or are you bringing anything up?", start: 14.8, end: 18.2 },
  { speaker: "Patient", text: "Mostly dry. Sometimes a little bit of clear mucus in the morning, but nothing yellow or green.", start: 18.9, end: 25.3 },
  { speaker: "Doctor", text: "Any fever, shortness of breath, or chest pain?", start: 26.0, end: 29.4 },
  { speaker: "Patient", text: "No fever. Maybe a tiny bit of shortness of breath when I go up stairs, but I'm not sure if that's new or not. No chest pain.", start: 30.1, end: 38.7 },
  { speaker: "Doctor", text: "Have you ever had asthma or allergies?", start: 39.2, end: 41.8 },
  { speaker: "Patient", text: "Seasonal allergies, yes. Mostly in spring. I take loratadine when it gets bad.", start: 42.3, end: 48.1 },
  { speaker: "Doctor", text: "Okay. Let me listen to your lungs. Take a few deep breaths for me.", start: 49.0, end: 53.5 },
  { speaker: "Doctor", text: "Your lungs sound clear bilaterally. No wheezing, no crackles. Throat looks a little red. No lymphadenopathy.", start: 62.0, end: 70.4 },
  { speaker: "Patient", text: "That's a relief. So what do you think is causing it?", start: 71.1, end: 74.8 },
  { speaker: "Doctor", text: "Most likely post-viral cough, sometimes called post-infectious cough syndrome. After a respiratory infection, the airways can remain irritated and sensitive for several weeks. It's very common. Given your allergy history, some allergic component is also possible.", start: 75.5, end: 91.2 },
  { speaker: "Patient", text: "Is there anything I should take for it?", start: 91.9, end: 94.3 },
  { speaker: "Doctor", text: "I'd recommend starting a nasal corticosteroid spray — fluticasone — once daily. That can help reduce post-nasal drip that may be triggering the cough. Continue the loratadine as well. I'd also suggest honey and warm fluids for symptomatic relief. If the cough hasn't improved in two to three weeks, or if you develop fever, colored sputum, or worsening shortness of breath, come back and we'll look further.", start: 95.0, end: 119.7 },
  { speaker: "Patient", text: "Okay, thank you. I'll pick up the fluticasone today.", start: 120.4, end: 124.1 },
  { speaker: "Doctor", text: "Great. I'll also note this visit in your record. Take care, Mr. Okafor.", start: 124.8, end: 129.3 },
];

const DEMO_TRANSCRIPT_PLAIN = DEMO_TRANSCRIPT_UTTERANCES.map(
  (u) => `${u.speaker}: ${u.text}`
).join("\n\n");

const DEMO_SOAP_NOTE = {
  subjective: `Chief Complaint: Persistent cough for approximately two weeks.

History of Present Illness: Patient is a 46-year-old male presenting with a dry, persistent cough that began following a recent upper respiratory infection. The cold resolved but the cough persisted. Occasional clear mucus production in the mornings, no purulent sputum. Reports mild exertional dyspnea on climbing stairs, though uncertain if this is a new symptom. Denies fever, chest pain, hemoptysis.

Past Medical History: Seasonal allergic rhinitis (spring). Currently manages with loratadine PRN.

Medications: Loratadine 10 mg PRN.`,

  objective: `Vital signs not formally recorded in this encounter.

Physical Examination:
- Respiratory: Lungs clear to auscultation bilaterally. No wheezing, no crackles, no rhonchi.
- ENT: Oropharynx mildly erythematous. No exudates.
- Neck: No cervical lymphadenopathy.`,

  assessment: `1. Post-viral (post-infectious) cough syndrome — most likely etiology given the temporal relationship to a recent URI with subsequent persistent dry cough and clear auscultation findings.
2. Allergic rhinitis with possible post-nasal drip component — patient has documented seasonal allergies; drip may be contributing to cough irritation.`,

  plan: `1. Start fluticasone propionate nasal spray 50 mcg, one spray per nostril once daily — to reduce post-nasal drip.
2. Continue loratadine 10 mg as needed for allergic symptoms.
3. Supportive care: honey, warm fluids, humidifier as needed.
4. Return precautions: advise patient to return if cough does not improve within 2–3 weeks, or sooner if fever develops, sputum becomes purulent, or shortness of breath worsens.
5. Follow-up in 3 weeks if no improvement.`,
};

async function main() {
  console.log("Seeding database...");

  // Demo physician
  const physician = await prisma.physician.upsert({
    where: { email: "sarah.smith@vera.health" },
    update: {},
    create: {
      clerkId: "demo_clerk_id",
      fullName: "Dr. Sarah Smith",
      email: "sarah.smith@vera.health",
      credentials: "MD",
    },
  });
  console.log(`Physician: ${physician.fullName} (${physician.id})`);

  // Demo patients
  const patients = await Promise.all([
    prisma.patient.upsert({
      where: { mrn: "MRN-001" },
      update: {},
      create: {
        fullName: "James Okafor",
        dateOfBirth: new Date("1978-03-15"),
        mrn: "MRN-001",
      },
    }),
    prisma.patient.upsert({
      where: { mrn: "MRN-002" },
      update: {},
      create: {
        fullName: "Maria Chen",
        dateOfBirth: new Date("1992-07-22"),
        mrn: "MRN-002",
      },
    }),
    prisma.patient.upsert({
      where: { mrn: "MRN-003" },
      update: {},
      create: {
        fullName: "Robert Patel",
        dateOfBirth: new Date("1955-11-08"),
        mrn: "MRN-003",
      },
    }),
  ]);

  for (const p of patients) {
    console.log(`Patient: ${p.fullName} (MRN: ${p.mrn})`);
  }

  // Demo completed visit — James Okafor, cough encounter
  const existingDemoSession = await prisma.session.findFirst({
    where: {
      physicianId: physician.id,
      patientId: patients[0].id,
      status: "COMPLETED",
    },
  });

  if (existingDemoSession) {
    console.log(`Demo session already exists (${existingDemoSession.id}), skipping.`);
  } else {
    const sessionDate = new Date("2026-04-10T09:30:00.000Z");

    const demoSession = await prisma.session.create({
      data: {
        physicianId: physician.id,
        patientId: patients[0].id,
        status: "COMPLETED",
        recordedAt: sessionDate,
        audioFileUrl: null,
      },
    });
    console.log(`Demo session created: ${demoSession.id}`);

    // Transcript
    await prisma.transcript.create({
      data: {
        sessionId: demoSession.id,
        rawDiarizedText: JSON.stringify(DEMO_TRANSCRIPT_UTTERANCES),
        plainText: DEMO_TRANSCRIPT_PLAIN,
        generatedAt: new Date(sessionDate.getTime() + 2 * 60 * 1000), // +2 min
      },
    });
    console.log("Demo transcript created.");

    // SOAP note (APPROVED)
    const approvedAt = new Date(sessionDate.getTime() + 12 * 60 * 1000); // +12 min
    await prisma.soapNote.create({
      data: {
        sessionId: demoSession.id,
        subjective: DEMO_SOAP_NOTE.subjective,
        objective: DEMO_SOAP_NOTE.objective,
        assessment: DEMO_SOAP_NOTE.assessment,
        plan: DEMO_SOAP_NOTE.plan,
        workflowStatus: "APPROVED",
        approvedAt,
        approvedById: physician.id,
        createdAt: new Date(sessionDate.getTime() + 4 * 60 * 1000), // +4 min
      },
    });
    console.log("Demo SOAP note created (APPROVED).");

    // Audit events — one for every step
    const auditEntries = [
      {
        eventType: "SESSION_CREATED",
        description: "Visit session started",
        author: physician.fullName,
        metadata: null,
        createdAt: sessionDate,
      },
      {
        eventType: "AUDIO_CAPTURED",
        description: "Audio recording captured and uploaded",
        author: "System",
        metadata: null,
        createdAt: new Date(sessionDate.getTime() + 1 * 60 * 1000),
      },
      {
        eventType: "TRANSCRIPT_GENERATED",
        description: "Transcript generated with speaker diarization",
        author: "AI Engine",
        metadata: null,
        createdAt: new Date(sessionDate.getTime() + 2 * 60 * 1000),
      },
      {
        eventType: "SOAP_DRAFT_CREATED",
        description: "SOAP note draft generated by AI",
        author: "AI Engine",
        metadata: null,
        createdAt: new Date(sessionDate.getTime() + 4 * 60 * 1000),
      },
      {
        eventType: "SOAP_EDITED",
        description: "SOAP note edited by physician",
        author: physician.fullName,
        metadata: { changedFields: ["plan"] },
        createdAt: new Date(sessionDate.getTime() + 7 * 60 * 1000),
      },
      {
        eventType: "REVIEW_REQUESTED",
        description: "Note submitted for review",
        author: physician.fullName,
        metadata: null,
        createdAt: new Date(sessionDate.getTime() + 10 * 60 * 1000),
      },
      {
        eventType: "NOTE_APPROVED",
        description: "SOAP note signed and finalized",
        author: physician.fullName,
        metadata: null,
        createdAt: new Date(sessionDate.getTime() + 12 * 60 * 1000),
      },
    ];

    await prisma.auditEvent.createMany({
      data: auditEntries.map((e) => ({ ...e, sessionId: demoSession.id })),
    });
    console.log(`${auditEntries.length} demo audit events created.`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
