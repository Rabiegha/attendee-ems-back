````instructions
---
applyTo: '**'
---

# 🔧 EMS BACKEND - INSTRUCTIONS DÉVELOPPEMENT

**Version**: 1.0.0-dev  
**Date**: 21 octobre 2025  
**Stack**: NestJS + PostgreSQL + Prisma + JWT + CASL RBAC

---

## 📋 RÈGLES DE GESTION DES INSTRUCTIONS

### ⚠️ RÈGLE ABSOLUE : STRUCTURE ET ORGANISATION

**AVANT TOUTE CRÉATION DE DOCUMENTATION :**
1. ✅ **Vérifier si documentation existante** dans `.github/instructions/` ou `/docs`
2. ✅ **Mettre à jour** le fichier existant si possible
3. ✅ **Créer nouveau fichier** SEULEMENT si thème totalement nouveau
4. ✅ **Placer dans bon répertoire** :
   - `.github/instructions/` : Instructions pour IA et développeurs
   - `/docs` : Documentation technique détaillée

**INTERDICTIONS STRICTES :**
- ❌ **PAS de documentation à la racine** du projet
- ❌ **PAS de fichiers temporaires** non nettoyés
- ❌ **PAS de duplication** d'informations existantes
- ❌ **PAS de noms vagues** : toujours explicite et structuré

**CONVENTION DE NOMMAGE :**
- Instructions IA : `copilot-instructions.md`, `db-schema.md`
- Documentation : `NOM_FEATURE.md` (ex: `AUTH_REFRESH_TOKENS.md`)
- Guides : `GUIDE_SUJET.md` (ex: `GUIDE_DEPLOYMENT.md`)

---

## 🎯 QUALITÉ PRODUCTION REQUISE

### Standards Obligatoires
- **TypeScript strict mode** : Pas de `any`, validation complète
- **NestJS best practices** : Modules, DI, Guards, Interceptors
- **Validation DTOs** : class-validator sur tous les endpoints
- **Tests exhaustifs** : Unit + E2E avec bonne couverture
- **Error handling** : Exceptions personnalisées avec codes HTTP appropriés
- **Logging** : Winston/Pino avec contexte structuré
- **Sécurité** : CORS, Helmet, Rate limiting, validation inputs
- **Performance** : Indexes DB, pagination, caching stratégique

---

## 🏗️ ARCHITECTURE BACKEND

### Structure des Modules

```
src/
├── main.ts                     # Bootstrap application
├── app.module.ts               # Module racine
├── modules/                    # Modules métier
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   ├── update-user.dto.ts
│   │   │   └── user-response.dto.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   ├── events/
│   ├── attendees/
│   ├── registrations/
│   ├── invitations/
│   └── organizations/
├── auth/                       # Authentification
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── jwt-refresh.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── jwt-refresh-auth.guard.ts
│   └── dto/
├── rbac/                       # CASL RBAC
│   ├── casl-ability.factory.ts
│   ├── policies.guard.ts
│   ├── decorators/
│   │   ├── check-policies.decorator.ts
│   │   └── current-user.decorator.ts
│   └── interfaces/
├── common/                     # Code partagé
│   ├── decorators/
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── transform.interceptor.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   └── utils/
└── infra/                      # Infrastructure
    ├── database/
    │   └── prisma.service.ts
    ├── mail/
    │   └── mail.service.ts
    └── config/
        └── configuration.ts
```

### Conventions de Code

#### Naming
- **Controllers** : `users.controller.ts`
- **Services** : `users.service.ts`
- **DTOs** : `create-user.dto.ts`, `update-user.dto.ts`
- **Entities** : `user.entity.ts` (si Prisma, juste les types générés)
- **Guards** : `jwt-auth.guard.ts`
- **Interceptors** : `logging.interceptor.ts`

#### Imports
```typescript
// 1. Node modules
import { Injectable, HttpException } from '@nestjs/common'

// 2. External libraries
import { ConfigService } from '@nestjs/config'

// 3. Internal absolute imports
import { PrismaService } from '@/infra/database/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'

// 4. Internal relative imports
import { UsersService } from './users.service'
```

---

## 🔐 SYSTÈME D'AUTHENTIFICATION

### Architecture JWT + Refresh Tokens

#### Tokens Gérés
- **Access Token** : JWT court (15 minutes), stocké en mémoire côté client
- **Refresh Token** : JWT long (30 jours), stocké dans cookie HttpOnly + DB

#### Flow Authentification

```typescript
// 1. Login
POST /auth/login
Body: { email, password }
Response: {
  accessToken: "eyJ...",
  user: { id, email, firstName, lastName, role, orgId }
}
Set-Cookie: refreshToken=xxx; HttpOnly; Secure; SameSite=Strict

// 2. Refresh Access Token
POST /auth/refresh
Cookie: refreshToken=xxx
Response: {
  accessToken: "eyJ..."
}
Set-Cookie: nouveau refreshToken; HttpOnly; Secure; SameSite=Strict

// 3. Logout
POST /auth/logout
Header: Authorization: Bearer xxx
Cookie: refreshToken=xxx
→ Révoque refresh token en DB + Clear cookie
```

### Sécurité Refresh Tokens

#### Table Database
```prisma
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

#### Fonctionnalités
- ✅ **Rotation automatique** : Nouveau refresh token à chaque utilisation
- ✅ **Détection réutilisation** : Révocation de toute la famille si token réutilisé
- ✅ **Cleanup automatique** : Cron job pour supprimer tokens expirés
- ✅ **Multi-device** : Un refresh token par device/session
- ✅ **Révocation manuelle** : Logout = révocation immédiate

### Guards Disponibles

```typescript
// JWT Guard (Access Token)
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: JwtPayload) {
  return user
}

// Refresh Guard (Refresh Token)
@UseGuards(JwtRefreshAuthGuard)
@Post('refresh')
refresh(@CurrentUser() user: JwtPayload) {
  return this.authService.refreshTokens(user)
}

// RBAC Guard (Permissions CASL)
@UseGuards(JwtAuthGuard, PoliciesGuard)
@CheckPolicies((ability: AppAbility) => ability.can('create', 'Event'))
@Post('events')
createEvent(@Body() dto: CreateEventDto) {
  return this.eventsService.create(dto)
}
```

---

## 🛡️ SYSTÈME RBAC (CASL)

### 6 Rôles Strictement Définis

| Code | Nom | Description |
|------|-----|-------------|
| `SUPER_ADMIN` | Super Admin | Accès global cross-tenant |
| `ADMIN` | Admin | Gestion complète organisation |
| `MANAGER` | Manager | Gestion événements et participants |
| `VIEWER` | Viewer | Lecture seule organisation |
| `PARTNER` | Partner | Événements assignés uniquement |
| `HOSTESS` | Hostess | Check-in événements assignés |

### Permissions Granulaires

**Actions** : `manage`, `create`, `read`, `update`, `delete`, `invite`, `check_in`, `scan`, `export`, `approve`, `refuse`

**Sujets** : `Organization`, `Event`, `User`, `Attendee`, `Registration`, `Badge`, `Invitation`, `Role`, `Report`, `all`

### Implémentation CASL

#### Factory
```typescript
// rbac/casl-ability.factory.ts
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: JwtPayload): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility
    )

    // SUPER_ADMIN : accès total
    if (user.role === 'SUPER_ADMIN') {
      can('manage', 'all')
      return build()
    }

    // ADMIN : gestion organisation
    if (user.role === 'ADMIN') {
      can('manage', 'Organization', { id: user.orgId })
      can('manage', 'User', { orgId: user.orgId })
      can('manage', 'Event', { orgId: user.orgId })
      can('manage', 'Attendee', { orgId: user.orgId })
      can('invite', 'User', { orgId: user.orgId })
    }

    // MANAGER : gestion événements
    if (user.role === 'MANAGER') {
      can('read', 'Organization', { id: user.orgId })
      can('create', 'Event', { orgId: user.orgId })
      can('update', 'Event', { orgId: user.orgId, createdById: user.id })
      can('manage', 'Attendee', { orgId: user.orgId })
      can('manage', 'Registration', { orgId: user.orgId })
    }

    // VIEWER : lecture seule
    if (user.role === 'VIEWER') {
      can('read', 'Organization', { id: user.orgId })
      can('read', 'Event', { orgId: user.orgId })
      can('read', 'Attendee', { orgId: user.orgId })
      can('export', 'Report', { orgId: user.orgId })
    }

    // PARTNER : événements assignés
    if (user.role === 'PARTNER' && user.eventIds?.length) {
      can('read', 'Event', { id: { $in: user.eventIds } })
      can('read', 'Attendee', { eventId: { $in: user.eventIds } })
      can('scan', 'Badge', { eventId: { $in: user.eventIds } })
    }

    // HOSTESS : check-in uniquement
    if (user.role === 'HOSTESS' && user.eventIds?.length) {
      can('read', 'Event', { id: { $in: user.eventIds } })
      can('check_in', 'Attendee', { eventId: { $in: user.eventIds } })
      can('scan', 'Badge', { eventId: { $in: user.eventIds } })
    }

    return build()
  }
}
```

#### Usage dans Controllers

```typescript
import { CheckPolicies } from '@/rbac/decorators'
import { PoliciesGuard } from '@/rbac/guards'
import { AppAbility } from '@/rbac/interfaces'

@Controller('events')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class EventsController {
  
  @Get()
  @CheckPolicies((ability: AppAbility) => ability.can('read', 'Event'))
  findAll(@CurrentUser() user: JwtPayload) {
    return this.eventsService.findAll(user.orgId)
  }

  @Post()
  @CheckPolicies((ability: AppAbility) => ability.can('create', 'Event'))
  create(@Body() dto: CreateEventDto, @CurrentUser() user: JwtPayload) {
    return this.eventsService.create(dto, user)
  }

  @Patch(':id')
  @CheckPolicies((ability: AppAbility) => ability.can('update', 'Event'))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: JwtPayload
  ) {
    const event = await this.eventsService.findOne(id)
    
    // Vérification contextuelle
    const ability = this.caslFactory.createForUser(user)
    if (!ability.can('update', event)) {
      throw new ForbiddenException()
    }

    return this.eventsService.update(id, dto)
  }
}
```

---

## 📊 BASE DE DONNÉES (PRISMA)

### Schéma Principal

Le schéma complet est documenté dans `/docs/DATABASE_SCHEMA.md`

#### Tables Critiques

**Organizations** : Multi-tenancy racine
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
```

**Users** : Utilisateurs avec isolation multi-tenant
```prisma
model User {
  id            String    @id @default(uuid())
  orgId         String
  roleId        String
  email         String
  passwordHash  String
  firstName     String?
  lastName      String?
  isActive      Boolean   @default(true)
  mustChangePassword Boolean @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  organization  Organization @relation(fields: [orgId], references: [id])
  role          Role         @relation(fields: [roleId], references: [id])
  refreshTokens RefreshToken[]
  
  @@unique([orgId, email])
  @@index([orgId])
}
```

**Events** : Événements avec isolation multi-tenant
```prisma
model Event {
  id          String    @id @default(uuid())
  orgId       String
  code        String
  name        String
  description String?
  startAt     DateTime
  endAt       DateTime
  status      String
  capacity    Int?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  organization  Organization @relation(fields: [orgId], references: [id])
  registrations Registration[]
  
  @@unique([orgId, code])
  @@index([orgId])
}
```

### Migrations Prisma

```bash
# Créer nouvelle migration
npx prisma migrate dev --name add_feature_name

# Appliquer migrations en production
npx prisma migrate deploy

# Générer client Prisma
npx prisma generate

# Reset database (dev uniquement)
npx prisma migrate reset

# Ouvrir Prisma Studio
npx prisma studio
```

### Seeders

```typescript
// prisma/seed.ts
async function main() {
  // 1. Créer organisation système
  const systemOrg = await prisma.organization.create({
    data: { name: 'System', slug: 'system', timezone: 'UTC' }
  })

  // 2. Créer rôles
  const superAdminRole = await prisma.role.create({
    data: {
      orgId: systemOrg.id,
      code: 'SUPER_ADMIN',
      name: 'Super Administrator'
    }
  })

  // 3. Créer super admin
  await prisma.user.create({
    data: {
      orgId: systemOrg.id,
      roleId: superAdminRole.id,
      email: 'john.doe@system.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      firstName: 'John',
      lastName: 'Doe'
    }
  })
}
```

---

## 🌐 API ENDPOINTS

### Conventions REST

- **GET** : Lecture de ressources
- **POST** : Création de ressources
- **PATCH** : Modification partielle
- **DELETE** : Suppression de ressources

### Endpoints Principaux

#### Auth
```
POST   /auth/login              # Login
POST   /auth/refresh            # Refresh access token
POST   /auth/logout             # Logout
GET    /auth/me                 # Profil utilisateur courant
```

#### Users
```
GET    /users                   # Liste (ADMIN)
GET    /users/:id               # Détails
POST   /users                   # Créer (ADMIN)
PATCH  /users/:id               # Modifier
DELETE /users/:id               # Supprimer (ADMIN)
POST   /users/:id/reset-password # Reset password
```

#### Organizations
```
GET    /organizations/me        # Organisation courante
PATCH  /organizations/me        # Modifier (ADMIN)
GET    /organizations/me/stats  # Statistiques
```

#### Events
```
GET    /events                  # Liste
GET    /events/:id              # Détails
POST   /events                  # Créer (MANAGER+)
PATCH  /events/:id              # Modifier
DELETE /events/:id              # Supprimer (ADMIN)
GET    /events/:id/stats        # Statistiques événement
```

#### Registrations (Attendees)
```
GET    /events/:eventId/registrations        # Liste inscriptions
GET    /registrations/:id                    # Détails inscription
POST   /events/:eventId/registrations        # Créer inscription
PATCH  /registrations/:id                    # Modifier
PATCH  /registrations/:id/status             # Changer statut
DELETE /registrations/:id                    # Supprimer
POST   /registrations/:id/check-in           # Check-in
POST   /registrations/:id/check-out          # Check-out
```

#### Invitations
```
POST   /invitations/send                     # Envoyer invitation (ADMIN)
POST   /invitations/complete/:token          # Compléter invitation
GET    /invitations                          # Liste invitations (ADMIN)
```

---

## 🧪 TESTS

### Tests Unitaires (Jest)

```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { UsersService } from './users.service'
import { PrismaService } from '@/infra/database/prisma.service'

describe('UsersService', () => {
  let service: UsersService
  let prisma: PrismaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should find all users', async () => {
    const mockUsers = [{ id: '1', email: 'test@test.com' }]
    jest.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers as any)

    const result = await service.findAll('org-id')
    expect(result).toEqual(mockUsers)
  })
})
```

### Tests E2E

```typescript
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { INestApplication } from '@nestjs/common'

describe('AuthController (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('/auth/login (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'john.doe@system.com', password: 'admin123' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('accessToken')
        expect(res.body).toHaveProperty('user')
      })
  })
})
```

---

## 🔒 SÉCURITÉ

### Checklist Production

- ✅ **Variables d'environnement** : Secrets en production
- ✅ **CORS** : Whitelist domaines autorisés
- ✅ **Helmet** : Headers de sécurité
- ✅ **Rate Limiting** : Protection DDoS
- ✅ **Validation** : DTOs strictes avec class-validator
- ✅ **Passwords** : Bcrypt avec rounds >= 10
- ✅ **JWT Secrets** : Complexes et rotatifs
- ✅ **SQL Injection** : Prisma protège automatiquement
- ✅ **XSS** : Sanitisation inputs
- ✅ **CSRF** : Tokens pour mutations

### Configuration Production

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(','),
    credentials: true,
  })

  // Helmet
  app.use(helmet())

  // Rate Limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests par IP
  }))

  // Validation globale
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }))

  await app.listen(3000)
}
```

---

## 📦 DÉPLOIEMENT

### Variables d'Environnement

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/ems_prod

# JWT
JWT_SECRET=production-secret-very-long-and-random
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=another-production-secret
REFRESH_TOKEN_EXPIRES_IN=30d

# CORS
CORS_ORIGIN=https://app.example.com,https://admin.example.com

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=smtp-password

# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx

NODE_ENV=production
PORT=3000
```

### Docker Production

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

---

## 📝 DOCUMENTATION OBLIGATOIRE

### Nouveaux Endpoints
- JSDoc sur les controllers avec exemples
- DTOs documentés (validation + exemples)
- Swagger decorators complets

### Nouveaux Services
- JSDoc sur les méthodes principales
- Tests unitaires avec bonne couverture
- Commentaires sur logique complexe

### Nouvelles Features
- Mettre à jour `/docs` si architecture impactée
- Ajouter exemples dans README si nouveau workflow
- Tests E2E pour flows critiques

---

**Dernière mise à jour** : 21 octobre 2025  
**Maintenu par** : Corentin
````
