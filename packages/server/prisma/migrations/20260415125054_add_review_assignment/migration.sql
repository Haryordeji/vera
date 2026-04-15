-- AlterTable
ALTER TABLE "SoapNote" ADD COLUMN     "assignedReviewerId" TEXT,
ADD COLUMN     "reviewFeedback" TEXT;

-- AddForeignKey
ALTER TABLE "SoapNote" ADD CONSTRAINT "SoapNote_assignedReviewerId_fkey" FOREIGN KEY ("assignedReviewerId") REFERENCES "Physician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
