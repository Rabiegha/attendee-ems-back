# 🎫 Attendee EMS - Event Management System Backend

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?logo=nestjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

**API REST moderne pour la gestion d'événements B2B avec multi-tenancy et RBAC avancé**

[Fonctionnalités](#-fonctionnalités) • [Démarrage](#-démarrage-rapide) • [Documentation](#-documentation) • [Architecture](#-architecture)

</div>

---

## 📋 Vue d'ensemble

Backend NestJS pour système de gestion d'événements professionnel avec :
- **Multi-tenancy** complet avec isolation des données par organisation
- **Authentification JWT** avec refresh tokens rotatifs et révocation
- **RBAC avancé** avec 6 niveaux de rôles et permissions granulaires via CASL
- **Gestion d'événements** complète (création, participants, badges, check-in)
- **Système d'invitations** avec tokens sécurisés et email
- **Génération de badges PDF** dynamiques avec QR codes
- **API publique** pour inscriptions sans authentification

### 🏗️ Stack Technique

| Technologie | Version | Usage |
|------------|---------|-------|
| **NestJS** | 10.x | Framework backend |
| **TypeScript** | 5.x | Langage (strict mode) |
| **PostgreSQL** | 16 | Base de données |
| **Prisma** | 5.x | ORM + Migrations |
| **JWT** | - | Authentification |
| **CASL** | 6.x | Permissions RBAC |
| **Puppeteer** | - | Génération PDF |
| **Cloudflare R2** | - | Stockage badges |
| **class-validator** | - | Validation DTOs |
| **Docker** | - | Conteneurisation |

---

## ✨ Fonctionnalités

### 🎯 Gestion d'Événements
- ✅ Création et configuration d'événements
- ✅ Gestion des participants (attendees)
- ✅ Système de tags et catégorisation
- ✅ Check-in avec QR codes
- ✅ Statistiques en temps réel
- ✅ Soft delete et restauration

### � Multi-Tenancy
- ✅ Isolation complète des données par organisation
- ✅ Plans et modules configurables par organisation
- ✅ Utilisateurs plateforme avec accès multi-organisations
- ✅ Rôles personnalisables par organisation

### 🔐 Authentification & Sécurité
- ✅ JWT avec access tokens (15min) et refresh tokens (30j)
- ✅ Rotation automatique des refresh tokens
- ✅ Révocation des tokens en base de données
- ✅ Cookies HttpOnly sécurisés
- ✅ Rate limiting et CORS configurables

### 🛡️ RBAC & Permissions
- ✅ 6 rôles hiérarchiques (Super Admin → Hostess)
- ✅ Permissions granulaires via CASL
- ✅ Scopes contextuels (own, assigned, team, any)
- ✅ Plafonds de permissions par rôle
- ✅ Conditions dynamiques sur les permissions

### 📄 Gestion de Badges
- ✅ Templates de badges personnalisables
- ✅ Génération PDF avec Puppeteer
- ✅ QR codes uniques par participant
- ✅ Stockage sur Cloudflare R2
- ✅ Preview en temps réel

### 📧 Système d'Invitations
- ✅ Envoi d'emails d'invitation avec tokens
- ✅ Workflow de complétion de compte
- ✅ Expiration automatique des invitations
- ✅ Configuration SMTP flexible

### 🌐 API Publique
- ✅ Inscription aux événements sans authentification
- ✅ Tokens publics d'événements
- ✅ Validation des capacités
- ✅ Gestion des doublons intelligente

---

## �🚀 Démarrage Rapide

### Prérequis

- **Node.js** 18+ (LTS recommandé)
- **Docker** & **Docker Compose** 20.10+
- **Git**

### Installation avec Docker (Recommandé)

```bash
# 1. Cloner le repository
git clone https://github.com/Rabiegha/attendee-ems-back.git
cd attendee-ems-back

# 2. Copier et configurer les variables d'environnement
cp .env.example .env.docker

# 3. Démarrer tous les services (PostgreSQL + API)
npm run docker:up

# 4. Attendre que les migrations et seeders s'exécutent automatiquement
# Vérifier les logs
docker compose -f docker-compose.dev.yml logs -f api

# 5. L'API est prête !
```

✅ **API** : http://localhost:3000  
✅ **Swagger** : http://localhost:3000/api/docs  
✅ **PostgreSQL** : localhost:5432

### Installation Manuelle (Alternative)

```bash
# 1. Cloner le repository
git clone https://github.com/Rabiegha/attendee-ems-back.git
cd attendee-ems-back

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env et configurer DATABASE_URL, JWT_ACCESS_SECRET, etc.

# 4. Démarrer PostgreSQL (si pas déjà installé)
# Exemple avec Docker uniquement pour la DB :
docker run -d \
  --name ems-postgres \
  -e POSTGRES_DB=ems \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine

# 5. Appliquer les migrations Prisma
npx prisma migrate deploy

# 6. Générer le client Prisma
npx prisma generate

# 7. Peupler la base de données (optionnel mais recommandé)
npm run db:seed

# 8. Démarrer le serveur de développement
npm run start:dev
```

### Comptes de Test

Après le seed, utilisez ces comptes pour vous connecter :

| Nom | Email | Mot de passe | Rôle | Organisation |
|-----|-------|--------------|------|--------------|
| Super Admin | `superadmin@platform.com` | `admin123` | SUPER_ADMIN | Plateforme |
| Admin ACME | `admin@acme.com` | `admin123` | ADMIN | ACME Corp |
| Manager ACME | `manager@acme.com` | `manager123` | MANAGER | ACME Corp |
| Viewer ACME | `viewer@acme.com` | `viewer123` | VIEWER | ACME Corp |

**Test de connexion** :
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"admin123"}'
```
---

## 📚 Documentation

Documentation complète disponible dans `/docs` :

| Document | Description |
|----------|-------------|
| [ARCHITECTURE_RBAC.md](docs/ARCHITECTURE_RBAC.md) | Architecture RBAC multi-tenant détaillée |
| [CONFIGURATION_SMTP_R2.md](docs/CONFIGURATION_SMTP_R2.md) | **Guide de configuration SMTP & Cloudflare R2** |
| [QUICK_START.md](docs/QUICK_START.md) | Guide de démarrage étendu |
| [PHASE1_API.md](docs/PHASE1_API.md) | Documentation API complète |
| [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | Guide des tests |
| [RBAC_GUIDE.md](docs/RBAC_GUIDE.md) | Guide d'utilisation RBAC |
| [SECURITY.md](SECURITY.md) | Politique de sécurité |

**Swagger/OpenAPI** : http://localhost:3000/api/docs (quand le serveur est lancé)

---

## 🏗️ Architecture

### Principes d'Architecture

- **Multi-tenant** : Isolation complète des données par `org_id`
- **RBAC** : Permissions granulaires avec CASL côté serveur
- **Clean Architecture** : Séparation modules/services/controllers
- **API-First** : Design REST avec DTOs validés
- **Type-Safe** : TypeScript strict + Prisma ORM

### Structure des Dossiers

```
src/
├── main.ts                          # Point d'entrée + Bootstrap
├── app.module.ts                    # Module racine
│
├── modules/                         # Modules métier
│   ├── users/                       # Gestion utilisateurs
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   └── dto/                     # Data Transfer Objects
│   ├── organizations/               # Multi-tenancy
│   ├── events/                      # Gestion événements
│   ├── attendees/                   # Gestion participants
│   ├── registrations/               # Inscriptions événements
│   ├── invitations/                 # Système invitations
│   ├── roles/                       # Rôles RBAC
│   ├── permissions/                 # Permissions RBAC
│   ├── badge-generation/            # Génération badges PDF
│   ├── email/                       # Service email SMTP
│   ├── tags/                        # Tags et catégorisation
│   └── public/                      # API publique (sans auth)
│
├── auth/                            # Authentification
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── jwt.strategy.ts              # Stratégie JWT access tokens
│   ├── jwt-refresh.strategy.ts     # Stratégie refresh tokens
│   └── guards/                      # Guards authentification
│
├── casl/                            # RBAC avec CASL
│   ├── casl-ability.factory.ts     # Factory des permissions
│   ├── casl.guard.ts                # Guard CASL
│   └── decorators/                  # @CheckPolicies, etc.
│
├── common/                          # Code partagé
│   ├── decorators/                  # @User(), @OrgId(), etc.
│   ├── guards/                      # Guards globaux
│   ├── filters/                     # Exception filters
│   ├── interceptors/                # Interceptors
│   └── pipes/                       # Validation pipes
│
└── config/                          # Configuration
    ├── database.config.ts
    └── jwt.config.ts

prisma/
├── schema.prisma                    # Schéma de données
├── migrations/                      # Migrations versionnées
└── seed.ts                          # Données de seed
```

---

## 🔐 Authentification & Sécurité

### Architecture JWT Dual-Token

#### 🎫 Access Tokens (Courts)
- **Durée de vie** : 15 minutes
- **Stockage** : Mémoire côté client (Redux/state)
- **Usage** : Authentification de chaque requête API
- **Format** : `Authorization: Bearer <access_token>`
- **Contenu JWT** :
  ```json
  {
    "sub": "user-uuid",
    "email": "user@example.com",
    "orgId": "org-uuid",
    "roleId": "role-uuid",
    "iat": 1234567890,
    "exp": 1234568790
  }
  ```

#### 🔄 Refresh Tokens (Longs)
- **Durée de vie** : 30 jours
- **Stockage** : 
  - Cookie HttpOnly sécurisé (côté client)
  - Base de données (côté serveur pour révocation)
- **Usage** : Renouvellement automatique des access tokens
- **Rotation** : Nouveau refresh token généré à chaque utilisation
- **Révocation** : Possibilité de révoquer individuellement

### Flow d'Authentification

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB

    Note over Client,DB: 1. Login Initial
    Client->>API: POST /auth/login
    API->>DB: Vérifier credentials
    DB-->>API: User + Role
    API->>DB: Créer refresh_token
    API-->>Client: access_token (15min) + Set-Cookie: refresh_token (30j)

    Note over Client,DB: 2. Requête API Normale
    Client->>API: GET /events (Bearer: access_token)
    API->>API: Valider JWT access_token
    API-->>Client: Response data

    Note over Client,DB: 3. Access Token Expiré
    Client->>API: GET /events (Bearer: expired_token)
    API-->>Client: 401 Unauthorized
    Client->>API: POST /auth/refresh (Cookie: refresh_token)
    API->>DB: Vérifier refresh_token
    API->>DB: Révoquer ancien + Créer nouveau
    API-->>Client: Nouveau access_token + Set-Cookie: nouveau refresh_token

    Note over Client,DB: 4. Logout
    Client->>API: POST /auth/logout
    API->>DB: Révoquer refresh_token
    API-->>Client: 200 OK
```

### Endpoints d'Authentification

```bash
# Login
POST /auth/login
Content-Type: application/json

{
  "email": "admin@acme.com",
  "password": "admin123"
}

Response:
{
  "access_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "admin@acme.com",
    "first_name": "Admin",
    "last_name": "User",
    "org_id": "org-uuid",
    "role": { "code": "ADMIN", "name": "Administrator" }
  }
}
+ Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict

# Refresh Token
POST /auth/refresh
Cookie: refresh_token=...

Response:
{
  "access_token": "eyJhbGc..."
}
+ Set-Cookie: refresh_token=...; HttpOnly; Secure

# Logout
POST /auth/logout
Authorization: Bearer <access_token>

Response:
{
  "message": "Successfully logged out"
}
```

### Mesures de Sécurité Implémentées

✅ **Tokens JWT** signés avec algorithme HS256  
✅ **Refresh tokens** stockés en base avec révocation possible  
✅ **Rotation automatique** des refresh tokens  
✅ **Cookies HttpOnly** pour éviter XSS  
✅ **Bcrypt** pour hash des mots de passe (rounds: 12)  
✅ **CORS** configuré avec whitelist  
✅ **Helmet** pour headers de sécurité HTTP  
✅ **Rate Limiting** sur endpoints sensibles  
✅ **Validation stricte** des DTOs avec class-validator  
✅ **SQL Injection** prévenu via Prisma ORM  
✅ **Isolation multi-tenant** stricte par org_id

---

## 🛡️ Système RBAC Multi-Tenant

### Hiérarchie des Rôles

Notre système implémente 6 niveaux de rôles avec permissions croissantes :

| Niveau | Rôle | Code | Type | Description | Cas d'usage |
|--------|------|------|------|-------------|-------------|
| 6 | 🔴 Super Admin | `SUPER_ADMIN` | Platform | Accès global cross-tenant | Maintenance plateforme |
| 5 | 🟠 Admin | `ADMIN` | Organization | Gestion complète organisation | Direction, IT |
| 4 | 🟡 Manager | `MANAGER` | Organization | Gestion événements et participants | Event managers |
| 3 | 🔵 Viewer | `VIEWER` | Organization | Lecture seule organisation | Reporting, analytics |
| 2 | 🟣 Partner | `PARTNER` | Organization | Gestion partenaires/sponsors | Relations commerciales |
| 1 | ⚪ Hostess | `HOSTESS` | Organization | Check-in événements uniquement | Personnel événementiel |

### Architecture Multi-Tenant

```
┌─────────────────────────────────────────────────────────────┐
│                      PLATEFORME                              │
│  ┌──────────────┐                                            │
│  │ Super Admin  │ ← Accès global à toutes les orgs          │
│  └──────────────┘                                            │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐     │
│  │              ORGANISATION A (ACME)                  │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │     │
│  │  │  Admin   │ │ Manager  │ │  Viewer  │           │     │
│  │  └──────────┘ └──────────┘ └──────────┘           │     │
│  │  • Événements A         • Participants A            │     │
│  │  • Badges A             • Invitations A             │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │              ORGANISATION B (TechCorp)              │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │     │
│  │  │  Admin   │ │ Partner  │ │ Hostess  │           │     │
│  │  └──────────┘ └──────────┘ └──────────┘           │     │
│  │  • Événements B         • Participants B            │     │
│  │  • Badges B             • Invitations B             │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Isolation des données** : Toutes les requêtes filtrent automatiquement par `org_id`.

### Scopes de Permissions

Les permissions utilisent 4 niveaux de scope contextuels :

| Scope | Description | Exemple |
|-------|-------------|---------|
| `own` | Uniquement ses propres ressources | Manager voit ses événements créés |
| `assigned` | Ressources assignées explicitement | Manager voit événements assignés |
| `team` | Ressources de son équipe | Manager voit événements de son équipe |
| `any` | Toutes les ressources de l'org | Admin voit tous les événements de l'org |

### Utilisation dans le Code

#### Dans les Controllers

```typescript
import { CheckPolicies } from '@/casl/decorators';
import { CaslGuard } from '@/casl/casl.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

@Controller('events')
@UseGuards(JwtAuthGuard, CaslGuard)  // Authentification + Permissions
export class EventsController {
  
  // Lecture d'événements (tous les rôles sauf HOSTESS)
  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Event'))
  async findAll(@User() user: JwtPayload) {
    // Filtre automatique par org_id du user
    return this.eventsService.findAll(user.orgId);
  }

  // Création d'événement (MANAGER+)
  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Event'))
  async create(
    @Body() createEventDto: CreateEventDto,
    @User() user: JwtPayload
  ) {
    return this.eventsService.create(createEventDto, user);
  }

  // Suppression (ADMIN uniquement)
  @Delete(':id')
  @CheckPolicies((ability) => ability.can('delete', 'Event'))
  async remove(@Param('id') id: string, @User() user: JwtPayload) {
    return this.eventsService.remove(id, user.orgId);
  }
}
```

#### Permissions Dynamiques avec Conditions

```typescript
// Dans CaslAbilityFactory
if (user.role.code === 'MANAGER') {
  // Peut créer des événements dans son org
  can('create', 'Event', { org_id: user.orgId });
  
  // Peut modifier uniquement ses propres événements
  can('update', 'Event', { 
    org_id: user.orgId,
    created_by_id: user.id 
  });
  
  // Peut lire tous les événements de son org
  can('read', 'Event', { org_id: user.orgId });
}

if (user.role.code === 'ADMIN') {
  // Gestion complète de l'organisation
  can('manage', 'Event', { org_id: user.orgId });
  can('manage', 'User', { org_id: user.orgId });
  can('manage', 'Attendee', { org_id: user.orgId });
}

if (user.role.code === 'SUPER_ADMIN') {
  // Accès global (pas de filtre org_id)
  can('manage', 'all');
}
```

### Matrice des Permissions

| Ressource | SUPER_ADMIN | ADMIN | MANAGER | VIEWER | PARTNER | HOSTESS |
|-----------|-------------|-------|---------|--------|---------|---------|
| **Organizations** | ✅ Manage all | ✅ Read/Update own | 🔸 Read own | 🔸 Read own | 🔸 Read own | 🔸 Read own |
| **Users** | ✅ Manage all | ✅ Manage org | 🔸 Read org | 🔸 Read org | ❌ None | ❌ None |
| **Events** | ✅ Manage all | ✅ Manage org | ✅ Manage own/assigned | 🔸 Read org | 🔸 Read assigned | 🔸 Read assigned |
| **Attendees** | ✅ Manage all | ✅ Manage org | ✅ Manage org | 🔸 Read org | 🔸 Read assigned | ❌ None |
| **Registrations** | ✅ Manage all | ✅ Manage org | ✅ Manage org | 🔸 Read org | 🔸 Read assigned | ✅ Check-in only |
| **Badges** | ✅ Manage all | ✅ Manage org | ✅ Generate org | 🔸 Read org | 🔸 Read assigned | ❌ None |
| **Roles** | ✅ Manage all | ✅ Read org | 🔸 Read org | 🔸 Read org | ❌ None | ❌ None |

**Légende** : ✅ Accès complet | 🔸 Accès limité | ❌ Aucun accès

---

## 📊 Modèle de Données

### Schéma Principal (Prisma)

Le schéma complet est dans `prisma/schema.prisma`. Voici les modèles clés :

#### 🏢 Organizations & Multi-Tenancy

```prisma
model Organization {
  id         String   @id @default(uuid())
  name       String
  slug       String   @unique
  plan_id    String?  // Plan souscrit
  created_at DateTime @default(now())
  
  // Relations
  plan       Plan?
  orgUsers   OrgUser[]     // Utilisateurs membres
  events     Event[]
  attendees  Attendee[]
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique  // Email global unique
  password_hash String
  first_name    String?
  last_name     String?
  is_platform   Boolean  @default(false)  // User plateforme
  
  // Relations
  orgUsers       OrgUser[]         // Memberships multi-orgs
  userRoles      UserRole[]        // Rôles par org
  refreshTokens  RefreshToken[]
}

model OrgUser {
  user_id String
  org_id  String
  is_primary Boolean @default(false)
  
  user User         @relation(...)
  org  Organization @relation(...)
  
  @@id([user_id, org_id])
}
```

#### 🎭 RBAC System

```prisma
model Role {
  id          String   @id @default(uuid())
  code        String   // ADMIN, MANAGER, etc.
  name        String
  org_id      String?  // null = rôle système
  rank        Int      // Hiérarchie 0-100
  is_platform Boolean  @default(false)
  is_root     Boolean  @default(false)
  role_type   RoleType
  
  organization    Organization?
  rolePermissions RolePermission[]
  userRoles       UserRole[]
}

model Permission {
  code              String   @id  // users:create, events:read, etc.
  module_key        String
  resource          String
  action            String
  allowed_scopes    String[] // [own, assigned, team, any]
  
  rolePermissions RolePermission[]
}

model RolePermission {
  role_id        String
  permission_code String
  scope          PermissionScope  // own|assigned|team|any
  conditions     Json?            // Conditions dynamiques
  
  @@id([role_id, permission_code])
}
```

#### 🎫 Events & Attendees

```prisma
model Event {
  id          String    @id @default(uuid())
  org_id      String
  name        String
  start_date  DateTime
  end_date    DateTime?
  capacity    Int?
  status      EventStatus
  deleted_at  DateTime?  // Soft delete
  
  organization Organization @relation(...)
  registrations Registration[]
}

model Attendee {
  id        String   @id @default(uuid())
  org_id    String
  email     String
  first_name String
  last_name  String
  phone     String?
  deleted_at DateTime?  // Soft delete
  
  organization Organization @relation(...)
  registrations Registration[]
  
  @@unique([org_id, email])
}

model Registration {
  id          String   @id @default(uuid())
  event_id    String
  attendee_id String
  status      RegistrationStatus
  checked_in  Boolean  @default(false)
  deleted_at  DateTime?
  
  event     Event    @relation(...)
  attendee  Attendee @relation(...)
  badge     Badge?
}
```

#### 🔄 Authentication Tokens

```prisma
model RefreshToken {
  jti          String   @id @default(uuid())
  user_id      String
  user_agent   String?
  ip_address   String?
  expires_at   DateTime
  revoked_at   DateTime?
  replaced_by_id String?  // Token de remplacement (rotation)
  
  user        User @relation(...)
  replacedBy  RefreshToken?
}
```

### Migrations

```bash
# Créer une nouvelle migration
npx prisma migrate dev --name add_feature_name

# Appliquer les migrations (production)
npx prisma migrate deploy

# Regénérer le client Prisma
npx prisma generate

# Ouvrir l'interface graphique Prisma Studio
npx prisma studio  # http://localhost:5555
```

---

## 🌐 API Endpoints

Documentation complète disponible sur **Swagger** : http://localhost:3000/api/docs

### Authentication

```http
POST   /auth/login              # Connexion utilisateur
POST   /auth/refresh            # Renouveler access token
POST   /auth/logout             # Déconnexion
POST   /auth/change-password    # Changer mot de passe
```

### Users Management

```http
GET    /users                   # Liste utilisateurs org (ADMIN+)
GET    /users/me                # Profil utilisateur courant
GET    /users/:id               # Détails utilisateur
POST   /users                   # Créer utilisateur (ADMIN)
PATCH  /users/:id               # Modifier utilisateur
DELETE /users/:id               # Supprimer utilisateur (ADMIN)
```

### Organizations

```http
GET    /organizations/me        # Organisation courante
PATCH  /organizations/:id       # Modifier organisation (ADMIN)
GET    /organizations/:id/stats # Statistiques organisation
```

### Events

```http
GET    /events                  # Liste événements
GET    /events/:id              # Détails événement
POST   /events                  # Créer événement (MANAGER+)
PATCH  /events/:id              # Modifier événement
DELETE /events/:id              # Supprimer événement (ADMIN)
GET    /events/:id/stats        # Statistiques événement
POST   /events/:id/duplicate    # Dupliquer événement
```

### Attendees (Participants)

```http
GET    /attendees               # Liste participants
GET    /attendees/:id           # Détails participant
POST   /attendees               # Créer participant (MANAGER+)
PATCH  /attendees/:id           # Modifier participant
DELETE /attendees/:id           # Supprimer participant (ADMIN)
POST   /attendees/import        # Import CSV participants
```

### Registrations (Inscriptions)

```http
GET    /registrations           # Liste inscriptions
GET    /registrations/:id       # Détails inscription
POST   /registrations           # Créer inscription (MANAGER+)
PATCH  /registrations/:id       # Modifier inscription
DELETE /registrations/:id       # Annuler inscription
POST   /registrations/:id/check-in  # Check-in participant (HOSTESS+)
```

### Badges

```http
GET    /badges/templates        # Liste templates badges
POST   /badges/generate         # Générer badge PDF
GET    /badges/:id/download     # Télécharger badge
```

### Invitations

```http
POST   /invitations             # Envoyer invitation (ADMIN)
GET    /invitations/:token/validate  # Valider token (public)
POST   /invitations/:token/complete  # Compléter inscription (public)
```

### Public API (sans authentification)

```http
GET    /public/events/:publicToken       # Détails événement public
POST   /public/events/:publicToken/register  # Inscription publique
```

### Roles & Permissions

```http
GET    /roles                   # Liste rôles (authentifié)
GET    /roles/:id               # Détails rôle
GET    /permissions             # Liste permissions (ADMIN)
```

---

## 🛠️ Scripts Disponibles

### Développement

```bash
npm run start:dev        # Mode développement avec hot-reload
npm run start:debug      # Mode debug (port 9229)
npm run build            # Build de production
npm run start:prod       # Démarrer version production
```

### Base de Données

```bash
# Prisma
npm run db:generate      # Générer le client Prisma
npm run db:push          # Push schema sans migration
npm run db:migrate       # Créer + appliquer migration
npm run db:seed          # Peupler la base de données

# Docker
npm run docker:up        # Démarrer PostgreSQL + API
npm run docker:down      # Arrêter les services
npm run db:migrate:docker # Migrations dans Docker
```

### Tests

```bash
npm run test             # Tests unitaires (Jest)
npm run test:watch       # Tests en mode watch
npm run test:cov         # Couverture de code
npm run test:e2e         # Tests end-to-end
npm run test:debug       # Tests avec debugger
```

### Qualité du Code

```bash
npm run lint             # ESLint (vérification)
npm run lint:fix         # ESLint (correction auto)
npm run format           # Prettier (formatage)
```

---

## 🧪 Tests

### Tests Unitaires

```bash
npm run test
```

Exemple de test de service :

```typescript
describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a user', async () => {
    const createDto = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    };

    mockPrismaService.user.create.mockResolvedValue({
      id: 'uuid',
      ...createDto,
    });

    const result = await service.create(createDto, 'org-id');
    
    expect(result).toHaveProperty('id');
    expect(result.email).toBe(createDto.email);
  });
});
```

### Tests E2E

```bash
npm run test:e2e
```

Exemple de test end-to-end :

```typescript
describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('/auth/login (POST)', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@acme.com',
          password: 'admin123',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body).toHaveProperty('user');
          accessToken = res.body.access_token;
        });
    });

    it('should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@acme.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });
});
```

---

## 🔒 Variables d'Environnement

### Fichiers de Configuration

- `.env.example` : Template pour développement local
- `.env.docker.example` : Template pour Docker
- `.env.prod.example` : Template pour production (créer votre `.env.prod`)

### Variables Requises

```env
# Application
NODE_ENV=development|production
PORT=3000

# Base de Données
DATABASE_URL=postgresql://user:password@host:5432/database

# JWT Authentication
JWT_ACCESS_SECRET=your-super-secret-access-key-min-64-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-64-chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# Cookies
AUTH_COOKIE_NAME=refresh_token
AUTH_COOKIE_DOMAIN=yourdomain.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=strict

# CORS
API_CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Email (SMTP)
EMAIL_PROVIDER=smtp
EMAIL_ENABLED=true
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=Your Event System

# Cloudflare R2 Storage (pour badges PDF)
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-bucket.r2.dev
```

**⚠️ IMPORTANT** : Ne jamais commiter de vrais secrets dans Git. Utilisez des gestionnaires de secrets en production (AWS Secrets Manager, HashiCorp Vault, etc.).

---

### 📧 Configuration SMTP & Cloudflare R2

Le système nécessite deux services externes :
- **SMTP** : Pour l'envoi d'emails d'invitation et notifications
- **Cloudflare R2** : Pour le stockage des badges PDF générés

**📖 Guide de configuration détaillé** : [docs/CONFIGURATION_SMTP_R2.md](docs/CONFIGURATION_SMTP_R2.md)

Ce guide complet vous explique :
- ✅ Comment configurer **6 fournisseurs SMTP** (Gmail, OVH, SendGrid, Mailgun, AWS SES, Brevo)
- ✅ Configuration **Cloudflare R2** étape par étape
- ✅ Tests de validation pour chaque service
- ✅ Comparatif des fournisseurs et recommandations
- ✅ Dépannage et résolution de problèmes
- ✅ Bonnes pratiques de sécurité

**Démarrage rapide SMTP** (Gmail pour développement) :
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASSWORD=votre-mot-de-passe-application  # Obtenir sur myaccount.google.com/apppasswords
```

**Démarrage rapide R2** :
```env
R2_ACCOUNT_ID=votre-account-id              # Dashboard Cloudflare
R2_ACCESS_KEY_ID=votre-access-key           # Manage R2 API Tokens
R2_SECRET_ACCESS_KEY=votre-secret-key       # Manage R2 API Tokens
R2_BUCKET_NAME=ems-badges-production        # Nom du bucket créé
R2_PUBLIC_URL=https://pub-xxx.r2.dev        # URL publique du bucket
```

---

## � Docker & Déploiement

### Docker Compose Development

Le fichier `docker-compose.dev.yml` configure PostgreSQL + API + auto-migrations :

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - ems_pgdata:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    env_file:
      - .env.docker
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./src:/usr/src/app/src  # Hot reload
```

### Commandes Docker Utiles

```bash
# Démarrer tous les services
npm run docker:up

# Voir les logs de l'API
docker compose -f docker-compose.dev.yml logs -f api

# Voir les logs de PostgreSQL
docker compose -f docker-compose.dev.yml logs -f db

# Arrêter tous les services
npm run docker:down

# Rebuild complet sans cache
docker compose -f docker-compose.dev.yml build --no-cache

# Accéder au shell du container API
docker compose -f docker-compose.dev.yml exec api sh

# Exécuter les migrations manuellement
docker compose -f docker-compose.dev.yml exec api npx prisma migrate deploy

# Accéder à PostgreSQL
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d ems
```

### Déploiement Production

#### Build Production

```bash
# Build l'application
npm run build

# Démarrer en mode production
NODE_ENV=production npm run start:prod
```

#### Checklist Pré-Déploiement

- [ ] ✅ Configurer toutes les variables d'environnement de production
- [ ] ✅ Changer **tous** les secrets (JWT, SMTP, R2, Database)
- [ ] ✅ Configurer CORS avec les domaines de production uniquement
- [ ] ✅ Activer `AUTH_COOKIE_SECURE=true` (HTTPS requis)
- [ ] ✅ Définir `NODE_ENV=production`
- [ ] ✅ Configurer rate limiting approprié
- [ ] ✅ Setup monitoring (Sentry, DataDog, New Relic)
- [ ] ✅ Configurer backup automatique PostgreSQL
- [ ] ✅ Setup logs centralisés (ELK, CloudWatch)
- [ ] ✅ Activer SSL/TLS (Let's Encrypt)
- [ ] ✅ Tester health check : `GET /health`

#### Health Check

L'API expose un endpoint de santé :

```bash
curl http://localhost:3000/health
```

Response :
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" }
  },
  "details": { ... }
}
```

---

## 🤝 Contribution

Nous accueillons les contributions ! Veuillez suivre ces guidelines :

### Standards de Code

- ✅ **TypeScript strict mode** activé
- ✅ **NestJS best practices** respectées
- ✅ **Tests** requis pour toutes les nouvelles fonctionnalités
- ✅ **ESLint + Prettier** avant chaque commit
- ✅ **Commits conventionnels** : `feat:`, `fix:`, `docs:`, `refactor:`, etc.

### Workflow de Contribution

1. **Fork** le repository
2. **Créer une branche** : `git checkout -b feature/amazing-feature`
3. **Développer** votre fonctionnalité avec tests
4. **Tester** : `npm run test` + `npm run lint`
5. **Commit** : `git commit -m 'feat: add amazing feature'`
6. **Push** : `git push origin feature/amazing-feature`
7. **Pull Request** vers `main` avec description détaillée

### Types de Commits

```
feat:     Nouvelle fonctionnalité
fix:      Correction de bug
docs:     Documentation uniquement
style:    Formatage, points-virgules, etc.
refactor: Refactoring du code
perf:     Amélioration des performances
test:     Ajout/modification de tests
chore:    Tâches de maintenance (build, CI, etc.)
```

Exemple :
```bash
git commit -m "feat: add check-in QR code scanning for hostess role"
git commit -m "fix: resolve multi-tenant data leak in events endpoint"
git commit -m "docs: update RBAC permissions matrix"
```

---

## 📄 Licence

**Propriétaire** - Tous droits réservés © 2025

Ce projet est propriétaire. Toute utilisation, copie, modification ou distribution non autorisée est interdite.

---

## 🆘 Support & Contact

### Documentation

- 📖 [Documentation Complète](/docs)
- 🔧 [Guide de Démarrage](docs/QUICK_START.md)
- 🛡️ [Architecture RBAC](docs/ARCHITECTURE_RBAC.md)
- 🧪 [Guide des Tests](docs/TESTING_GUIDE.md)

### Problèmes & Questions

1. Consulter la [documentation](/docs) et le [Swagger](http://localhost:3000/api/docs)
2. Vérifier les [issues GitHub](https://github.com/Rabiegha/attendee-ems-back/issues) existantes
3. Créer une [nouvelle issue](https://github.com/Rabiegha/attendee-ems-back/issues/new) avec :
   - Description claire du problème
   - Steps to reproduce
   - Environnement (OS, Node version, etc.)
   - Logs d'erreur

### Sécurité

Si vous découvrez une vulnérabilité de sécurité, **ne créez PAS d'issue publique**.  
Consultez notre [Politique de Sécurité](SECURITY.md) pour le processus de divulgation responsable.

---

<div align="center">

**Développé avec ❤️ pour la gestion d'événements professionnels**

[⬆ Retour en haut](#-attendee-ems---event-management-system-backend)

</div>
