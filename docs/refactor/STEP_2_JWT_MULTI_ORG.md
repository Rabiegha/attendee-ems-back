# STEP 2 : JWT Multi-org + Switch Context

> **Statut** : 🔨 **À DÉMARRER**  
> **Prérequis** : ✅ STEP 1 (Multi-tenant DB) complété  
> **Durée estimée** : 1-2 jours  
> **Priorité** : 🔴 **CRITIQUE** (fondation pour STEP 3)

## 🎯 Objectif

Permettre aux utilisateurs de **switcher entre leurs organisations** et avoir l'`orgId` actif dans le JWT pour que le core RBAC (STEP 3) puisse fonctionner correctement.

## ❓ Pourquoi maintenant ?

**Avant STEP 2** : Le JWT contient uniquement `userId`, pas d'information sur l'org active  
**Après STEP 2** : Le JWT contient `currentOrgId` + `mode` → le core RBAC saura dans quel contexte évaluer les permissions

**Sans ce STEP** : Impossible de faire du RBAC multi-org (on ne sait pas quelle org est active)

### 💡 Approche JWT Minimal vs JWT Lourd

| Aspect | JWT Lourd (❌ Ancien) | JWT Minimal (✅ Nouveau) |
|--------|----------------------|-------------------------|
| **Taille** | Gros (permissions + orgs) | Minimal (~200 bytes) |
| **Scalabilité** | Limite si 50+ orgs | Illimité |
| **Staleness** | Permissions obsolètes jusqu'au refresh | Toujours à jour (DB) |
| **Sécurité** | Matrice RBAC exposée | Identité seule |
| **Performance** | Parsing lourd | Léger + cache DB |

**Décision** : JWT minimal + `/me/ability` pour charger permissions dynamiquement

---

## 📋 Architecture

### JWT Payload v2 (Minimal)

> **🔑 PRINCIPE** : JWT minimal = "identité + contexte org", pas "toute la matrice RBAC"  
> Les permissions sont chargées dynamiquement via l'endpoint `/me/ability`

#### Avantages du JWT minimal :
- ✅ Taille réduite (pas de limite si user a 50 orgs)
- ✅ Pas de staleness : changements de permissions instantanés
- ✅ Sécurité : pas de matrice RBAC exposée dans le token

#### 3 types de tokens selon le contexte :

**1) Tenant-mode token (org active)**
```typescript
interface JwtPayload {
  sub: string;              // userId
  mode: 'tenant';           // Mode tenant
  currentOrgId: string;     // Org active (requise)
  iat: number;
  exp: number;
}
```

**2) Platform-mode token (support/root)**
```typescript
interface JwtPayload {
  sub: string;              // userId
  mode: 'platform';         // Mode platform
  iat: number;
  exp: number;
}
```

**3) Tenant-no-org token (multi-org sans org active)**
```typescript
interface JwtPayload {
  sub: string;              // userId
  mode: 'tenant';           // Mode tenant
  // pas de currentOrgId → force selection
  iat: number;
  exp: number;
}
```

### Flux de Connexion (Intelligence automatique)

```
1. POST /auth/login { email, password }
   ↓
2. Backend charge :
   - platformRole (existe ?)
   - org memberships (org_users)
   - defaultOrgId (org_users.is_default)
   ↓
3. Décision du type de token :
   
   Cas A — User tenant-only (1 org)
   ├─ membre d'1 org
   ├─ pas de platform role
   └─→ Token tenant-mode avec currentOrgId
   
   Cas B — User tenant-only (multi-org)
   ├─ membre de plusieurs orgs
   ├─ pas de platform role
   │
   ├─ Si defaultOrgId existe
   │  └─→ Token tenant-mode avec defaultOrgId
   │
   └─ Sinon
      └─→ Token tenant-no-org (force selection)
   
   Cas C — User platform (support/root)
   ├─ a un platform role
   └─→ Token platform-mode (sans org)
   
   Cas D — Aucune org
   └─→ Erreur / Onboarding requis
   ↓
4. Client stocke le JWT minimal
   ↓
5. Si tenant-mode → appelle GET /me/ability
   Si tenant-no-org → affiche sélecteur d'org
   Si platform-mode → affiche interface platform
```

### Flux de Switch Org

```
1. POST /auth/switch-org { orgId }
   ↓
2. Backend vérifie accès à l'org :
   
   Si user a platform_user_role :
   ├─ scope='TENANT-ALL' → ✅ accès
   └─ scope='TENANT-ASSIGNED' → check platform_user_org_access
   
   Sinon (tenant normal) :
   └─ check org_users membership
   ↓
3. Génération nouveau JWT tenant-mode
   {
     "sub": "user-123",
     "mode": "tenant",
     "currentOrgId": "org-abc",
     "iat": 123,
     "exp": 456
   }
   ↓
4. Réponse
   {
     "accessToken": "<jwt>",
     "mode": "tenant"
   }
   ↓
5. Client met à jour le token
   ↓
6. Client appelle GET /me/ability
   → récupère permissions pour la nouvelle org
```

---

## 📁 Fichiers à Créer/Modifier

### 1. Interfaces & Types

**`src/auth/interfaces/jwt-payload.interface.ts`** (NOUVEAU)
```typescript
/**
 * JWT Payload minimal
 * Les permissions sont chargées dynamiquement via GET /me/ability
 */
export interface JwtPayload {
  sub: string;                      // userId
  mode: 'tenant' | 'platform';      // Mode utilisateur
  currentOrgId?: string;            // Org active (seulement si mode=tenant)
  iat: number;                      // Issued at
  exp: number;                      // Expiration
}

/**
 * Réponse de GET /me/ability
 */
export interface UserAbility {
  orgId: string | null;
  modules: string[];                // Modules accessibles
  grants: Grant[];                  // Permissions avec scopes
}

export interface Grant {
  key: string;                      // ex: 'event.create'
  scope: 'any' | 'own' | 'assigned'; // Portée de la permission
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

#### Méthode : `getAvailableOrgs(userId: string)` (pour UI only)

> **Note** : Cette méthode est utilisée uniquement pour l'UI (liste des orgs dans le sélecteur).  
> Elle ne charge PAS les permissions (qui sont dans `/me/ability`)

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

> **🔑 Génère un JWT MINIMAL** : pas de permissions, pas de liste d'orgs  
> Le client appellera `/me/ability` pour obtenir les permissions

```typescript
async generateJwtForOrg(
  userId: string,
  orgId: string | null,
): Promise<{ token: string; mode: 'tenant' | 'platform' }> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      platformRole: true,
      orgMemberships: true,
    },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  // Déterminer le mode
  const isPlatformUser = !!user.platformRole;

  // Si platform user ET pas d'org spécifiée → mode platform
  if (isPlatformUser && !orgId) {
    const payload: JwtPayload = {
      sub: user.id,
      mode: 'platform',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 7, // 7 jours
    };
    return {
      token: this.jwtService.sign(payload),
      mode: 'platform',
    };
  }

  // Mode tenant : vérifier accès à l'org
  if (orgId) {
    const hasAccess = await this.verifyOrgAccess(userId, orgId);
    if (!hasAccess) {
      throw new ForbiddenException('Access to this organization denied');
    }
  }

  // Générer token tenant-mode
  const payload: JwtPayload = {
    sub: user.id,
    mode: 'tenant',
    ...(orgId && { currentOrgId: orgId }), // Seulement si org active
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
  };

  return {
    token: this.jwtService.sign(payload),
    mode: 'tenant',
  };
}

/**
 * Vérifie que le user a accès à l'org
 */
private async verifyOrgAccess(userId: string, orgId: string): Promise<boolean> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      orgMemberships: true,
      platformRole: true,
      platformOrgAccess: true,
    },
  });

  if (!user) return false;

  // 1. Membership tenant direct
  if (user.orgMemberships.some((m) => m.org_id === orgId)) {
    return true;
  }

  // 2. Platform user avec scope approprié
  if (user.platformRole) {
    const scope = user.platformRole.scope;
    if (scope === 'TENANT-ALL') return true;
    if (scope === 'TENANT-ASSIGNED') {
      return user.platformOrgAccess.some((a) => a.org_id === orgId);
    }
  }

  return false;
}
```

#### Méthode : `switchOrg(userId: string, orgId: string)`

```typescript
async switchOrg(
  userId: string,
  orgId: string,
): Promise<{ accessToken: string; mode: 'tenant' }> {
  // Vérifier accès
  const hasAccess = await this.verifyOrgAccess(userId, orgId);
  if (!hasAccess) {
    throw new ForbiddenException(
      'You do not have access to this organization',
    );
  }

  // Générer nouveau JWT tenant-mode
  const result = await this.generateJwtForOrg(userId, orgId);
  
  return {
    accessToken: result.token,
    mode: result.mode,
  };
}
```

#### Mise à jour de `login()`

```typescript
async login(email: string, password: string) {
  // Valider credentials
  const user = await this.validateUser(email, password);
  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // Charger contexte utilisateur
  const userWithContext = await this.prisma.user.findUnique({
    where: { id: user.id },
    include: {
      platformRole: true,
      orgMemberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  // DÉCISION : quel type de token ?
  let tokenResult: { token: string; mode: 'tenant' | 'platform' };

  // Cas A : Platform user → mode platform
  if (userWithContext.platformRole) {
    tokenResult = await this.generateJwtForOrg(user.id, null);
  }
  // Cas B : Aucune org → erreur
  else if (userWithContext.orgMemberships.length === 0) {
    throw new BadRequestException('User has no organization. Onboarding required.');
  }
  // Cas C : 1 seule org → tenant-mode direct
  else if (userWithContext.orgMemberships.length === 1) {
    const orgId = userWithContext.orgMemberships[0].org_id;
    tokenResult = await this.generateJwtForOrg(user.id, orgId);
  }
  // Cas D : Multi-org → chercher default ou renvoyer tenant-no-org
  else {
    const defaultMembership = userWithContext.orgMemberships.find(
      (m) => m.is_default,
    );
    const orgId = defaultMembership?.org_id || null;
    tokenResult = await this.generateJwtForOrg(user.id, orgId);
  }

  const refreshToken = await this.generateRefreshToken(user.id);

  return {
    access_token: tokenResult.token,
    refresh_token: refreshToken,
    mode: tokenResult.mode,
    // Si tenant-no-org, le front affichera le sélecteur
    requiresOrgSelection: tokenResult.mode === 'tenant' && !tokenResult.token.includes('currentOrgId'),
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

  /**
   * GET /auth/me/ability
   * Retourne les permissions de l'utilisateur pour l'org active
   * ⚠️ À appeler après login ou switch-org
   */
  @Get('me/ability')
  @UseGuards(JwtAuthGuard)
  async getMyAbility(@CurrentUser() user: JwtPayload) {
    // Mode platform : pas de permissions org-specific
    if (user.mode === 'platform') {
      return {
        orgId: null,
        modules: ['platform'], // Accès aux routes platform
        grants: [
          { key: 'platform.orgs.read', scope: 'any' },
          { key: 'platform.users.read', scope: 'any' },
          // ... permissions platform
        ],
      };
    }

    // Mode tenant sans org → erreur
    if (!user.currentOrgId) {
      throw new BadRequestException(
        'No organization context. Please switch to an organization.',
      );
    }

    // Charger les permissions pour l'org active
    return this.authService.getUserAbility(user.sub, user.currentOrgId);
  }
}
```

#### Méthode : `getUserAbility(userId: string, orgId: string)`

```typescript
/**
 * Retourne les permissions de l'utilisateur pour une org donnée
 * Appelé par GET /me/ability
 */
async getUserAbility(userId: string, orgId: string): Promise<UserAbility> {
  // 1. Trouver le rôle de l'user dans cette org
  const tenantRole = await this.prisma.tenant_user_role.findFirst({
    where: {
      user_id: userId,
      org_id: orgId,
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!tenantRole) {
    throw new NotFoundException('User has no role in this organization');
  }

  // 2. Extraire les permissions avec leurs scopes
  const grants: Grant[] = tenantRole.role.rolePermissions.map((rp) => ({
    key: rp.permission.key,
    scope: rp.scope_limit as 'any' | 'org' | 'own',
  }));

  // 3. Déterminer les modules accessibles
  const modules = await this.getEnabledModules(orgId);

  return {
    orgId,
    modules,
    grants,
  };
}

/**
 * Retourne les modules activés pour une org
 */
private async getEnabledModules(orgId: string): Promise<string[]> {
  const org = await this.prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      subscription: {
        include: {
          plan: {
            include: {
              planModules: {
                include: {
                  module: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!org?.subscription?.plan) {
    return [];
  }

  return org.subscription.plan.planModules.map((pm) => pm.module.key);
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

    // Vérifier le mode et la présence de l'org
    if (user.mode !== 'tenant' || !user.currentOrgId) {
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

### Test 1 : Login avec détection automatique du mode

```typescript
describe('POST /auth/login', () => {
  it('should return tenant-mode JWT for single-org user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' })
      .expect(200);

    const decoded = jwt.decode(response.body.access_token) as JwtPayload;
    expect(decoded.mode).toBe('tenant');
    expect(decoded.currentOrgId).toBeDefined();
    expect(decoded.sub).toBeDefined();
    // Pas de permissions dans le JWT
    expect(decoded).not.toHaveProperty('permissions');
  });

  it('should return platform-mode JWT for support user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'support@platform.com', password: 'password' })
      .expect(200);

    const decoded = jwt.decode(response.body.access_token) as JwtPayload;
    expect(decoded.mode).toBe('platform');
    expect(decoded.currentOrgId).toBeUndefined();
  });

  it('should return tenant-no-org for multi-org user without default', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'multi@example.com', password: 'password' })
      .expect(200);

    expect(response.body.requiresOrgSelection).toBe(true);
    const decoded = jwt.decode(response.body.access_token) as JwtPayload;
    expect(decoded.mode).toBe('tenant');
    expect(decoded.currentOrgId).toBeUndefined();
  });
});
```

### Test 2 : Switch org

```typescript
describe('POST /auth/switch-org', () => {
  it('should return new tenant-mode JWT with updated currentOrgId', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' });

    const switchResponse = await request(app.getHttpServer())
      .post('/auth/switch-org')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .send({ orgId: 'org-2-id' })
      .expect(200);

    const decoded = jwt.decode(switchResponse.body.accessToken) as JwtPayload;
    expect(decoded.mode).toBe('tenant');
    expect(decoded.currentOrgId).toBe('org-2-id');
    expect(switchResponse.body.mode).toBe('tenant');
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

### Test 4 : GET /me/ability (NOUVEAU)

```typescript
describe('GET /auth/me/ability', () => {
  it('should return permissions for current org', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'manager@example.com', password: 'password' });

    const response = await request(app.getHttpServer())
      .get('/auth/me/ability')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .expect(200);

    expect(response.body.orgId).toBe('org-1-id');
    expect(response.body.modules).toContain('events');
    expect(response.body.grants).toEqual(
      expect.arrayContaining([
        { key: 'event.read', scope: 'any' },
        { key: 'event.create', scope: 'own' },
      ]),
    );
  });

  it('should fail if no org context', async () => {
    // User avec tenant-no-org
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'multi@example.com', password: 'password' });

    await request(app.getHttpServer())
      .get('/auth/me/ability')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .expect(400);
  });

  it('should return platform permissions for platform user', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'support@platform.com', password: 'password' });

    const response = await request(app.getHttpServer())
      .get('/auth/me/ability')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .expect(200);

    expect(response.body.orgId).toBeNull();
    expect(response.body.modules).toContain('platform');
  });
});
```

### Test 5 : Platform user avec scope global

```typescript
describe('Platform user with ROOT role', () => {
  it('should switch to any org', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'root@platform.com', password: 'rootpassword' });

    // ROOT peut switcher vers n'importe quelle org
    const switchResponse = await request(app.getHttpServer())
      .post('/auth/switch-org')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .send({ orgId: 'any-org-id' })
      .expect(200);

    const decoded = jwt.decode(switchResponse.body.accessToken) as JwtPayload;
    expect(decoded.mode).toBe('tenant');
    expect(decoded.currentOrgId).toBe('any-org-id');
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

### Après STEP 2 (✅ Nouveau pattern avec JWT minimal)

```typescript
@Controller('events')
@UseGuards(JwtAuthGuard, TenantContextGuard) // Vérifie mode=tenant ET currentOrgId
export class EventsController {
  @Get()
  async findAll(@CurrentUser() user: JwtPayload) {
    // ✅ JWT minimal : juste sub + mode + currentOrgId
    const orgId = user.currentOrgId; 
    return this.eventsService.findAll(orgId);
  }
}
```

> **🔑 Note importante** : Les permissions ne sont PAS dans le JWT.  
> Elles sont vérifiées dynamiquement par le `RequirePermissionGuard` (STEP 3)  
> qui appelle `AuthorizationService.can()` qui lit en DB.

---

## 📊 Checklist d'Exécution

### Phase 1 : Interfaces & Types
- [ ] Créer `jwt-payload.interface.ts` (JWT minimal)
- [ ] Créer `user-ability.interface.ts` (réponse de /me/ability)
- [ ] Créer `switch-org.dto.ts`

### Phase 2 : AuthService (JWT minimal)
- [ ] Ajouter `verifyOrgAccess()` (helper pour vérifier accès)
- [ ] Ajouter `generateJwtForOrg()` (JWT minimal sans permissions)
- [ ] Ajouter `getUserAbility()` (charge permissions depuis DB)
- [ ] Ajouter `getAvailableOrgs()` (pour UI uniquement)
- [ ] Ajouter `switchOrg()`
- [ ] Mettre à jour `login()` avec logique tenant/platform
- [ ] Ajouter `getEnabledModules()` (pour /me/ability)

### Phase 3 : AuthController (Nouveaux endpoints)
- [ ] Endpoint `POST /auth/switch-org`
- [ ] Endpoint `GET /auth/me/orgs`
- [ ] Endpoint `GET /auth/me/ability` (⚠️ CLÉ)

### Phase 4 : Guards & Decorators
- [ ] Mettre à jour `TenantContextGuard` (vérifier mode=tenant)
- [ ] Créer `@TenantRequired` decorator

### Phase 5 : Tests E2E
- [ ] Test login (tenant-mode, platform-mode, tenant-no-org)
- [ ] Test switch-org
- [ ] Test GET /me/orgs
- [ ] Test GET /me/ability (⚠️ Important)
- [ ] Test platform user avec scope global

### Phase 6 : Intégration Frontend (suggestions)
- [ ] Stocker JWT minimal dans localStorage
- [ ] Appeler GET /me/ability après login/switch
- [ ] Implémenter `can(permissionKey)` helper
- [ ] Afficher sélecteur d'org si requiresOrgSelection=true

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
