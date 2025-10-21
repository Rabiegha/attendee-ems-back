```instructions
---
applyTo: '**/prisma/**'
---

# 📊 EMS DATABASE SCHEMA - INSTRUCTIONS PRISMA

**Version**: 1.0.0-dev  
**Date**: 21 octobre 2025  
**ORM**: Prisma 5.x  
**Database**: PostgreSQL 14+

---

## 🎯 ARCHITECTURE MULTI-TENANT

### Principe d'Isolation
- **Champ `orgId`** : Présent sur toutes les tables métier
- **Contraintes composites** : FK avec `(resourceId, orgId)` pour garantir isolation
- **SUPER_ADMIN exception** : Seul rôle avec accès cross-tenant
- **Indexes** : Index sur `orgId` pour performance des queries scoped

---

## 📋 SCHÉMA COMPLET

Voir `/docs/DATABASE_SCHEMA.md` pour le schéma détaillé avec toutes les tables, relations, indexes et contraintes.

---

## 🔧 CONVENTIONS PRISMA

### Naming Conventions
- **Models** : PascalCase singulier (ex: `User`, `Event`, `Organization`)
- **Fields** : camelCase (ex: `firstName`, `createdAt`, `orgId`)
- **Relations** : camelCase descriptif (ex: `organization`, `registrations`, `createdBy`)
- **Enums** : PascalCase (ex: `UserRole`, `EventStatus`)

### Field Types Standard
- **IDs** : `String @id @default(uuid())`
- **Timestamps** : `DateTime @default(now())` / `@updatedAt`
- **Emails** : `String` (validation en DTO)
- **Booleans** : `Boolean @default(false)`
- **JSON** : `Json` ou `Json?` pour data flexible

### Relations
```prisma
// One-to-Many
model Organization {
  users User[]
}

model User {
  orgId        String
  organization Organization @relation(fields: [orgId], references: [id])
}

// Many-to-Many
model Role {
  permissions RolePermission[]
}

model Permission {
  roles RolePermission[]
}

model RolePermission {
  roleId     String
  permissionCode String
  
  role       Role       @relation(fields: [roleId], references: [id])
  permission Permission @relation(fields: [permissionCode], references: [code])
  
  @@id([roleId, permissionCode])
}
```

---

## 🚀 WORKFLOW MIGRATIONS

### Créer une Migration
```bash
# Development
npx prisma migrate dev --name description_change

# Exemple
npx prisma migrate dev --name add_user_must_change_password
```

### Appliquer Migrations (Production)
```bash
npx prisma migrate deploy
```

### Réinitialiser Database (Dev uniquement)
```bash
npx prisma migrate reset
# ⚠️ ATTENTION : Supprime toutes les données !
```

### Générer Client Prisma
```bash
npx prisma generate
# À exécuter après chaque changement de schema
```

---

## 🌱 SEEDERS

### Structure Seeder
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seeding...')

  // 1. Organizations
  const systemOrg = await prisma.organization.upsert({
    where: { slug: 'system' },
    update: {},
    create: {
      name: 'System',
      slug: 'system',
      timezone: 'UTC',
    },
  })

  // 2. Roles
  const superAdminRole = await prisma.role.upsert({
    where: { orgId_code: { orgId: systemOrg.id, code: 'SUPER_ADMIN' } },
    update: {},
    create: {
      orgId: systemOrg.id,
      code: 'SUPER_ADMIN',
      name: 'Super Administrator',
      description: 'Accès global omniscient',
    },
  })

  // 3. Users
  await prisma.user.upsert({
    where: { orgId_email: { orgId: systemOrg.id, email: 'john.doe@system.com' } },
    update: {},
    create: {
      orgId: systemOrg.id,
      roleId: superAdminRole.id,
      email: 'john.doe@system.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      firstName: 'John',
      lastName: 'Doe',
      isActive: true,
    },
  })

  console.log('✅ Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

### Exécuter Seeder
```bash
npm run seed
# ou
npx prisma db seed
```

---

## 📊 TABLES PRINCIPALES

### 1. Organizations (Multi-tenancy)
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
  attendees Attendee[]
}
```

### 2. Users (Comptes utilisateurs)
```prisma
model User {
  id            String    @id @default(uuid())
  orgId         String
  roleId        String
  email         String
  passwordHash  String
  firstName     String?
  lastName      String?
  phone         String?
  isActive      Boolean   @default(true)
  mustChangePassword Boolean @default(false)
  resetToken         String?   @unique
  resetTokenExpiresAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  organization  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  role          Role         @relation(fields: [roleId], references: [id])
  refreshTokens RefreshToken[]
  createdEvents Event[]      @relation("EventCreatedBy")
  
  @@unique([orgId, email])
  @@unique([id, orgId]) // Pour FKs composites
  @@index([orgId])
  @@index([roleId])
}
```

### 3. RefreshTokens (Auth)
```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  token     String    @unique
  expiresAt DateTime
  isRevoked Boolean   @default(false)
  createdAt DateTime  @default(now())
  
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([token])
}
```

### 4. Roles (RBAC)
```prisma
model Role {
  id          String   @id @default(uuid())
  orgId       String
  code        String   // 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER', 'PARTNER', 'HOSTESS'
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  users        User[]
  permissions  RolePermission[]
  
  @@unique([orgId, code])
  @@unique([id, orgId])
  @@index([orgId])
}
```

### 5. Events
```prisma
model Event {
  id          String    @id @default(uuid())
  orgId       String
  code        String
  name        String
  description String?
  startAt     DateTime
  endAt       DateTime
  timezone    String    @default("UTC")
  status      String    // 'draft', 'published', 'active', 'completed', 'cancelled'
  capacity    Int?
  createdById String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  organization  Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  createdBy     User?         @relation("EventCreatedBy", fields: [createdById], references: [id])
  registrations Registration[]
  subevents     Subevent[]
  
  @@unique([orgId, code])
  @@unique([id, orgId])
  @@index([orgId])
  @@index([orgId, status])
  @@index([orgId, startAt])
}
```

### 6. Attendees (CRM Global)
```prisma
model Attendee {
  id          String    @id @default(uuid())
  orgId       String
  firstName   String?
  lastName    String?
  email       String?
  phone       String?
  company     String?
  jobTitle    String?
  labels      String[]
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  organization  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  registrations Registration[]
  
  @@unique([orgId, email])
  @@unique([id, orgId])
  @@index([orgId])
}
```

### 7. Registrations (Inscriptions)
```prisma
model Registration {
  id             String    @id @default(uuid())
  orgId          String
  eventId        String
  attendeeId     String
  status         String    // 'awaiting', 'approved', 'refused', 'cancelled'
  attendanceType String?   // 'online', 'onsite', 'hybrid'
  answers        Json?
  confirmedAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  event        Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  attendee     Attendee     @relation(fields: [attendeeId], references: [id], onDelete: Cascade)
  badge        Badge?
  
  @@unique([eventId, attendeeId])
  @@unique([id, eventId, orgId])
  @@index([orgId, eventId, status])
  @@index([orgId, attendeeId])
}
```

---

## 🔍 INDEXES CRITIQUES

### Performance Multi-Tenant
```prisma
// Toujours indexer orgId sur tables métier
@@index([orgId])

// Queries fréquentes
@@index([orgId, status])
@@index([orgId, createdAt])
@@index([orgId, startAt])

// Recherches
@@index([orgId, email])
@@index([orgId, name])
```

### Foreign Keys Composites
```prisma
// Pour garantir isolation multi-tenant
@@unique([id, orgId])

// Utilisé dans les FK composites
model Event {
  @@unique([id, orgId])
}

model Registration {
  eventId String
  orgId   String
  
  event Event @relation(fields: [eventId, orgId], references: [id, orgId])
}
```

---

## 🛠️ PRISMA STUDIO

```bash
# Ouvrir interface graphique
npx prisma studio

# Accessible sur http://localhost:5555
```

---

## 🚨 RÈGLES CRITIQUES

### ⚠️ Avant Chaque Migration

1. ✅ **Backup database** (production)
2. ✅ **Tester en local** avec données similaires
3. ✅ **Vérifier indexes** sur grandes tables
4. ✅ **Documenter** la migration dans `/docs`

### ⚠️ Constraints Multi-Tenant

```prisma
// ❌ INTERDIT : FK simple
model Registration {
  eventId String
  event   Event @relation(fields: [eventId], references: [id])
}

// ✅ CORRECT : FK composite avec orgId
model Registration {
  eventId String
  orgId   String
  event   Event @relation(fields: [eventId, orgId], references: [id, orgId])
}
```

### ⚠️ Soft Delete vs Hard Delete

```prisma
// Soft Delete (préféré pour audit)
model User {
  deletedAt DateTime?
}

// Hard Delete (onDelete: Cascade)
model RefreshToken {
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 📚 RESSOURCES

- **Prisma Docs** : https://www.prisma.io/docs
- **Schema détaillé** : `/docs/DATABASE_SCHEMA.md`
- **Seeders** : `prisma/seed.ts`
- **Migrations** : `prisma/migrations/`

---

**Dernière mise à jour** : 21 octobre 2025  
**Maintenu par** : Corentin
```
