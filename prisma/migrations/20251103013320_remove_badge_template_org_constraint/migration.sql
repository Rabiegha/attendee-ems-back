-- DropForeignKey
ALTER TABLE "public"."badges" DROP CONSTRAINT "badges_badge_template_id_org_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."event_settings" DROP CONSTRAINT "event_settings_badge_template_id_org_id_fkey";

-- AddForeignKey
ALTER TABLE "event_settings" ADD CONSTRAINT "event_settings_badge_template_id_fkey" FOREIGN KEY ("badge_template_id") REFERENCES "badge_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_badge_template_id_fkey" FOREIGN KEY ("badge_template_id") REFERENCES "badge_templates"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
