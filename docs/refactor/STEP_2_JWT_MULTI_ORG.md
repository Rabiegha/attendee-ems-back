# STEP 2 : JWT Multi-org + Switch Context

> **Statut** : 🔨 **À DÉMARRER**  
> **Prérequis** : ✅ STEP 1 (Multi-tenant DB) complété  
> **Durée estimée** : 1-2 jours  
> **Priorité** : 🔴 **CRITIQUE** (fondation pour STEP 3)

## 🎯 Objectif

Permettre aux utilisateurs de **switcher entre leurs organisations** et avoir l'`orgId` actif dans le JWT pour que le core RBAC (STEP 3) puisse fonctionner correctement.

## ❓ Pourquoi maintenant ?

**Avant STEP 2** : Le JWT contient uniquement `userId`, pas d'information sur l'org active  
**Après STEP 2** : Le JWT contient `currentOrgId` → le core RBAC saura dans quel contexte évaluer les permissions

**Sans ce STEP** : Impossible de faire du RBAC multi-org (on ne sait pas quelle org est active)

---

## 📋 Architecture

### JWT Payload v2 (Multi-org)

```typescript
interface JwtPayload {
  // Identité
  sub: string;              // userId
  email: string;
  
  // Contexte org actif
  currentOrgId: string | null;     // Org active (null si platform-only mode)
  currentOrgSlug: string | null;   // Slug pour l'UI
  
  // Organisations accessibles
  availableOrgs: Array<{
    orgId: string;
    orgSlug: string;
    role: string;           // 'ADMIN' | 'MANAGER' | etc.
    isPlatform: boolean;    // false pour tenant, true pour platform access
  }>;
  
  // Permissions pour l'org active
  permissions: string[];    // ['event.create', 'user.read', etc.]
  
  // Rôle principal
  role: string;             // Nom du rôle actif (tenant ou platform)
  roleLevel: number;        // Level du rôle (pour hierarchie)
  
  // Flags
  isPlatform: boolean;      // true si rôle platform (SUPPORT/ROOT)
  isRoot: boolean;          // true si ROOT (accès complet)
  
  // Metadata JWT standard
  iat: number;
  exp: number;
}
```

### Flux de Connexion

```
1. POST /auth/login
   ↓
2. AuthService charge les orgs accessibles
   - Via org_users (tenant)
   - Via platform_user_org_access (platform assigned)
   - OU toutes les orgs si ROOT/SUPPORT avec scope global
   ↓
3. Sélection org par défaut
   - Première org accessible (tri alphabétique)
   - OU dernière org utilisée (si stockée)
   ↓
4. Génération JWT avec currentOrgId
   ↓
5. Client stocke le JWT
```

### Flux de Switch

```
1. POST /auth/switch-org { orgId }
   ↓
2. AuthService vérifie accès
   - Membership tenant (org_users)
   - OU accès platform (platform_user_org_access si assigned)
   - OU ROOT/SUPPORT global
   ↓
3. Génération nouveau JWT
   - Nouveau currentOrgId
   - Nouvelles permissions pour cette org
   - Nouveau role (si multi-rôles)
   ↓
4. Client met à jour le JWT
   ↓
5. Toutes les requêtes suivantes utilisent la nouvelle org
```

---

## 📁 Fichiers à Créer/Modifier

### 1. Interfaces & Types

**`src/auth/interfaces/jwt-payload.interface.ts`** (NOUVEAU)
```typescript
export interface JwtPayload {
  sub: string;
  email: string;
  currentOrgId: string | null;
  currentOrgSlug: string | null;
  availableOrgs: AvailableOrg[];
  permissions: string[];
  role: string;
  roleLevel: number;
  isPlatform: boolean;
  isRoot: boolean;
  iat: number;
  exp: number;
}

export interface AvailableOrg {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: string;
  roleLevel: number;
  isPlatform: boolean;
}
```

**`src/auth/dto/switch-org.dto.ts`** (NOUVEAU)
```typescript
import { IsUUID } from 'class-validator';

export class SwitchOrgDto {
  @IsUUID()
  orgId: string;
}
```

### 2. AuthService - Méthodes à Ajouter

**`src/auth/auth.service.ts`** (MODIFIER)

#### Méthode : `getAvailableOrgs(userId: string)`

```typescript
async getAvailableOrgs(userId: string): Promise<AvailableOrg[]> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      // Orgs tenant
      orgMemberships: {
        include: {
          organization: true,
        },
      },
      // Rôles tenant par org
      tenantRoles: {
        include: {
          role: true,
          organization: true,
        },
      },
      // Rôle platform
      platformRole: {
        include: {
          role: true,
        },
      },
      // Accès platform assigned
      platformOrgAccess: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  const availableOrgs: AvailableOrg[] = [];

  // 1. Orgs tenant (via membership)
  for (const membership of user.orgMemberships) {
    const tenantRole = user.tenantRoles.find(
      (tr) => tr.org_id === membership.org_id,
    );

    if (tenantRole) {
      availableOrgs.push({
        orgId: membership.org_id,
        orgSlug: membership.organization.slug,
        orgName: membership.organization.name,
        role: tenantRole.role.name,
        roleLevel: tenantRole.role.level,
        isPlatform: false,
      });
    }
  }

  // 2. Orgs platform (si rôle platform)
  if (user.platformRole) {
    const platformRole = user.platformRole.role;

    if (platformRole.is_root || platformRole.code === 'SUPPORT') {
      // ROOT ou SUPPORT global → accès à toutes les orgs
      if (user.platformRole.scope === 'global') {
        const allOrgs = await this.prisma.organization.findMany({
          select: { id: true, slug: true, name: true },
        });

        for (const org of allOrgs) {
          // Éviter doublons avec orgs tenant
          if (!availableOrgs.some((o) => o.orgId === org.id)) {
            availableOrgs.push({
              orgId: org.id,
              orgSlug: org.slug,
              orgName: org.name,
              role: platformRole.name,
              roleLevel: platformRole.level,
              isPlatform: true,
            });
          }
        }
      }
      // SUPPORT assigned → accès aux orgs assignées
      else if (user.platformRole.scope === 'assigned') {
        for (const access of user.platformOrgAccess) {
          if (!availableOrgs.some((o) => o.orgId === access.org_id)) {
            availableOrgs.push({
              orgId: access.org_id,
              orgSlug: access.organization.slug,
              orgName: access.organization.name,
              role: platformRole.name,
              roleLevel: platformRole.level,
              isPlatform: true,
            });
          }
        }
      }
    }
  }

  // Tri par nom d'org
  return availableOrgs.sort((a, b) => a.orgName.localeCompare(b.orgName));
}
```

#### Méthode : `generateJwtForOrg(userId: string, orgId: string | null)`

```typescript
async generateJwtForOrg(
  userId: string,
  orgId: string | null,
): Promise<string> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  const availableOrgs = await this.getAvailableOrgs(userId);

  // Déterminer l'org active
  let currentOrg: AvailableOrg | null = null;
  if (orgId) {
    currentOrg = availableOrgs.find((o) => o.orgId === orgId) || null;
    if (!currentOrg) {
      throw new ForbiddenException('Access to this organization denied');
    }
  } else {
    // Pas d'org spécifiée → prendre la première disponible
    currentOrg = availableOrgs[0] || null;
  }

  // Charger les permissions pour l'org active
  let permissions: string[] = [];
  let role: string = '';
  let roleLevel: number = 0;
  let isPlatform: boolean = false;
  let isRoot: boolean = false;

  if (currentOrg) {
    // Charger les permissions du rôle
    const roleData = await this.prisma.role.findFirst({
      where: {
        name: currentOrg.role,
        ...(currentOrg.isPlatform
          ? { org_id: null, is_platform: true }
          : { org_id: currentOrg.orgId }),
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (roleData) {
      permissions = roleData.rolePermissions.map((rp) => rp.permission.key);
      role = roleData.name;
      roleLevel = roleData.level;
      isPlatform = roleData.is_platform;
      isRoot = roleData.is_root || false;
    }
  }

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    currentOrgId: currentOrg?.orgId || null,
    currentOrgSlug: currentOrg?.orgSlug || null,
    availableOrgs,
    permissions,
    role,
    roleLevel,
    isPlatform,
    isRoot,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 7, // 7 jours
  };

  return this.jwtService.sign(payload);
}
```

#### Méthode : `switchOrg(userId: string, orgId: string)`

```typescript
async switchOrg(userId: string, orgId: string): Promise<string> {
  // Vérifier que l'utilisateur a accès à cette org
  const availableOrgs = await this.getAvailableOrgs(userId);
  const targetOrg = availableOrgs.find((o) => o.orgId === orgId);

  if (!targetOrg) {
    throw new ForbiddenException(
      'You do not have access to this organization',
    );
  }

  // Générer un nouveau JWT avec la nouvelle org
  return this.generateJwtForOrg(userId, orgId);
}
```

#### Mise à jour de `login()`

```typescript
async login(email: string, password: string) {
  // ... validation user/password existante ...

  // Générer JWT avec org par défaut
  const accessToken = await this.generateJwtForOrg(user.id, null);
  const refreshToken = await this.generateRefreshToken(user.id);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}
```

### 3. AuthController - Nouveaux Endpoints

**`src/auth/auth.controller.ts`** (MODIFIER)

```typescript
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ... endpoints existants (login, refresh) ...

  @Post('switch-org')
  @UseGuards(JwtAuthGuard)
  async switchOrg(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SwitchOrgDto,
  ) {
    const accessToken = await this.authService.switchOrg(user.sub, dto.orgId);
    return { access_token: accessToken };
  }

  @Get('me/orgs')
  @UseGuards(JwtAuthGuard)
  async getMyOrgs(@CurrentUser() user: JwtPayload) {
    const orgs = await this.authService.getAvailableOrgs(user.sub);
    return {
      current: user.currentOrgId,
      available: orgs,
    };
  }
}
```

### 4. JWT Strategy - Extraction `currentOrgId`

**`src/auth/jwt.strategy.ts`** (MODIFIER)

```typescript
async validate(payload: JwtPayload): Promise<JwtPayload> {
  // Retourner le payload complet (incluant currentOrgId)
  return payload;
}
```

### 5. Guard Tenant Context

**`src/common/guards/tenant-context.guard.ts`** (NOUVEAU)

```typescript
import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Guard qui vérifie que currentOrgId est présent dans le JWT
 * À utiliser sur les routes qui nécessitent un contexte tenant
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // JwtPayload injecté par JwtAuthGuard

    if (!user) {
      throw new BadRequestException('No user in request');
    }

    if (!user.currentOrgId) {
      throw new BadRequestException(
        'No organization context. Please switch to an organization first.',
      );
    }

    return true;
  }
}
```

### 6. Decorator Tenant Required

**`src/common/decorators/tenant-required.decorator.ts`** (NOUVEAU)

```typescript
import { SetMetadata } from '@nestjs/common';

export const TENANT_REQUIRED_KEY = 'tenantRequired';
export const TenantRequired = () => SetMetadata(TENANT_REQUIRED_KEY, true);
```

---

## 🧪 Tests à Écrire

### Test 1 : Login avec org par défaut

```typescript
describe('POST /auth/login', () => {
  it('should return JWT with currentOrgId set to first available org', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' })
      .expect(200);

    const decoded = jwt.decode(response.body.access_token) as JwtPayload;
    expect(decoded.currentOrgId).toBeDefined();
    expect(decoded.availableOrgs).toHaveLength(2); // user has 2 orgs
  });
});
```

### Test 2 : Switch org

```typescript
describe('POST /auth/switch-org', () => {
  it('should return new JWT with updated currentOrgId', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' });

    const switchResponse = await request(app.getHttpServer())
      .post('/auth/switch-org')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .send({ orgId: 'org-2-id' })
      .expect(200);

    const decoded = jwt.decode(switchResponse.body.access_token) as JwtPayload;
    expect(decoded.currentOrgId).toBe('org-2-id');
  });

  it('should reject switch to org without access', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' });

    await request(app.getHttpServer())
      .post('/auth/switch-org')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .send({ orgId: 'org-forbidden-id' })
      .expect(403);
  });
});
```

### Test 3 : GET /me/orgs

```typescript
describe('GET /auth/me/orgs', () => {
  it('should return available orgs for user', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' });

    const response = await request(app.getHttpServer())
      .get('/auth/me/orgs')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .expect(200);

    expect(response.body.current).toBe('org-1-id');
    expect(response.body.available).toHaveLength(2);
  });
});
```

### Test 4 : Platform user with global scope

```typescript
describe('Platform user with ROOT role', () => {
  it('should have access to all orgs', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'root@system.com', password: 'rootpassword' });

    const response = await request(app.getHttpServer())
      .get('/auth/me/orgs')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .expect(200);

    // ROOT a accès à toutes les orgs
    expect(response.body.available.length).toBeGreaterThan(5);
  });
});
```

---

## 🔧 Utilisation dans les Controllers

### Avant STEP 2 (❌ Ne fonctionne plus)

```typescript
@Controller('events')
export class EventsController {
  @Get()
  async findAll(@Req() req) {
    const orgId = req.user.org_id; // ❌ N'existe plus
    return this.eventsService.findAll(orgId);
  }
}
```

### Après STEP 2 (✅ Nouveau pattern)

```typescript
@Controller('events')
@UseGuards(JwtAuthGuard, TenantContextGuard) // Vérifie currentOrgId
export class EventsController {
  @Get()
  async findAll(@CurrentUser() user: JwtPayload) {
    const orgId = user.currentOrgId; // ✅ Depuis le JWT
    return this.eventsService.findAll(orgId);
  }
}
```

---

## 📊 Checklist d'Exécution

- [ ] Créer `jwt-payload.interface.ts`
- [ ] Créer `switch-org.dto.ts`
- [ ] Ajouter méthodes dans `AuthService` :
  - [ ] `getAvailableOrgs()`
  - [ ] `generateJwtForOrg()`
  - [ ] `switchOrg()`
- [ ] Mettre à jour `login()` pour utiliser `generateJwtForOrg()`
- [ ] Ajouter endpoints dans `AuthController` :
  - [ ] `POST /auth/switch-org`
  - [ ] `GET /auth/me/orgs`
- [ ] Créer `TenantContextGuard`
- [ ] Créer `@TenantRequired` decorator
- [ ] Écrire les tests E2E
- [ ] Tester le flow complet (login → switch → requête)
- [ ] Mettre à jour la documentation Postman/Swagger

---

## ➡️ Prochaine Étape

**STEP 3** : Core RBAC Hexagonal  
→ Voir [STEP_3_CORE_RBAC.md](./STEP_3_CORE_RBAC.md)

Le JWT contient maintenant `currentOrgId` → on peut construire le moteur d'autorisation RBAC ! 🎯

---

## 📚 Références

- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [NestJS JWT](https://docs.nestjs.com/security/authentication#jwt-token)
- [Multi-tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/multi-tenancy)
