-- AlterEnum
ALTER TYPE "RegistrationSource" ADD VALUE 'mobile_app';

-- DropForeignKey
ALTER TABLE "public"."badges" DROP CONSTRAINT "badges_badge_template_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."event_settings" DROP CONSTRAINT "event_settings_badge_template_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."registrations" DROP CONSTRAINT "registrations_checked_in_by_fkey";

-- DropIndex
DROP INDEX "public"."invitations_email_org_id_key";

-- DropIndex
DROP INDEX "public"."registrations_deleted_at_idx";

-- CreateIndex
CREATE INDEX "invitations_email_org_id_status_idx" ON "invitations"("email", "org_id", "status");

-- AddForeignKey
ALTER TABLE "event_settings" ADD CONSTRAINT "event_settings_badge_template_id_org_id_fkey" FOREIGN KEY ("badge_template_id", "org_id") REFERENCES "badge_templates"("id", "org_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_badge_template_id_org_id_fkey" FOREIGN KEY ("badge_template_id", "org_id") REFERENCES "badge_templates"("id", "org_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
