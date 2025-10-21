# 📊 Schéma Base de Données - EMS

## 🏗️ Architecture Multi-Tenant

### Principe d'Isolation
- **Champ `org_id`** : Présent sur toutes les tables métier
- **Contraintes composites** : FK avec `(resource_id, org_id)` pour garantir isolation
- **SUPER_ADMIN exception** : Seul rôle avec accès cross-tenant

### Tables Principales

#### 🏢 Organizations
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 👥 Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  email CITEXT NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  country TEXT,
  metadata JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  reset_token TEXT UNIQUE,
  reset_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(org_id, email),
  UNIQUE(id, org_id) -- Pour FK composites
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_role_id ON users(role_id);
```

#### 🔐 Roles & Permissions
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (role_id, permission_id)
);
```

#### 🎫 Events
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'draft',
  capacity INTEGER,
  location_type TEXT NOT NULL DEFAULT 'physical',
  address_formatted TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(org_id, code),
  UNIQUE(id, org_id) -- Pour FK composites
);

CREATE INDEX idx_events_org_id ON events(org_id);
CREATE INDEX idx_events_start_at ON events(start_at);
CREATE INDEX idx_events_status ON events(status);
```

#### 👤 Attendees (CRM Global)
```sql
CREATE TABLE attendees (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email CITEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  country TEXT,
  metadata JSONB,
  labels TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(org_id, email),
  UNIQUE(id, org_id) -- Pour FK composites
);

CREATE INDEX idx_attendees_org_id ON attendees(org_id);
CREATE INDEX idx_attendees_email ON attendees(email);
```

#### 📝 Registrations (Inscriptions Événements)
```sql
CREATE TABLE registrations (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendee_id UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered',
  attendance_type TEXT CHECK (attendance_type IN ('online','onsite','hybrid')),
  form_data JSONB,
  source_url TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(event_id, attendee_id),
  UNIQUE(id, event_id, org_id) -- Pour FK composites
);

-- Contraintes FK composites pour isolation multi-tenant
ALTER TABLE registrations 
ADD CONSTRAINT fk_registrations_event_org 
FOREIGN KEY (event_id, org_id) REFERENCES events(id, org_id);

ALTER TABLE registrations 
ADD CONSTRAINT fk_registrations_attendee_org 
FOREIGN KEY (attendee_id, org_id) REFERENCES attendees(id, org_id);
```

#### 📧 Invitations
```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  email CITEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status invitation_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(email, org_id) -- Une invitation active par email/org
);

CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

CREATE INDEX idx_invitations_org_id ON invitations(org_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);
```

#### 🔄 Refresh Tokens (Sécurité)
```sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti TEXT NOT NULL UNIQUE, -- JWT ID
  token_hash TEXT NOT NULL, -- Hash du token (jamais en clair)
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_id TEXT, -- JTI du nouveau token (rotation)
  
  INDEX(user_id),
  INDEX(jti),
  INDEX(expires_at)
);
```

## 🔄 Migrations Appliquées

### Historique des Migrations
1. **20251001094037_init** - Tables de base
2. **20251001180000_add_timestamps** - Standardisation timestamps
3. **20251008130508_** - Corrections schéma
4. **20251008145222_add_user_profile_fields** - Champs profil utilisateur
5. **20251010121214_adding_password_managing_fieleds** - Gestion mots de passe
6. **20251013133919_add_invitation_token** - Tokens invitation
7. **20251013154500_add_refresh_tokens** - Système refresh tokens
8. **20251014135351_create_invitation_table** - Table invitations complète

### Dernière Migration Critique
```sql
-- Migration 20251014135351_create_invitation_table
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- Suppression anciennes colonnes users
ALTER TABLE "users" 
DROP COLUMN "invitation_token",
DROP COLUMN "invitation_token_expires_at",
DROP COLUMN "must_change_password";

-- Création table invitations dédiée
CREATE TABLE "invitations" (
  "id" UUID NOT NULL,
  "email" CITEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "org_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "invited_by_user_id" UUID NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);
```

## 🌱 Seeders

### Organisations
```sql
-- System (SUPER_ADMIN)
INSERT INTO organizations (id, name, slug) VALUES 
('sys-uuid', 'System', 'system');

-- Acme Corp (Utilisateurs test)
INSERT INTO organizations (id, name, slug) VALUES 
('acme-uuid', 'Acme Corp', 'acme-corp');
```

### Rôles et Permissions
```sql
-- 6 rôles système
INSERT INTO roles (id, code, name, description) VALUES
('role-1', 'SUPER_ADMIN', 'Super Administrator', 'Accès global omniscient'),
('role-2', 'ADMIN', 'Administrator', 'Gestion complète organisation'),
('role-3', 'MANAGER', 'Manager', 'Gestion événements'),
('role-4', 'VIEWER', 'Viewer', 'Lecture seule organisation'),
('role-5', 'PARTNER', 'Partner', 'Événements assignés'),
('role-6', 'HOSTESS', 'Hostess', 'Check-in et scan QR');

-- 18 permissions granulaires
INSERT INTO permissions (id, code, name) VALUES
('perm-1', 'read_any_organization', 'Read any organization'),
('perm-2', 'create_organization', 'Create organization'),
('perm-3', 'create_users', 'Create users'),
('perm-4', 'read_any_user_info', 'Read any user info'),
-- ... etc
```

### Utilisateurs de Test
```sql
-- Super Admin
INSERT INTO users (id, org_id, role_id, email, password_hash, first_name, last_name) VALUES
('user-1', 'sys-uuid', 'role-1', 'john.doe@system.com', '$hash', 'John', 'Doe');

-- Admin Acme
INSERT INTO users (id, org_id, role_id, email, password_hash, first_name, last_name) VALUES
('user-2', 'acme-uuid', 'role-2', 'jane.smith@acme.com', '$hash', 'Jane', 'Smith');

-- Manager Acme
INSERT INTO users (id, org_id, role_id, email, password_hash, first_name, last_name) VALUES
('user-3', 'acme-uuid', 'role-3', 'bob.johnson@acme.com', '$hash', 'Bob', 'Johnson');
-- ... etc
```

## 🔒 Sécurité et Constraints

### Isolation Multi-Tenant
```sql
-- Exemple: Contrainte FK composite events → users (même org)
ALTER TABLE events 
ADD CONSTRAINT fk_events_created_by_same_org 
FOREIGN KEY (created_by, org_id) REFERENCES users(id, org_id);

-- Politique RLS (Row Level Security) - Optionnel
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_org_isolation ON events
FOR ALL TO app_role
USING (org_id = current_setting('app.current_org_id')::UUID);
```

### Indexes de Performance
```sql
-- Recherche par organisation (critique)
CREATE INDEX idx_users_org_role ON users(org_id, role_id);
CREATE INDEX idx_events_org_status ON events(org_id, status);
CREATE INDEX idx_registrations_event_status ON registrations(event_id, status);

-- Recherche par email (auth)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_invitations_email ON invitations(email);

-- Recherche temporelle
CREATE INDEX idx_events_start_end ON events(start_at, end_at);
CREATE INDEX idx_invitations_expires ON invitations(expires_at);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

### Nettoyage Automatique
```sql
-- Procédure de nettoyage tokens expirés
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  -- Supprimer refresh tokens expirés
  DELETE FROM refresh_tokens 
  WHERE expires_at < NOW() OR revoked_at IS NOT NULL;
  
  -- Marquer invitations expirées
  UPDATE invitations 
  SET status = 'EXPIRED' 
  WHERE expires_at < NOW() AND status = 'PENDING';
END;
$$ LANGUAGE plpgsql;

-- Tâche cron (à configurer)
-- SELECT cron.schedule('cleanup-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens();');
```

## 📈 Évolutions Futures

### Tables Prévues
- **badge_templates** : Templates de badges événements
- **subevents** : Sous-événements
- **presence_visits** : Tracking présence détaillé
- **partner_scans** : Historique scans QR
- **event_access** : Permissions événements spécifiques

### Optimisations
- **Partitioning** par org_id pour grandes installations
- **Read replicas** pour analytics
- **Materialized views** pour statistiques
- **Full-text search** sur événements et participants

---

**Schéma maintenu automatiquement par Prisma**  
**Dernière migration** : 20251014135351  
**Dernière mise à jour** : Octobre 2025