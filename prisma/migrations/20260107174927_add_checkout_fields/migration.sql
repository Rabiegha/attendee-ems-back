-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "checked_out_at" TIMESTAMP(3),
ADD COLUMN     "checked_out_by" UUID,
ADD COLUMN     "checkout_location" JSONB;
