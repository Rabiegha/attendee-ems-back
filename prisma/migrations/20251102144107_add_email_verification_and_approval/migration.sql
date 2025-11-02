-- AlterTable
ALTER TABLE "email_settings" ADD COLUMN     "approval_body" TEXT,
ADD COLUMN     "approval_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approval_subject" TEXT,
ADD COLUMN     "require_email_verification" BOOLEAN NOT NULL DEFAULT false;
