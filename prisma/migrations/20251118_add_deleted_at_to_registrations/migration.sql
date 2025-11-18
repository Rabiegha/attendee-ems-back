-- AlterTable
ALTER TABLE "registrations" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "registrations_deleted_at_idx" ON "registrations"("deleted_at");
