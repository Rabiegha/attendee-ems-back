# STEP 6 : Module Gating (Plans & Features)

> **Statut** : 📋 **DOCUMENTATION PRÉPARATOIRE**  
> **Prérequis** : ✅ STEP 1-5 complétés  
> **Durée estimée** : 2-3 jours (implémentation future)  
> **Priorité** : 🟡 **MOYEN** (monétisation)

## 🎯 Objectif

Restreindre l'accès aux **modules/features** en fonction du **plan** de l'organisation :
- **Free** : Events + Attendees basiques
- **Pro** : + Badges + Analytics basiques
- **Enterprise** : + Analytics avancées + Custom modules

**Module Gating ≠ RBAC**
- **RBAC** : "L'utilisateur a-t-il la permission ?"
- **Module Gating** : "L'organisation a-t-elle accès au module ?"

### 🔑 Compatibilité JWT Minimal

Le module gating utilise uniquement `user.currentOrgId` depuis le JWT, donc **aucun impact** du JWT minimal. Tout fonctionne tel quel ! ✅

---

## 📐 Architecture

```
src/platform/module-gating/
├── core/
│   ├── module-gating.service.ts    # Vérification d'accès module
│   ├── plan-registry.ts            # Définition des plans
│   └── types.ts                    # Types (Plan, Module, etc.)
├── guards/
│   └── require-module.guard.ts     # Guard NestJS pour modules
├── decorators/
│   └── require-module.decorator.ts # @RequireModule('badges')
└── module-gating.module.ts
```

---

## 🧩 Concepts Clés

### 1. Module

Un module = une feature activable/désactivable :

```typescript
enum AppModule {
  EVENTS = 'events',              // Événements (toujours inclus)
  ATTENDEES = 'attendees',        // Participants (toujours inclus)
  BADGES = 'badges',              // Badges personnalisés
  ANALYTICS = 'analytics',        // Analytics basiques
  ADVANCED_ANALYTICS = 'advanced_analytics', // Analytics avancées
  INTEGRATIONS = 'integrations',  // Intégrations (Zapier, etc.)
  WHITE_LABEL = 'white_label',    // White label (custom branding)
  API_ACCESS = 'api_access',      // Accès API REST
}
```

### 2. Plan

Un plan définit les modules accessibles :

```typescript
interface Plan {
  code: string;           // 'free', 'pro', 'enterprise'
  name: string;           // 'Free Plan'
  modules: AppModule[];   // Modules inclus
  limits: {
    maxEvents?: number;   // Limite d'événements
    maxAttendees?: number; // Limite de participants
    maxUsers?: number;    // Limite d'utilisateurs
  };
}
```

### 3. Module Gating

Vérifier si une org a accès à un module :

```typescript
const canAccessBadges = await moduleGatingService.canAccessModule(
  orgId,
  AppModule.BADGES
);

if (!canAccessBadges) {
  throw new ForbiddenException('Upgrade to Pro to access badges');
}
```

---

## 📝 Implémentation V1 (MVP)

### 1. Types & Enums

**`core/types.ts`**

```typescript
export enum AppModule {
  EVENTS = 'events',
  ATTENDEES = 'attendees',
  BADGES = 'badges',
  ANALYTICS = 'analytics',
  ADVANCED_ANALYTICS = 'advanced_analytics',
  INTEGRATIONS = 'integrations',
  WHITE_LABEL = 'white_label',
  API_ACCESS = 'api_access',
}

export enum PlanCode {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export interface Plan {
  code: PlanCode;
  name: string;
  modules: AppModule[];
  limits: PlanLimits;
}

export interface PlanLimits {
  maxEvents?: number;
  maxAttendees?: number;
  maxUsers?: number;
  maxStorage?: number; // En MB
}
```

### 2. Plan Registry

**`core/plan-registry.ts`**

```typescript
import { Plan, PlanCode, AppModule } from './types';

export const PLANS: Record<PlanCode, Plan> = {
  [PlanCode.FREE]: {
    code: PlanCode.FREE,
    name: 'Free Plan',
    modules: [
      AppModule.EVENTS,
      AppModule.ATTENDEES,
    ],
    limits: {
      maxEvents: 3,
      maxAttendees: 100,
      maxUsers: 2,
      maxStorage: 100, // 100 MB
    },
  },
  [PlanCode.PRO]: {
    code: PlanCode.PRO,
    name: 'Pro Plan',
    modules: [
      AppModule.EVENTS,
      AppModule.ATTENDEES,
      AppModule.BADGES,
      AppModule.ANALYTICS,
    ],
    limits: {
      maxEvents: 50,
      maxAttendees: 5000,
      maxUsers: 10,
      maxStorage: 5000, // 5 GB
    },
  },
  [PlanCode.ENTERPRISE]: {
    code: PlanCode.ENTERPRISE,
    name: 'Enterprise Plan',
    modules: [
      AppModule.EVENTS,
      AppModule.ATTENDEES,
      AppModule.BADGES,
      AppModule.ANALYTICS,
      AppModule.ADVANCED_ANALYTICS,
      AppModule.INTEGRATIONS,
      AppModule.WHITE_LABEL,
      AppModule.API_ACCESS,
    ],
    limits: {
      // Unlimited
    },
  },
};
```

### 3. Module Gating Service

**`core/module-gating.service.ts`**

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PLANS } from './plan-registry';
import { AppModule, PlanCode } from './types';

@Injectable()
export class ModuleGatingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Vérifier si une org a accès à un module
   */
  async canAccessModule(orgId: string, module: AppModule): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan_code: true },
    });

    if (!org) {
      return false;
    }

    const plan = PLANS[org.plan_code as PlanCode];
    if (!plan) {
      // Pas de plan défini → FREE par défaut
      return PLANS.free.modules.includes(module);
    }

    return plan.modules.includes(module);
  }

  /**
   * Vérifier et lancer une exception si pas d'accès
   */
  async assertModuleAccess(orgId: string, module: AppModule): Promise<void> {
    const hasAccess = await this.canAccessModule(orgId, module);
    if (!hasAccess) {
      throw new ForbiddenException(
        `Your plan does not include access to the '${module}' module. Please upgrade.`
      );
    }
  }

  /**
   * Obtenir la liste des modules accessibles pour une org
   */
  async getAccessibleModules(orgId: string): Promise<AppModule[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan_code: true },
    });

    if (!org) {
      return [];
    }

    const plan = PLANS[org.plan_code as PlanCode] || PLANS.free;
    return plan.modules;
  }

  /**
   * Obtenir le plan d'une organisation
   */
  async getOrgPlan(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan_code: true },
    });

    if (!org) {
      return null;
    }

    return PLANS[org.plan_code as PlanCode] || PLANS.free;
  }

  /**
   * Vérifier une limite (ex: maxEvents)
   */
  async checkLimit(
    orgId: string,
    limitKey: keyof PlanLimits,
    currentValue: number
  ): Promise<boolean> {
    const plan = await this.getOrgPlan(orgId);
    if (!plan) {
      return false;
    }

    const limitValue = plan.limits[limitKey];
    if (limitValue === undefined) {
      // Pas de limite définie → unlimited
      return true;
    }

    return currentValue < limitValue;
  }

  /**
   * Vérifier et lancer une exception si limite dépassée
   */
  async assertLimit(
    orgId: string,
    limitKey: keyof PlanLimits,
    currentValue: number
  ): Promise<void> {
    const withinLimit = await this.checkLimit(orgId, limitKey, currentValue);
    if (!withinLimit) {
      const plan = await this.getOrgPlan(orgId);
      const limitValue = plan.limits[limitKey];
      throw new ForbiddenException(
        `You have reached the limit of ${limitValue} ${limitKey}. Please upgrade your plan.`
      );
    }
  }
}
```

### 4. Decorator & Guard

**`decorators/require-module.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';
import { AppModule } from '../core/types';

export const REQUIRE_MODULE_KEY = 'requireModule';

/**
 * Décorateur pour restreindre l'accès à une route en fonction du module
 * 
 * @example
 * @RequireModule(AppModule.BADGES)
 * @Post('badges')
 * async createBadge() { ... }
 */
export const RequireModule = (module: AppModule) =>
  SetMetadata(REQUIRE_MODULE_KEY, module);
```

**`guards/require-module.guard.ts`**

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleGatingService } from '../core/module-gating.service';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { AppModule } from '../core/types';
import { Request } from 'express';

@Injectable()
export class RequireModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private moduleGatingService: ModuleGatingService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.get<AppModule>(
      REQUIRE_MODULE_KEY,
      context.getHandler()
    );

    if (!requiredModule) {
      // Pas de module requis → accès autorisé
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user?.currentOrgId) {
      throw new ForbiddenException('No organization context');
    }

    const hasAccess = await this.moduleGatingService.canAccessModule(
      user.currentOrgId,
      requiredModule
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Your plan does not include access to the '${requiredModule}' module. Please upgrade.`
      );
    }

    return true;
  }
}
```

---

## 🔌 Intégration dans les Controllers

### Exemple : Badge Controller

**`src/badges/badges.controller.ts`**

```typescript
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { RequireModule } from '@/platform/module-gating/decorators/require-module.decorator';
import { RequireModuleGuard } from '@/platform/module-gating/guards/require-module.guard';
import { AppModule } from '@/platform/module-gating/core/types';
import { BadgesService } from './badges.service';
import { TenantContextGuard } from '@/platform/authz/guards/tenant-context.guard';

@Controller('badges')
@UseGuards(TenantContextGuard, RequireModuleGuard) // ← Activer le guard
export class BadgesController {
  constructor(private badgesService: BadgesService) {}

  /**
   * Toutes les routes badges nécessitent le module BADGES
   */
  @RequireModule(AppModule.BADGES) // ← Vérifier accès module
  @Post()
  async createBadge(@Body() dto: CreateBadgeDto) {
    return this.badgesService.create(dto);
  }

  @RequireModule(AppModule.BADGES)
  @Get()
  async listBadges() {
    return this.badgesService.findAll();
  }
}
```

### Exemple : Analytics Controller

```typescript
@Controller('analytics')
@UseGuards(TenantContextGuard, RequireModuleGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  /**
   * Analytics basiques → plan Pro ou Enterprise
   */
  @RequireModule(AppModule.ANALYTICS)
  @Get('events')
  async getEventStats() {
    return this.analyticsService.getEventStats();
  }

  /**
   * Analytics avancées → plan Enterprise uniquement
   */
  @RequireModule(AppModule.ADVANCED_ANALYTICS)
  @Get('cohort-analysis')
  async getCohortAnalysis() {
    return this.analyticsService.getCohortAnalysis();
  }
}
```

---

## 📊 Cas d'Usage

### Cas 1 : Vérification Programmatique

Dans un service, vérifier l'accès avant une opération :

```typescript
@Injectable()
export class BadgesService {
  constructor(
    private prisma: PrismaService,
    private moduleGatingService: ModuleGatingService
  ) {}

  async createBadge(orgId: string, dto: CreateBadgeDto) {
    // Vérifier accès module
    await this.moduleGatingService.assertModuleAccess(orgId, AppModule.BADGES);

    // Vérifier limite (ex: max 100 badges pour plan Pro)
    const currentBadges = await this.prisma.badgeTemplate.count({
      where: { org_id: orgId },
    });
    await this.moduleGatingService.assertLimit(orgId, 'maxBadges', currentBadges);

    // Créer le badge
    return this.prisma.badgeTemplate.create({
      data: { ...dto, org_id: orgId },
    });
  }
}
```

### Cas 2 : Frontend (Récupérer Modules Accessibles)

Le frontend peut récupérer la liste des modules pour afficher/cacher des menus :

```typescript
// Backend: nouveau endpoint
@Get('me/accessible-modules')
async getAccessibleModules(@CurrentUser() user: JwtPayload) {
  return this.moduleGatingService.getAccessibleModules(user.currentOrgId);
}
```

```typescript
// Frontend: masquer le menu "Badges" si pas d'accès
const accessibleModules = await api.get('/me/accessible-modules');

if (!accessibleModules.includes('badges')) {
  // Masquer le menu Badges
}
```

### Cas 3 : Limites Dynamiques

Vérifier dynamiquement les limites lors de la création :

```typescript
@Post('events')
async createEvent(@Body() dto: CreateEventDto, @CurrentUser() user: JwtPayload) {
  const currentEvents = await this.prisma.event.count({
    where: { org_id: user.currentOrgId },
  });

  await this.moduleGatingService.assertLimit(
    user.currentOrgId,
    'maxEvents',
    currentEvents
  );

  return this.eventsService.create(dto);
}
```

---

## 🗄️ Schema Prisma (Ajouts)

Ajouter `plan_code` à la table `organizations` :

```prisma
model Organization {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  plan_code    String   @default("free") // ← NOUVEAU
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  // Relations
  orgUsers     OrgUser[]
  roles        Role[]
  events       Event[]
  // ...

  @@map("organizations")
}
```

**Migration :**
```bash
npx prisma migrate dev --name add_plan_code_to_orgs
```

---

## 🎨 Frontend : Message d'Upgrade

Afficher un message clair quand l'utilisateur essaie d'accéder à une feature bloquée :

```typescript
// Interceptor pour gérer les 403 avec module gating
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 403) {
      const message = error.response?.data?.message;
      if (message?.includes('module')) {
        // Afficher un modal "Upgrade to Pro"
        showUpgradeModal({
          feature: 'Badges',
          currentPlan: 'Free',
          requiredPlan: 'Pro',
        });
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 🔍 Combinaison RBAC + Module Gating

**Module Gating AVANT RBAC** :

```typescript
@Controller('badges')
@UseGuards(
  TenantContextGuard,    // 1. Définir le contexte tenant
  RequireModuleGuard,    // 2. Vérifier accès module (plan)
  RequirePermissionGuard // 3. Vérifier permission RBAC
)
export class BadgesController {
  @RequireModule(AppModule.BADGES)       // ← Module gating
  @RequirePermission('badge.create')     // ← RBAC
  @Post()
  async createBadge(@Body() dto: CreateBadgeDto) {
    return this.badgesService.create(dto);
  }
}
```

**Ordre d'exécution** :
1. `TenantContextGuard` → Définit `user.currentOrgId`
2. `RequireModuleGuard` → Vérifie si l'org a accès au module `badges`
3. `RequirePermissionGuard` → Vérifie si l'utilisateur a la permission `badge.create`

---

## 📈 Evolution V2 (Features Avancées)

### 1. Feature Flags Dynamiques

Au lieu de plans fixes, utiliser des feature flags par org :

```typescript
model OrganizationModule {
  id         String   @id @default(cuid())
  org_id     String
  module_key String   // 'badges', 'analytics', etc.
  enabled    Boolean  @default(true)
  expires_at DateTime? // Pour les trials

  organization Organization @relation(fields: [org_id], references: [id])
  @@unique([org_id, module_key])
}
```

### 2. Trials & Expirations

Activer un module temporairement :

```typescript
await prisma.organizationModule.create({
  data: {
    org_id: 'org-123',
    module_key: 'advanced_analytics',
    enabled: true,
    expires_at: new Date('2025-02-01'), // Trial 1 mois
  },
});
```

### 3. Custom Modules par Org

Permettre d'activer des modules custom pour certaines orgs (ex: intégration spécifique).

---

## ✅ Checklist

- [ ] Ajouter `plan_code` à `organizations`
- [ ] Créer `AppModule` enum
- [ ] Créer `Plan` interface et `PLANS` registry
- [ ] Implémenter `ModuleGatingService`
- [ ] Créer `@RequireModule` decorator
- [ ] Créer `RequireModuleGuard`
- [ ] Tester avec Badge Controller
- [ ] Endpoint `/me/accessible-modules`
- [ ] Frontend: masquer menus selon modules
- [ ] Tests unitaires module gating

---

## ➡️ Prochaine Étape

**Documentation complète** : Voir [INDEX.md](./INDEX.md)

---

## 📚 Références

- [Feature Flags Pattern](https://martinfowler.com/articles/feature-toggles.html)
- [NestJS Guards](https://docs.nestjs.com/guards)
- [SaaS Pricing Models](https://www.profitwell.com/recur/all/saas-pricing-models)
