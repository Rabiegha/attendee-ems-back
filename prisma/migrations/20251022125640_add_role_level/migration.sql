-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 99;

-- Update existing roles with their hierarchy levels
UPDATE "roles" SET "level" = 0 WHERE "code" = 'SUPER_ADMIN';
UPDATE "roles" SET "level" = 1 WHERE "code" = 'ADMIN';
UPDATE "roles" SET "level" = 2 WHERE "code" = 'MANAGER';
UPDATE "roles" SET "level" = 3 WHERE "code" = 'PARTNER';
UPDATE "roles" SET "level" = 4 WHERE "code" = 'VIEWER';
UPDATE "roles" SET "level" = 5 WHERE "code" = 'HOSTESS';
