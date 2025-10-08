/*
  Warnings:

  - You are about to drop the column `org_id` on the `permissions` table. All the data in the column will be lost.
  - The primary key for the `role_permissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `role_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `org_id` on the `role_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `org_id` on the `roles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `permissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,org_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- DropForeignKey
ALTER TABLE "public"."permissions" DROP CONSTRAINT "permissions_org_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."role_permissions" DROP CONSTRAINT "role_permissions_org_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."roles" DROP CONSTRAINT "roles_org_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."users" DROP CONSTRAINT "users_org_id_fkey";

-- DropIndex
DROP INDEX "public"."permissions_org_id_code_key";

-- DropIndex
DROP INDEX "public"."permissions_org_id_idx";

-- DropIndex
DROP INDEX "public"."role_permissions_org_id_idx";

-- DropIndex
DROP INDEX "public"."role_permissions_org_id_role_id_permission_id_key";

-- DropIndex
DROP INDEX "public"."roles_org_id_code_key";

-- DropIndex
DROP INDEX "public"."roles_org_id_idx";

-- DropIndex
DROP INDEX "public"."users_org_id_email_key";

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "slug" SET DATA TYPE CITEXT;

-- AlterTable
ALTER TABLE "permissions" DROP COLUMN "org_id",
ADD COLUMN     "description" TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_pkey",
DROP COLUMN "id",
DROP COLUMN "org_id",
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");

-- AlterTable
ALTER TABLE "roles" DROP COLUMN "org_id",
ADD COLUMN     "description" TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE CITEXT;

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_org_id_key" ON "users"("email", "org_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
