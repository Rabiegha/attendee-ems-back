-- AlterTable
ALTER TABLE "users" ADD COLUMN     "company" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "phone" TEXT;
