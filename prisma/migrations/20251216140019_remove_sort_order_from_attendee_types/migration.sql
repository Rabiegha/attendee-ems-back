/*
  Warnings:

  - You are about to drop the column `sort_order` on the `attendee_types` table. All the data in the column will be lost.
  - You are about to drop the column `sort_order` on the `event_attendee_types` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."attendee_types_org_id_sort_order_idx";

-- DropIndex
DROP INDEX "public"."event_attendee_types_org_id_event_id_sort_order_idx";

-- AlterTable
ALTER TABLE "attendee_types" DROP COLUMN "sort_order";

-- AlterTable
ALTER TABLE "event_attendee_types" DROP COLUMN "sort_order";

-- CreateIndex
CREATE INDEX "event_attendee_types_org_id_event_id_idx" ON "event_attendee_types"("org_id", "event_id");
