# 🔧 EMS Backend - Event Management System API

**Version**: 1.0.0-dev  
**Date**: 21 octobre 2025  
**Statut**: 🟢 Production Ready (95%)

---

## 📋 Vue d'ensemble

API REST NestJS pour système de gestion d'événements B2B multi-tenant avec authentification JWT sécurisée, refresh tokens rotatifs, et RBAC granulaire via CASL.

### 🏗️ Stack Technique

- **NestJS** + **TypeScript** (strict mode)
- **PostgreSQL** avec **Prisma ORM**
- **JWT** + **Refresh Tokens** rotatifs
- **CASL** pour RBAC côté serveur
- **class-validator** pour validation DTOs
- **Docker** + **Docker Compose** pour déploiement

---

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+ (LTS recommandé)
- PostgreSQL 14+
- Docker & Docker Compose (recommandé)

### Option 1: Avec Docker (Recommandé)

```bash
# 1. Configurer l'environnement
cp .env.example .env
# Modifier les variables si nécessaire

# 2. Démarrer avec Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# 3. Vérifier les logs
docker-compose -f docker-compose.dev.yml logs -f app
```

✅ API disponible sur **http://localhost:3000**  
✅ Swagger docs sur **http://localhost:3000/api/docs**  
✅ PostgreSQL sur port **5432**

### Option 2: Installation Manuelle

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer la base de données
cp .env.example .env
# Modifier DATABASE_URL

# 3. Exécuter les migrations
npx prisma migrate deploy

# 4. Seed la base de données
npm run seed

# 5. Démarrer le serveur
npm run start:dev
```

### Connexion Test
- **Email**: `john.doe@system.com`
- **Mot de passe**: `admin123`
- **Rôle**: SUPER_ADMIN
- **Organisation**: System

---

## 📚 Documentation

Toute la documentation est disponible dans le dossier `/docs` :

### 🚀 Configuration et Setup
- **[CHROMIUM_SETUP.md](./docs/CHROMIUM_SETUP.md)** - Installation Chromium/Chrome multi-plateforme
- **[SETUP_MACOS.md](./docs/SETUP_MACOS.md)** - Guide setup développeur macOS
- **[SETUP_LINUX.md](./docs/SETUP_LINUX.md)** - Guide setup développeur Linux
- **[DEPLOYMENT_BADGES.md](./docs/DEPLOYMENT_BADGES.md)** - Déploiement système de badges

### 📖 Documentation Technique
- 📊 [Schéma Base de Données](./docs/DATABASE_SCHEMA.md) - Tables et relations Prisma
- 🛡️ [Guide RBAC Backend](./docs/RBAC_GUIDE.md) - Implémentation CASL NestJS

---

## 🏗️ Architecture

### Structure des Modules

```
src/
├── main.ts                     # Point d'entrée
├── app.module.ts               # Module racine
├── modules/                    # Modules métier
│   ├── users/                  # Gestion utilisateurs
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   └── dto/
│   ├── events/                 # Gestion événements
│   ├── attendees/              # Gestion participants
│   ├── invitations/            # Système invitations
│   ├── organizations/          # Multi-tenancy
│   └── roles/                  # Rôles et permissions
├── auth/                       # Authentification
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── strategies/             # JWT, Refresh strategies
│   └── guards/                 # Guards JWT
├── rbac/                       # RBAC CASL
│   ├── casl-ability.factory.ts
│   ├── policies.guard.ts
│   └── decorators/
├── common/                     # Code partagé
│   ├── decorators/             # Decorators personnalisés
│   ├── filters/                # Exception filters
│   ├── interceptors/           # Interceptors
│   └── pipes/                  # Validation pipes
└── infra/                      # Infrastructure
    ├── database/               # Configuration Prisma
    └── mail/                   # Service email
```

---

## 🔐 Système d'Authentification

### Architecture JWT + Refresh Tokens

#### Access Tokens (Courts)
- **Durée**: 15 minutes
- **Stockage**: Mémoire côté client (Redux)
- **Usage**: Authentification API

#### Refresh Tokens (Longs)
- **Durée**: 30 jours
- **Stockage**: Cookie HttpOnly + Base de données
- **Usage**: Renouvellement access tokens
- **Rotation**: Nouveau refresh token à chaque utilisation

### Flow d'Authentification

```
1. Login → Access Token (15min) + Refresh Token (30j en cookie)
2. API Call → Authorization: Bearer {accessToken}
3. Token Expiré → POST /auth/refresh → Nouveaux tokens
4. Refresh Expiré → Logout forcé → Retour login
```

### Endpoints Auth

```bash
POST /auth/login
Body: { email, password }
Response: { accessToken, user: {...} }
+ Set-Cookie: refreshToken (HttpOnly)

POST /auth/refresh
Cookie: refreshToken
Response: { accessToken }
+ Set-Cookie: nouveau refreshToken (HttpOnly)

POST /auth/logout
Header: Authorization: Bearer {token}
Response: { message: "Logged out successfully" }
```

---

## 🛡️ Système RBAC (CASL)

### 6 Rôles Hiérarchiques

| Rôle | Code | Description |
|------|------|-------------|
| 🔴 Super Admin | `SUPER_ADMIN` | Accès global cross-tenant |
| 🟠 Admin | `ADMIN` | Gestion complète organisation |
| 🟡 Manager | `MANAGER` | Gestion événements et participants |
| 🔵 Viewer | `VIEWER` | Lecture seule organisation |
| 🟣 Partner | `PARTNER` | Gestion partenaires/sponsors |
| ⚪ Hostess | `HOSTESS` | Check-in événements uniquement |

### Utilisation dans les Controllers

```typescript
import { CheckPolicies } from '@/rbac/decorators'
import { PoliciesGuard } from '@/rbac/guards'

@Controller('events')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class EventsController {
  
  @Get()
  @CheckPolicies((ability: AppAbility) => ability.can('read', 'Event'))
  findAll(@User() user: JwtPayload) {
    return this.eventsService.findAll(user.orgId)
  }

  @Post()
  @CheckPolicies((ability: AppAbility) => ability.can('create', 'Event'))
  create(@Body() dto: CreateEventDto, @User() user: JwtPayload) {
    return this.eventsService.create(dto, user)
  }
}
```

### Permissions Granulaires

```typescript
// Exemple de définition dans CaslAbilityFactory
if (user.role === 'ADMIN') {
  can('manage', 'Organization', { id: user.orgId })
  can('manage', 'User', { orgId: user.orgId })
  can('manage', 'Event', { orgId: user.orgId })
  can('manage', 'Attendee', { orgId: user.orgId })
}

if (user.role === 'MANAGER') {
  can('read', 'Organization', { id: user.orgId })
  can('create', 'Event', { orgId: user.orgId })
  can('update', 'Event', { orgId: user.orgId, createdById: user.id })
  can('manage', 'Attendee', { orgId: user.orgId })
}
```

---

## 📊 Base de Données (Prisma)

### Schéma Principal

```prisma
model Organization {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  timezone  String   @default("UTC")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  users     User[]
  events    Event[]
  roles     Role[]
}

model User {
  id            String    @id @default(uuid())
  orgId         String
  roleId        String
  email         String
  passwordHash  String
  firstName     String?
  lastName      String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  organization  Organization @relation(fields: [orgId], references: [id])
  role          Role         @relation(fields: [roleId], references: [id])
  refreshTokens RefreshToken[]
  
  @@unique([orgId, email])
  @@index([orgId])
  @@index([roleId])
}

model RefreshToken {
  id          String    @id @default(uuid())
  userId      String
  token       String    @unique
  expiresAt   DateTime
  isRevoked   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([token])
}
```

### Migrations

```bash
# Créer une nouvelle migration
npx prisma migrate dev --name add_feature

# Appliquer les migrations en production
npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate

# Ouvrir Prisma Studio
npx prisma studio
```

---

## 🛠️ Scripts NPM

```bash
# Développement
npm run start:dev        # Dev avec watch mode
npm run start:debug      # Dev avec debugger
npm run build            # Build production
npm run start:prod       # Démarrer en production

# Base de données
npm run prisma:generate  # Générer client Prisma
npm run prisma:migrate   # Créer migration
npm run prisma:deploy    # Appliquer migrations
npm run prisma:studio    # Interface graphique DB
npm run seed             # Seed données de test

# Tests
npm run test             # Tests unitaires
npm run test:watch       # Tests en watch mode
npm run test:cov         # Couverture de tests
npm run test:e2e         # Tests E2E

# Qualité du code
npm run lint             # ESLint
npm run format           # Prettier
```

---

## 🌐 API Endpoints

### Auth
```
POST   /auth/login              # Login
POST   /auth/refresh            # Refresh access token
POST   /auth/logout             # Logout
```

### Users
```
GET    /users                   # Liste utilisateurs (ADMIN)
GET    /users/:id               # Détails utilisateur
POST   /users                   # Créer utilisateur (ADMIN)
PATCH  /users/:id               # Modifier utilisateur
DELETE /users/:id               # Supprimer utilisateur (ADMIN)
```

### Organizations
```
GET    /organizations/me        # Organisation courante
PATCH  /organizations/me        # Modifier organisation (ADMIN)
```

### Events
```
GET    /events                  # Liste événements
GET    /events/:id              # Détails événement
POST   /events                  # Créer événement (MANAGER+)
PATCH  /events/:id              # Modifier événement
DELETE /events/:id              # Supprimer événement (ADMIN)
```

### Attendees
```
GET    /attendees               # Liste participants
GET    /attendees/:id           # Détails participant
POST   /attendees               # Créer participant (MANAGER+)
PATCH  /attendees/:id           # Modifier participant
DELETE /attendees/:id           # Supprimer participant (ADMIN)
```

### Invitations
```
POST   /invitations/send        # Envoyer invitation (ADMIN)
POST   /invitations/complete/:token  # Compléter invitation (public)
```

### Roles & Permissions
```
GET    /roles                   # Liste rôles
GET    /roles/:id               # Détails rôle
GET    /permissions             # Liste permissions
```

---

## 🧪 Tests

### Tests Unitaires

```bash
npm run test
```

```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { UsersService } from './users.service'

describe('UsersService', () => {
  let service: UsersService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile()

    service = module.get<UsersService>(UsersService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
```

### Tests E2E

```bash
npm run test:e2e
```

```typescript
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'

describe('AuthController (e2e)', () => {
  let app

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  it('/auth/login (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'john.doe@system.com', password: 'admin123' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('accessToken')
      })
  })
})
```

---

## 🔒 Sécurité

### Mesures Implémentées

- ✅ **JWT Tokens** avec expiration courte
- ✅ **Refresh Tokens** rotatifs stockés en DB
- ✅ **Cookies HttpOnly** pour refresh tokens
- ✅ **Bcrypt** pour hash des mots de passe (rounds: 10)
- ✅ **CORS** configuré avec whitelist
- ✅ **Helmet** pour headers de sécurité
- ✅ **Rate Limiting** sur endpoints sensibles
- ✅ **Validation DTOs** stricte avec class-validator
- ✅ **SQL Injection** protégé via Prisma
- ✅ **Multi-tenant** isolation stricte par orgId

### Variables d'Environnement Sensibles

```env
# JWT
JWT_SECRET=super-secret-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=another-super-secret
REFRESH_TOKEN_EXPIRES_IN=30d

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ems

# SMTP (pour invitations)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=smtp-password
```

---

## 📦 Docker

### Docker Compose Development

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: ems_dev
      POSTGRES_USER: ems_user
      POSTGRES_PASSWORD: ems_password
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://ems_user:ems_password@postgres:5432/ems_dev
    depends_on:
      - postgres
    volumes:
      - .:/app
      - /app/node_modules
```

### Commandes Docker

```bash
# Démarrer les services
docker-compose -f docker-compose.dev.yml up -d

# Voir les logs
docker-compose -f docker-compose.dev.yml logs -f app

# Arrêter les services
docker-compose -f docker-compose.dev.yml down

# Rebuild sans cache
docker-compose -f docker-compose.dev.yml build --no-cache

# Accéder au shell du container
docker-compose -f docker-compose.dev.yml exec app sh
```

---

## 🚀 Déploiement Production

### Build Production

```bash
npm run build
npm run start:prod
```

### Variables d'Environnement Production

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@prod-host:5432/ems_prod
JWT_SECRET=production-secret-very-long-and-random
REFRESH_TOKEN_SECRET=another-production-secret
CORS_ORIGIN=https://app.example.com
```

### Checklist Déploiement

- [ ] Changer tous les secrets (JWT, DB, SMTP)
- [ ] Configurer CORS avec domaine production
- [ ] Activer HTTPS (Let's Encrypt)
- [ ] Configurer rate limiting
- [ ] Setup monitoring (Sentry, DataDog)
- [ ] Backup automatique base de données
- [ ] Logs centralisés
- [ ] Health checks (`GET /health`)

---

## 🤝 Contribution

### Standards

- **TypeScript strict mode** obligatoire
- **NestJS best practices** respectées
- **Tests** requis pour nouvelles features
- **ESLint + Prettier** avant commit
- **Commits conventionnels** : `feat:`, `fix:`, `docs:`, etc.

### Workflow

1. Fork le projet
2. Créer une branche : `git checkout -b feature/amazing-feature`
3. Commit : `git commit -m 'feat: add amazing feature'`
4. Push : `git push origin feature/amazing-feature`
5. Ouvrir une Pull Request

---

## 📄 License

Propriétaire - Tous droits réservés © 2025

---

## 🆘 Support

Pour tout problème ou question :
1. Consulter la documentation dans `/docs`
2. Vérifier les issues GitHub existantes
3. Créer une nouvelle issue avec label approprié

---

**Dernière mise à jour** : 21 octobre 2025  
**Maintenu par** : Corentin
