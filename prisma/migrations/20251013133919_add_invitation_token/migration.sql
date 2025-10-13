/*
  Warnings:

  - A unique constraint covering the columns `[invitation_token]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "invitation_token" TEXT,
ADD COLUMN     "invitation_token_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_invitation_token_key" ON "users"("invitation_token");
