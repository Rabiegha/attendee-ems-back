-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('public_form', 'test_form', 'manual', 'import');

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "snapshot_company" TEXT,
ADD COLUMN     "snapshot_country" TEXT,
ADD COLUMN     "snapshot_email" TEXT,
ADD COLUMN     "snapshot_first_name" TEXT,
ADD COLUMN     "snapshot_job_title" TEXT,
ADD COLUMN     "snapshot_last_name" TEXT,
ADD COLUMN     "snapshot_phone" TEXT,
ADD COLUMN     "source" "RegistrationSource" NOT NULL DEFAULT 'public_form';
