import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

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
