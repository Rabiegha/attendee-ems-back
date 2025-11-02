/*
  Warnings:

  - A unique constraint covering the columns `[registration_id]` on the table `badges` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `event_id` to the `badges` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BadgeStatus" AS ENUM ('pending', 'generating', 'completed', 'failed');

-- AlterTable
ALTER TABLE "badges" ADD COLUMN     "css_snapshot" TEXT,
ADD COLUMN     "data_snapshot" JSONB,
ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "event_id" UUID NOT NULL,
ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "generated_by" UUID,
ADD COLUMN     "html_snapshot" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "last_printed_at" TIMESTAMP(3),
ADD COLUMN     "pdf_url" TEXT,
ADD COLUMN     "print_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "BadgeStatus" NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "badges_org_id_event_id_idx" ON "badges"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "badges_badge_template_id_idx" ON "badges"("badge_template_id");

-- CreateIndex
CREATE INDEX "badges_status_idx" ON "badges"("status");

-- CreateIndex
CREATE INDEX "badges_generated_at_idx" ON "badges"("generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "badges_registration_id_key" ON "badges"("registration_id");

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_event_id_org_id_fkey" FOREIGN KEY ("event_id", "org_id") REFERENCES "events"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
