-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "checked_in_at" TIMESTAMP(3),
ADD COLUMN     "checked_in_by" UUID,
ADD COLUMN     "checkin_location" JSONB;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
