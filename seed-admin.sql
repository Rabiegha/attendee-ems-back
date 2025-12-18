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
)
ON CONFLICT (org_id, code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Créer l'organisation admin
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Admin Organization',
  'admin-org',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Créer l'utilisateur admin avec le rôle SUPER_ADMIN
INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role_id, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'admin@attendee.fr',
  '$2b$10$xNeZko5hCVm7VEyPiILOOe5C/ftGAGUM8fCmwoi89D.CEd4PqPa1C',
  'Admin',
  'User',
  '00000000-0000-0000-0000-000000000001',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email, org_id) DO NOTHING;
