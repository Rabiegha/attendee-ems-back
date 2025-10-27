/*
  Warnings:

  - A unique constraint covering the columns `[code,scope]` on the table `permissions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('any', 'org', 'assigned', 'none');

-- DropIndex
DROP INDEX "public"."permissions_code_key";

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "scope" "PermissionScope" NOT NULL DEFAULT 'none';

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_scope_key" ON "permissions"("code", "scope");
