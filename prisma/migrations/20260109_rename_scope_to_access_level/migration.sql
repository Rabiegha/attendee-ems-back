-- Migration: Renommer scope en access_level et TenantAccessScope en PlatformAccessLevel
-- Date: 2026-01-09
-- Description: Clarification du nommage pour éviter la confusion avec les scopes de permissions

-- 1. Créer le nouvel enum PlatformAccessLevel
CREATE TYPE "PlatformAccessLevel" AS ENUM ('GLOBAL', 'LIMITED');

-- 2. Ajouter la nouvelle colonne access_level
ALTER TABLE "platform_user_roles" 
ADD COLUMN "access_level" "PlatformAccessLevel";

-- 3. Migrer les données de scope vers access_level
UPDATE "platform_user_roles"
SET "access_level" = CASE 
  WHEN "scope" = 'tenant_any' THEN 'GLOBAL'::"PlatformAccessLevel"
  WHEN "scope" = 'tenant_assigned' THEN 'LIMITED'::"PlatformAccessLevel"
  ELSE 'GLOBAL'::"PlatformAccessLevel"
END;

-- 4. Rendre access_level NOT NULL avec default
ALTER TABLE "platform_user_roles" 
ALTER COLUMN "access_level" SET NOT NULL,
ALTER COLUMN "access_level" SET DEFAULT 'GLOBAL'::"PlatformAccessLevel";

-- 5. Supprimer l'index sur l'ancienne colonne scope
DROP INDEX IF EXISTS "platform_user_roles_scope_idx";

-- 6. Créer l'index sur la nouvelle colonne access_level
CREATE INDEX "platform_user_roles_access_level_idx" ON "platform_user_roles"("access_level");

-- 7. Supprimer l'ancienne colonne scope
ALTER TABLE "platform_user_roles" DROP COLUMN "scope";

-- 8. Supprimer l'ancien enum TenantAccessScope
DROP TYPE "TenantAccessScope";
