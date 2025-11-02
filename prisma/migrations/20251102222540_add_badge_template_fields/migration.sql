-- AlterTable
ALTER TABLE "badge_templates" ADD COLUMN     "created_by" UUID,
ADD COLUMN     "css" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "event_id" UUID,
ADD COLUMN     "height" INTEGER NOT NULL DEFAULT 600,
ADD COLUMN     "html" TEXT,
ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "variables" JSONB,
ADD COLUMN     "width" INTEGER NOT NULL DEFAULT 400;

-- CreateIndex
CREATE INDEX "badge_templates_org_id_event_id_idx" ON "badge_templates"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "badge_templates_org_id_is_default_idx" ON "badge_templates"("org_id", "is_default");

-- AddForeignKey
ALTER TABLE "badge_templates" ADD CONSTRAINT "badge_templates_event_id_org_id_fkey" FOREIGN KEY ("event_id", "org_id") REFERENCES "events"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;
