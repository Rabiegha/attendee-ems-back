-- ================================================================
-- STEP 1: MULTI-TENANT REFACTOR MIGRATION
-- ================================================================
-- Ce fichier contient la migration complète pour le refactor multi-tenant
-- avec contraintes DB strictes pour garantir les invariants

-- ================================================================
-- 1. CRÉATION DES NOUVEAUX ENUMS
-- ================================================================

-- Enum pour le scope des rôles platform
CREATE TYPE "PlatformScope" AS ENUM ('all', 'assigned');

-- ================================================================
-- 2. BACKUP ET PRÉPARATION
-- ================================================================

-- Sauvegarder les données existantes avant migration
CREATE TABLE IF NOT EXISTS _migration_backup_users AS 
SELECT * FROM users;

CREATE TABLE IF NOT EXISTS _migration_backup_roles AS 
SELECT * FROM roles;

-- ================================================================
-- 3. MODIFICATION DE LA TABLE USERS (devient globale)
-- ================================================================

-- Supprimer les contraintes existantes
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_org_id_fkey";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_id_fkey";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_org_id_key";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_id_org_id_key";

-- Supprimer les index existants qui ne sont plus nécessaires
DROP INDEX IF EXISTS "users_org_id_idx";
DROP INDEX IF EXISTS "users_role_id_idx";

-- Supprimer les colonnes org_id et role_id (elles seront dans les tables d'assignation)
ALTER TABLE "users" DROP COLUMN IF EXISTS "org_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "role_id";

-- Rendre email unique globalement
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");

-- Ajouter les nouveaux index
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_is_active_idx" ON "users"("is_active");

-- ================================================================
-- 4. MODIFICATION DE LA TABLE ROLES (tenant + platform)
-- ================================================================

-- Ajouter les nouveaux champs pour RBAC avancé
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "rank" INTEGER;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "role_type" TEXT;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_platform" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_root" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "managed_by_template" BOOLEAN NOT NULL DEFAULT false;

-- Créer la contrainte unique composite (id, org_id) nécessaire pour les FK composites
-- Cette contrainte est CRUCIALE pour permettre les FK composites dans tenant_user_roles
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_id_org_id_key";
ALTER TABLE "roles" ADD CONSTRAINT "roles_id_org_id_key" UNIQUE ("id", "org_id");

-- Ajouter les index pour performance
CREATE INDEX IF NOT EXISTS "roles_is_platform_idx" ON "roles"("is_platform");
CREATE INDEX IF NOT EXISTS "roles_is_root_idx" ON "roles"("is_root");

-- ================================================================
-- 5. CRÉATION DE LA TABLE ORG_USERS (membership multi-tenant)
-- ================================================================

CREATE TABLE IF NOT EXISTS "org_users" (
    "user_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_users_pkey" PRIMARY KEY ("user_id", "org_id")
);

-- Contrainte unique pour éviter les doublons
ALTER TABLE "org_users" ADD CONSTRAINT "org_users_user_id_org_id_key" UNIQUE ("user_id", "org_id");

-- Foreign Keys
ALTER TABLE "org_users" ADD CONSTRAINT "org_users_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "org_users" ADD CONSTRAINT "org_users_org_id_fkey" 
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index pour performance
CREATE INDEX "org_users_user_id_idx" ON "org_users"("user_id");
CREATE INDEX "org_users_org_id_idx" ON "org_users"("org_id");

-- ================================================================
-- 6. CRÉATION DE LA TABLE TENANT_USER_ROLES (assignation tenant)
-- ================================================================

CREATE TABLE IF NOT EXISTS "tenant_user_roles" (
    "user_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_user_roles_pkey" PRIMARY KEY ("user_id", "org_id")
);

-- INVARIANT 1: Un user a exactement 1 rôle tenant actif par org
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_user_id_org_id_key" 
    UNIQUE ("user_id", "org_id");

-- INVARIANT 2: Le user doit appartenir à l'org (FK composite vers org_users)
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_user_id_org_id_fkey" 
    FOREIGN KEY ("user_id", "org_id") REFERENCES "org_users"("user_id", "org_id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

-- INVARIANT 3: Le role doit appartenir à la même org (FK composite vers roles)
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_role_id_org_id_fkey" 
    FOREIGN KEY ("role_id", "org_id") REFERENCES "roles"("id", "org_id") 
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK simple vers user (pour faciliter les requêtes)
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK simple vers organization (pour faciliter les requêtes)
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_org_id_fkey" 
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index pour performance
CREATE INDEX "tenant_user_roles_user_id_idx" ON "tenant_user_roles"("user_id");
CREATE INDEX "tenant_user_roles_org_id_idx" ON "tenant_user_roles"("org_id");
CREATE INDEX "tenant_user_roles_role_id_idx" ON "tenant_user_roles"("role_id");

-- ================================================================
-- 7. CRÉATION DE LA TABLE PLATFORM_USER_ROLES (assignation platform)
-- ================================================================

CREATE TABLE IF NOT EXISTS "platform_user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope" "PlatformScope" NOT NULL DEFAULT 'all',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_user_roles_pkey" PRIMARY KEY ("user_id")
);

-- INVARIANT: Un user a au maximum 1 rôle platform actif
ALTER TABLE "platform_user_roles" ADD CONSTRAINT "platform_user_roles_user_id_key" 
    UNIQUE ("user_id");

-- Foreign Keys
ALTER TABLE "platform_user_roles" ADD CONSTRAINT "platform_user_roles_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_user_roles" ADD CONSTRAINT "platform_user_roles_role_id_fkey" 
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index pour performance
CREATE INDEX "platform_user_roles_role_id_idx" ON "platform_user_roles"("role_id");
CREATE INDEX "platform_user_roles_scope_idx" ON "platform_user_roles"("scope");

-- ================================================================
-- 8. TRIGGER POUR GARANTIR QUE ROLE PLATFORM (optionnel mais recommandé)
-- ================================================================

-- Ce trigger garantit qu'on ne peut assigner que des rôles platform (org_id IS NULL)
-- dans la table platform_user_roles

CREATE OR REPLACE FUNCTION check_platform_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Vérifier que le role_id référence un rôle platform (org_id IS NULL)
    IF EXISTS (
        SELECT 1 FROM roles 
        WHERE id = NEW.role_id 
        AND org_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Cannot assign tenant role (org_id IS NOT NULL) to platform_user_roles. Use tenant_user_roles instead.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_platform_role
    BEFORE INSERT OR UPDATE ON "platform_user_roles"
    FOR EACH ROW
    EXECUTE FUNCTION check_platform_role();

-- ================================================================
-- 9. TRIGGER POUR GARANTIR QUE ROLE TENANT (optionnel mais recommandé)
-- ================================================================

-- Ce trigger garantit qu'on ne peut assigner que des rôles tenant (org_id NOT NULL)
-- dans la table tenant_user_roles

CREATE OR REPLACE FUNCTION check_tenant_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Vérifier que le role_id référence un rôle tenant (org_id IS NOT NULL)
    IF EXISTS (
        SELECT 1 FROM roles 
        WHERE id = NEW.role_id 
        AND org_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot assign platform role (org_id IS NULL) to tenant_user_roles. Use platform_user_roles instead.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_tenant_role
    BEFORE INSERT OR UPDATE ON "tenant_user_roles"
    FOR EACH ROW
    EXECUTE FUNCTION check_tenant_role();

-- ================================================================
-- 10. CRÉATION DE LA TABLE PLATFORM_USER_ORG_ACCESS (scope=assigned)
-- ================================================================

CREATE TABLE IF NOT EXISTS "platform_user_org_access" (
    "user_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_user_org_access_pkey" PRIMARY KEY ("user_id", "org_id")
);

-- Contrainte unique
ALTER TABLE "platform_user_org_access" ADD CONSTRAINT "platform_user_org_access_user_id_org_id_key" 
    UNIQUE ("user_id", "org_id");

-- Foreign Keys
ALTER TABLE "platform_user_org_access" ADD CONSTRAINT "platform_user_org_access_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_user_org_access" ADD CONSTRAINT "platform_user_org_access_org_id_fkey" 
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index pour performance
CREATE INDEX "platform_user_org_access_user_id_idx" ON "platform_user_org_access"("user_id");
CREATE INDEX "platform_user_org_access_org_id_idx" ON "platform_user_org_access"("org_id");

-- ================================================================
-- 11. MIGRATION DES DONNÉES EXISTANTES (si nécessaire)
-- ================================================================

-- Cette section doit être adaptée selon vos données existantes
-- Exemple de logique de migration:

-- 1. Créer les memberships org_users à partir de l'ancienne table users
INSERT INTO "org_users" ("user_id", "org_id", "joined_at", "created_at", "updated_at")
SELECT 
    u.id,
    u.org_id,
    u.created_at,
    u.created_at,
    u.updated_at
FROM _migration_backup_users u
ON CONFLICT ("user_id", "org_id") DO NOTHING;

-- 2. Créer les assignations tenant_user_roles à partir de l'ancienne structure
-- IMPORTANT: Ne migrer que les rôles TENANT (org_id IS NOT NULL)
-- Les rôles platform seront assignés manuellement après la migration
INSERT INTO "tenant_user_roles" ("user_id", "org_id", "role_id", "assigned_at", "created_at", "updated_at")
SELECT 
    u.id,
    u.org_id,
    u.role_id,
    u.created_at,
    u.created_at,
    u.updated_at
FROM _migration_backup_users u
INNER JOIN roles r ON u.role_id = r.id
WHERE u.role_id IS NOT NULL
  AND r.org_id IS NOT NULL  -- Seulement les rôles tenant
ON CONFLICT ("user_id", "org_id") DO NOTHING;

-- ================================================================
-- 12. VALIDATION POST-MIGRATION
-- ================================================================

-- Vérifier que tous les users ont au moins un membership
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM users u
    WHERE NOT EXISTS (
        SELECT 1 FROM org_users ou WHERE ou.user_id = u.id
    );
    
    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % users without any org membership', orphan_count;
    END IF;
END $$;

-- Vérifier que tous les tenant_user_roles ont un membership correspondant
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM tenant_user_roles tur
    WHERE NOT EXISTS (
        SELECT 1 FROM org_users ou 
        WHERE ou.user_id = tur.user_id 
        AND ou.org_id = tur.org_id
    );
    
    IF invalid_count > 0 THEN
        RAISE WARNING 'Found % tenant_user_roles without corresponding org_users membership', invalid_count;
    END IF;
END $$;

-- ================================================================
-- 13. NETTOYAGE (optionnel - à décommenter après validation)
-- ================================================================

-- DROP TABLE IF EXISTS _migration_backup_users;
-- DROP TABLE IF EXISTS _migration_backup_roles;

-- ================================================================
-- FIN DE LA MIGRATION
-- ================================================================

COMMENT ON TABLE "org_users" IS 'Multi-tenant membership: a user can belong to multiple organizations';
COMMENT ON TABLE "tenant_user_roles" IS 'Tenant role assignments: 1 active role per user per org, with DB-level invariants';
COMMENT ON TABLE "platform_user_roles" IS 'Platform role assignments: 1 active platform role max per user (support/root)';
COMMENT ON TABLE "platform_user_org_access" IS 'Org access for platform users with scope=assigned';
