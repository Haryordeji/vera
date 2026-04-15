-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "archivedAt" TIMESTAMP(3);
