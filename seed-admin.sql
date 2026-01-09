-- Nettoyer les données existantes
TRUNCATE TABLE users, organizations, roles CASCADE;

-- Créer le rôle système SUPER_ADMIN
INSERT INTO roles (id, org_id, code, name, description, level, is_system_role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'SUPER_ADMIN',
  'Super Administrator',
  'System role - Full access across all organizations',
  0,
  true,
  NOW(),
  NOW()
);

-- Créer l'organisation Choyou
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Choyou',
  'choyou',
  NOW(),
  NOW()
);

-- Créer l'utilisateur admin@choyou.fr avec mot de passe "admin123"
-- Hash bcrypt pour "admin123"
INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role_id, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'admin@choyou.fr',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Admin',
  'Choyou',
  '00000000-0000-0000-0000-000000000001',
  true,
  NOW(),
  NOW()
);
