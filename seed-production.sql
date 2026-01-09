-- ========================================
-- SEED PRODUCTION - Environnement vierge
-- Organisation: Choyou
-- Admin: admin@attendee.fr / admin123
-- ========================================

-- Vérifier si des données existent déjà
DO $$
BEGIN
    -- Si la table users contient des données, ne rien faire
    IF EXISTS (SELECT 1 FROM users LIMIT 1) THEN
        RAISE NOTICE 'Database already contains data. Skipping seed.';
        RAISE NOTICE 'To force reseed, run: TRUNCATE TABLE users, organizations, roles CASCADE; then re-run this seed.';
        RETURN;
    END IF;

    -- Sinon, créer les données initiales
    RAISE NOTICE 'Creating initial production data...';
END $$;

-- Créer le rôle ADMIN (pas SUPER_ADMIN)
INSERT INTO roles (id, org_id, code, name, description, level, is_system_role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'ADMIN',
  'Administrator',
  'Organization administrator - Full access within organization',
  1,
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Créer l'organisation Choyou (seulement si elle n'existe pas)
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Choyou',
  'choyou',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Créer l'utilisateur admin@attendee.fr avec rôle ADMIN simple
-- Le hash sera généré dynamiquement par le script de déploiement
-- Ce fichier est un template, le hash sera remplacé avant exécution
INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role_id, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'admin@attendee.fr',
  '{{ADMIN_PASSWORD_HASH}}',
  'Admin',
  'Attendee',
  '00000000-0000-0000-0000-000000000001',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
