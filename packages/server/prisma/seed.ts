import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

// Demo patients only — no visits/sessions/transcripts/SOAP notes/audit events.
// Those artifacts should only come from real usage because they require
// authentic audio, transcription, and AI generation to be meaningful.

interface PatientSeed {
  mrn: string;
  fullName: string;
  dateOfBirth: Date;
  sex: string;
  heightCm: number;
  eyeColor: string;
  bloodType: string;
  allergies: Array<{ name: string; severity: string; reaction: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
}

const PATIENT_SEEDS: PatientSeed[] = [
  {
    mrn: "MRN-001",
    fullName: "James Okafor",
    dateOfBirth: new Date("1978-03-15"),
    sex: "Male",
    heightCm: 178,
    eyeColor: "Brown",
    bloodType: "O+",
    allergies: [
      { name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis" },
      { name: "Pollen", severity: "Mild", reaction: "Sneezing, watery eyes" },
    ],
    medications: [
      { name: "Loratadine", dosage: "10mg", frequency: "Once daily as needed" },
      { name: "Fluticasone nasal spray", dosage: "50mcg", frequency: "Once daily" },
    ],
  },
  {
    mrn: "MRN-002",
    fullName: "Maria Chen",
    dateOfBirth: new Date("1992-07-22"),
    sex: "Female",
    heightCm: 165,
    eyeColor: "Brown",
    bloodType: "A+",
    allergies: [
      { name: "Latex", severity: "Moderate", reaction: "Contact dermatitis" },
    ],
    medications: [
      { name: "Sertraline", dosage: "50mg", frequency: "Once daily" },
      { name: "Ibuprofen", dosage: "400mg", frequency: "As needed for pain" },
    ],
  },
  {
    mrn: "MRN-003",
    fullName: "Robert Patel",
    dateOfBirth: new Date("1955-11-08"),
    sex: "Male",
    heightCm: 172,
    eyeColor: "Hazel",
    bloodType: "B+",
    allergies: [
      { name: "Sulfa drugs", severity: "Moderate", reaction: "Skin rash" },
      { name: "Shellfish", severity: "Severe", reaction: "Hives, swelling" },
    ],
    medications: [
      { name: "Lisinopril", dosage: "10mg", frequency: "Once daily" },
      { name: "Metformin", dosage: "500mg", frequency: "Twice daily with meals" },
      { name: "Atorvastatin", dosage: "20mg", frequency: "Once daily at bedtime" },
    ],
  },
  {
    mrn: "MRN-004",
    fullName: "Sarah Johnson",
    dateOfBirth: new Date("1985-04-03"),
    sex: "Female",
    heightCm: 170,
    eyeColor: "Green",
    bloodType: "AB+",
    allergies: [
      { name: "Peanuts", severity: "Severe", reaction: "Anaphylaxis" },
    ],
    medications: [
      { name: "Levothyroxine", dosage: "75mcg", frequency: "Once daily on empty stomach" },
    ],
  },
  {
    mrn: "MRN-005",
    fullName: "David Rodriguez",
    dateOfBirth: new Date("1968-09-17"),
    sex: "Male",
    heightCm: 183,
    eyeColor: "Brown",
    bloodType: "O-",
    allergies: [
      { name: "Aspirin", severity: "Moderate", reaction: "GI bleeding" },
      { name: "Dust mites", severity: "Mild", reaction: "Nasal congestion" },
    ],
    medications: [
      { name: "Amlodipine", dosage: "5mg", frequency: "Once daily" },
      { name: "Albuterol inhaler", dosage: "90mcg", frequency: "As needed for wheezing" },
    ],
  },
  {
    mrn: "MRN-006",
    fullName: "Emily Nakamura",
    dateOfBirth: new Date("2001-12-30"),
    sex: "Female",
    heightCm: 158,
    eyeColor: "Brown",
    bloodType: "A-",
    allergies: [
      { name: "Bee stings", severity: "Severe", reaction: "Anaphylaxis" },
      { name: "Cats", severity: "Moderate", reaction: "Asthma exacerbation" },
      { name: "Tree pollen", severity: "Mild", reaction: "Seasonal rhinitis" },
    ],
    medications: [
      { name: "Cetirizine", dosage: "10mg", frequency: "Once daily" },
      { name: "EpiPen", dosage: "0.3mg", frequency: "Emergency use only" },
    ],
  },
];

async function main() {
  console.log("Seeding database...");

  // Demo physician — kept so AuthSync can recognize the demo Clerk id.
  const physician = await prisma.physician.upsert({
    where: { email: "sarah.smith@vera.health" },
    update: {},
    create: {
      clerkId: "demo_clerk_id",
      fullName: "Sarah Smith",
      email: "sarah.smith@vera.health",
      credentials: "MD",
    },
  });
  console.log(`Physician: ${physician.fullName} (${physician.id})`);

  for (const seed of PATIENT_SEEDS) {
    const { allergies, medications, ...profile } = seed;

    const patient = await prisma.patient.upsert({
      where: { mrn: profile.mrn },
      update: {
        fullName: profile.fullName,
        dateOfBirth: profile.dateOfBirth,
        sex: profile.sex,
        heightCm: profile.heightCm,
        eyeColor: profile.eyeColor,
        bloodType: profile.bloodType,
      },
      create: profile,
    });

    // Re-runs of the seed should produce clean allergy/medication lists.
    await prisma.allergy.deleteMany({ where: { patientId: patient.id } });
    await prisma.medication.deleteMany({ where: { patientId: patient.id } });

    await prisma.allergy.createMany({
      data: allergies.map((a) => ({ ...a, patientId: patient.id })),
    });
    await prisma.medication.createMany({
      data: medications.map((m) => ({ ...m, patientId: patient.id })),
    });

    console.log(
      `Patient: ${patient.fullName} (MRN: ${patient.mrn}) — ${allergies.length} allergies, ${medications.length} medications`
    );
  }

  console.log(`Seed complete. ${PATIENT_SEEDS.length} patients seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
