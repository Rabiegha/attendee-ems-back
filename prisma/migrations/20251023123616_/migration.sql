/*
  Warnings:

  - A unique constraint covering the columns `[id,org_id]` on the table `attendees` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "attendee_revisions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "attendees" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "attendees_id_org_id_key" ON "attendees"("id", "org_id");
