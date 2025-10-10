/*
  Warnings:

  - A unique constraint covering the columns `[reset_token]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reset_token" TEXT,
ADD COLUMN     "reset_token_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");
