# Comparaison Architectures : NestJS Classique vs Hybride vs Full DDD

**Date :** 15 décembre 2025  
**Objectif :** Comprendre CONCRÈTEMENT les différences entre les 3 approches

---

## 🎯 Scénario : Assigner un rôle à un utilisateur

Prenons un cas concret : **Un admin veut assigner le rôle "Manager" à un utilisateur**

**Règles métier** :
1. ✅ Seul un admin peut assigner des rôles
2. ✅ Un user ne peut pas assigner un rôle de rank supérieur au sien
3. ✅ Un user ne peut jamais modifier son propre rôle
4. ✅ Le rôle "Admin" (is_locked = true) ne peut pas être supprimé

---

## 🔴 APPROCHE 1 : NestJS Classique (ce que tu as peut-être maintenant)

### Structure

```
src/modules/rbac/
  ├── rbac.service.ts        ← TOUT est ici (logique + DB)
  └── rbac.controller.ts
```

### Code

```typescript
// ❌ PROBLÈME : Logique métier mélangée avec Prisma
@Injectable()
export class RbacService {
  constructor(private prisma: PrismaService) {}

  async assignRole(
    userId: string, 
    roleId: string, 
    orgId: string, 
    assignedBy: User
  ) {
    // 1. Récupérer le rôle de celui qui assigne
    const actorRoles = await this.prisma.userRole.findMany({
      where: { 
        userId: assignedBy.id, 
        orgId 
      },
      include: { role: true }
    });

    if (actorRoles.length === 0) {
      throw new ForbiddenException('No role in this organization');
    }

    // 2. Récupérer le rôle cible
    const targetRole = await this.prisma.role.findUnique({
      where: { id: roleId }
    });

    // 3. ❌ LOGIQUE MÉTIER ÉPARPILLÉE
    // Vérifier rank
    const actorMaxRank = Math.max(...actorRoles.map(ur => ur.role.rank || 0));
    const targetRank = targetRole.rank || 0;
    
    if (actorMaxRank <= targetRank) {
      throw new ForbiddenException(
        'Cannot assign role with equal or higher rank'
      );
    }

    // Vérifier is_root
    if (targetRole.is_root && !actorRoles.some(ur => ur.role.is_root)) {
      throw new ForbiddenException(
        'Only root can assign root roles'
      );
    }

    // Vérifier self-modification
    if (userId === assignedBy.id) {
      throw new ForbiddenException(
        'Cannot modify your own role'
      );
    }

    // 4. Sauvegarder
    return this.prisma.userRole.create({
      data: { userId, roleId, orgId }
    });
  }

  // ❌ AUTRE PROBLÈME : Duplication de logique
  async canModifyRole(userId: string, roleId: string): Promise<boolean> {
    // On doit REDUPLIQUER la logique de vérification de rank
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });

    const targetRole = await this.prisma.role.findUnique({
      where: { id: roleId }
    });

    const userMaxRank = Math.max(...userRoles.map(ur => ur.role.rank || 0));
    const targetRank = targetRole.rank || 0;

    // ❌ Code dupliqué !
    return userMaxRank > targetRank;
  }
}
```

### ❌ Problèmes

1. **Logique métier couplée à Prisma** : Impossible de tester sans mock DB
2. **Duplication** : Logique rank/root répétée partout
3. **Pas de réutilisation** : `canAssignRole()` existe que dans ce service
4. **Tests difficiles** : Faut mocker Prisma à chaque fois
5. **Migration impossible** : Logique éparpillée

---

## 🟡 APPROCHE 2 : Hybride (ce qu'on va faire cette semaine)

### Structure

```
src/
├── modules/rbac/
│   ├── services/
│   │   └── rbac.service.ts           ← Orchestration (Prisma)
│   └── rbac.controller.ts
│
└── domain/rbac/
    └── services/
        └── role-hierarchy.domain-service.ts  ← 🎯 LOGIQUE MÉTIER PURE (DDD)
```

### Code

#### 🎯 **Domain Service (DDD léger)**

```typescript
// ✅ domain/rbac/services/role-hierarchy.domain-service.ts
// LOGIQUE MÉTIER PURE (0 dépendances)

export interface RoleData {
  id: string;
  rank: number;
  isRoot: boolean;
  isLocked: boolean;
}

@Injectable()
export class RoleHierarchyDomainService {
  /**
   * Vérifie si actorRole peut assigner targetRole
   * LOGIQUE PURE : Pas de DB, pas de Prisma
   */
  canAssign(actorRole: RoleData, targetRole: RoleData): boolean {
    // Règle 1 : is_root peut tout faire
    if (actorRole.isRoot) {
      return true;
    }

    // Règle 2 : Seul root peut assigner root
    if (targetRole.isRoot) {
      return false;
    }

    // Règle 3 : Rank supérieur requis
    if (actorRole.rank <= targetRole.rank) {
      return false;
    }

    return true;
  }

  /**
   * Vérifie si actorRole peut modifier targetRole
   */
  canModify(actorRole: RoleData, targetRole: RoleData): boolean {
    // Règle 1 : Rôles locked ne peuvent pas être modifiés
    if (targetRole.isLocked) {
      return false;
    }

    // Règle 2 : Même logique que canAssign
    return this.canAssign(actorRole, targetRole);
  }

  /**
   * Vérifie si user peut modifier son propre rôle
   */
  canModifyOwnRole(userId: string, targetUserId: string): boolean {
    // Règle : Jamais modifier son propre rôle
    return userId !== targetUserId;
  }
}
```

**✅ Avantages du Domain Service** :
- 0 dépendances (pas de Prisma, pas de DB)
- Logique réutilisable partout
- Tests unitaires ULTRA simples (voir plus bas)
- Migration DDD facile plus tard

#### **NestJS Service (orchestration)**

```typescript
// ✅ modules/rbac/services/rbac.service.ts
// ORCHESTRATION : Prisma + Domain Service

@Injectable()
export class RbacService {
  constructor(
    private prisma: PrismaService,
    private roleHierarchyService: RoleHierarchyDomainService, // ← DDD injecté
  ) {}

  async assignRole(
    userId: string,
    roleId: string,
    orgId: string,
    assignedBy: User
  ) {
    // 1. Récupérer données (Prisma direct)
    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: assignedBy.id, orgId },
      include: { role: true }
    });

    const targetRole = await this.prisma.role.findUnique({
      where: { id: roleId }
    });

    // 2. Transformer Prisma → Domain (simple mapping)
    const actorRole = actorRoles[0]?.role;
    const actorRoleData: RoleData = {
      id: actorRole.id,
      rank: actorRole.rank,
      isRoot: actorRole.is_root,
      isLocked: actorRole.is_locked,
    };

    const targetRoleData: RoleData = {
      id: targetRole.id,
      rank: targetRole.rank,
      isRoot: targetRole.is_root,
      isLocked: targetRole.is_locked,
    };

    // 3. ✅ DÉLÉGUER la logique au Domain Service
    if (!this.roleHierarchyService.canAssign(actorRoleData, targetRoleData)) {
      throw new ForbiddenException('Cannot assign this role');
    }

    if (!this.roleHierarchyService.canModifyOwnRole(assignedBy.id, userId)) {
      throw new ForbiddenException('Cannot modify your own role');
    }

    // 4. Sauvegarder (Prisma direct)
    return this.prisma.userRole.create({
      data: { userId, roleId, orgId }
    });
  }

  // ✅ RÉUTILISATION facile
  async canModifyRole(userId: string, roleId: string): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });

    const targetRole = await this.prisma.role.findUnique({
      where: { id: roleId }
    });

    // ✅ Réutilise le même Domain Service (pas de duplication)
    return this.roleHierarchyService.canModify(
      userRoles[0].role,
      targetRole
    );
  }
}
```

### ✅ Avantages Hybride

1. **Logique métier isolée** : `RoleHierarchyDomainService` = pure, testable
2. **Réutilisation** : `canAssign()` utilisable partout
3. **Tests faciles** : Domain Service = 0 mock
4. **Migration DDD future** : Logique déjà isolée
5. **Rapidité** : Pas de boilerplate (Repositories, CQRS, etc.)

### 🧪 Tests (super faciles)

```typescript
// ✅ Test UNITAIRE (0 mock, 0 DB)
describe('RoleHierarchyDomainService', () => {
  let service: RoleHierarchyDomainService;

  beforeEach(() => {
    service = new RoleHierarchyDomainService(); // ← Pas de mock !
  });

  it('should allow higher rank to assign lower rank', () => {
    const admin: RoleData = { id: '1', rank: 100, isRoot: false, isLocked: false };
    const manager: RoleData = { id: '2', rank: 50, isRoot: false, isLocked: false };

    expect(service.canAssign(admin, manager)).toBe(true); // ✅
  });

  it('should deny lower rank to assign higher rank', () => {
    const manager: RoleData = { id: '2', rank: 50, isRoot: false, isLocked: false };
    const admin: RoleData = { id: '1', rank: 100, isRoot: false, isLocked: false };

    expect(service.canAssign(manager, admin)).toBe(false); // ✅
  });

  it('should deny non-root to assign root role', () => {
    const admin: RoleData = { id: '1', rank: 100, isRoot: false, isLocked: false };
    const root: RoleData = { id: 'root', rank: 1000, isRoot: true, isLocked: true };

    expect(service.canAssign(admin, root)).toBe(false); // ✅
  });

  it('should allow root to assign root', () => {
    const root1: RoleData = { id: 'root1', rank: 1000, isRoot: true, isLocked: true };
    const root2: RoleData = { id: 'root2', rank: 1000, isRoot: true, isLocked: true };

    expect(service.canAssign(root1, root2)).toBe(true); // ✅
  });
});
```

**🎉 C'est ÇA le DDD léger : Logique testable sans rien mocker !**

---

## 🟢 APPROCHE 3 : Full DDD (v2, plus tard)

### Structure

```
src/
├── domain/rbac/
│   ├── aggregates/
│   │   ├── role.aggregate.ts              ← 🎯 Entité métier riche
│   │   └── user-authorization.aggregate.ts
│   ├── value-objects/
│   │   ├── scope.vo.ts
│   │   └── role-type.vo.ts
│   └── repositories/
│       └── role.repository.interface.ts   ← Interface seulement
│
├── application/rbac/
│   ├── commands/
│   │   ├── assign-role.command.ts
│   │   └── assign-role.handler.ts         ← Use Case
│   └── queries/
│
├── infrastructure/persistence/
│   └── prisma/
│       ├── repositories/
│       │   └── prisma-role.repository.ts  ← Implémentation
│       └── mappers/
│           └── role.mapper.ts
│
└── interfaces/http/
    └── rbac.controller.ts
```

### Code

#### 🎯 **Role Aggregate (DDD complet)**

```typescript
// ✅ domain/rbac/aggregates/role.aggregate.ts
// ENTITÉ MÉTIER RICHE (logique encapsulée)

export class Role extends AggregateRoot {
  private constructor(
    private readonly id: RoleId,
    private readonly orgId: OrgId | null,
    private rank: number,
    private roleType: RoleType,
    private isLocked: boolean,
    private isRoot: boolean,
    private permissions: RolePermission[],
  ) {
    super();
  }

  /**
   * Factory method (création contrôlée)
   */
  static create(props: CreateRoleProps): Role {
    // Validation dans le constructeur
    if (props.rank < 0) {
      throw new DomainException('Rank must be positive');
    }

    const role = new Role(
      RoleId.create(props.id),
      props.orgId ? OrgId.create(props.orgId) : null,
      props.rank,
      RoleType.create(props.roleType),
      props.isLocked,
      props.isRoot,
      [],
    );

    // Domain Event
    role.addDomainEvent(new RoleCreatedEvent(role.id));

    return role;
  }

  /**
   * ✅ LOGIQUE MÉTIER dans l'Aggregate
   */
  canBeAssignedBy(actor: Role): boolean {
    // is_root bypass
    if (actor.isRoot) {
      return true;
    }

    // Seul root peut assigner root
    if (this.isRoot) {
      return false;
    }

    // Rank hierarchy
    if (actor.rank <= this.rank) {
      return false;
    }

    return true;
  }

  canBeModifiedBy(actor: Role): boolean {
    if (this.isLocked) {
      return false;
    }

    return this.canBeAssignedBy(actor);
  }

  assignPermission(permission: Permission, scope: Scope): void {
    if (this.isLocked) {
      throw new DomainException('Cannot modify locked role');
    }

    // Vérifier que le scope est autorisé
    if (!permission.allowsScope(scope)) {
      throw new DomainException(`Scope ${scope} not allowed for ${permission.key}`);
    }

    this.permissions.push(new RolePermission(permission, scope));
    this.addDomainEvent(new PermissionAssignedEvent(this.id, permission.key));
  }

  // Getters
  getRank(): number {
    return this.rank;
  }

  isLockedRole(): boolean {
    return this.isLocked;
  }

  isRootRole(): boolean {
    return this.isRoot;
  }
}
```

#### **Repository Interface (DDD)**

```typescript
// ✅ domain/rbac/repositories/role.repository.interface.ts
// INTERFACE SEULEMENT (pas d'implémentation)

export interface RoleRepository {
  findById(id: RoleId): Promise<Role | null>;
  findByOrgId(orgId: OrgId): Promise<Role[]>;
  save(role: Role): Promise<void>;
  delete(id: RoleId): Promise<void>;
}
```

#### **Repository Implémentation (Infrastructure)**

```typescript
// ✅ infrastructure/persistence/prisma/repositories/prisma-role.repository.ts
// IMPLÉMENTATION Prisma (séparée du domaine)

@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(
    private prisma: PrismaService,
    private mapper: RoleMapper,
  ) {}

  async findById(id: RoleId): Promise<Role | null> {
    const prismaRole = await this.prisma.role.findUnique({
      where: { id: id.getValue() },
      include: { rolePermissions: true }
    });

    if (!prismaRole) return null;

    return this.mapper.toDomain(prismaRole);
  }

  async save(role: Role): Promise<void> {
    const prismaData = this.mapper.toPersistence(role);

    await this.prisma.role.upsert({
      where: { id: prismaData.id },
      create: prismaData,
      update: prismaData,
    });
  }
}
```

#### **Command Handler (Use Case)**

```typescript
// ✅ application/rbac/commands/assign-role.handler.ts
// USE CASE (orchestration)

@CommandHandler(AssignRoleCommand)
export class AssignRoleHandler implements ICommandHandler<AssignRoleCommand> {
  constructor(
    private roleRepo: RoleRepository, // ← Interface, pas Prisma
    private userAuthRepo: UserAuthorizationRepository,
  ) {}

  async execute(command: AssignRoleCommand): Promise<void> {
    // 1. Récupérer Aggregates
    const actorAuth = await this.userAuthRepo.findById(
      UserId.create(command.assignedById)
    );

    const actorRole = await this.roleRepo.findById(
      RoleId.create(actorAuth.getPrimaryRoleId())
    );

    const targetRole = await this.roleRepo.findById(
      RoleId.create(command.roleId)
    );

    // 2. ✅ LOGIQUE dans l'Aggregate
    if (!targetRole.canBeAssignedBy(actorRole)) {
      throw new ForbiddenException('Cannot assign this role');
    }

    // 3. Modifier Aggregate
    actorAuth.assignRole(targetRole, OrgId.create(command.orgId));

    // 4. Sauvegarder
    await this.userAuthRepo.save(actorAuth);

    // 5. Domain Events sont publiés automatiquement
  }
}
```

### ✅ Avantages Full DDD

1. **Logique 100% dans le domaine** : Role.canBeAssignedBy()
2. **Testabilité maximale** : Tout testable sans DB
3. **Évolutivité** : Facile d'ajouter nouvelles règles
4. **Séparation claire** : Domain / Application / Infrastructure
5. **Domain Events** : Audit, notifications, etc.

### ❌ Inconvénients Full DDD

1. **Temps de dev** : 2-3x plus long que Hybride
2. **Boilerplate** : Repositories, Mappers, Commands, Handlers...
3. **Courbe apprentissage** : Équipe doit comprendre DDD
4. **Over-engineering** : Peut-être trop pour v1

---

## 📊 Tableau Comparatif Final

| Aspect | NestJS Classique | **Hybride** (Semaine 1) | Full DDD (v2) |
|--------|------------------|-------------------------|---------------|
| **Logique métier isolée** | ❌ Non (dans services) | ✅ Oui (Domain Services) | ✅ Oui (Aggregates) |
| **Testabilité** | ⚠️ Moyenne (mock Prisma) | ✅ Bonne (Domain Services purs) | ✅ Excellente |
| **Réutilisation** | ❌ Faible (duplication) | ✅ Bonne | ✅ Excellente |
| **Temps dev** | ✅ 1 semaine | ✅ 1 semaine | ⚠️ 2-3 semaines |
| **Boilerplate** | ✅ Minimal | ✅ Minimal | ❌ Beaucoup |
| **Migration future** | ❌ Difficile | ✅ Facile | N/A |
| **Coupling DB** | ❌ Fort (Prisma partout) | ⚠️ Moyen (isolé Domain Services) | ✅ Faible (Repositories) |
| **Complexity** | ✅ Simple | ✅ Simple | ⚠️ Complexe |

---

## 🎯 Réponse à ta question : "C'est où qu'on déploie le DDD ?"

### Dans l'approche Hybride, le DDD est **seulement ici** :

```
src/domain/rbac/
  ├── services/                        ← 🎯 DDD ICI (20%)
  │   ├── authorization.domain-service.ts
  │   └── role-hierarchy.domain-service.ts
  │
  └── value-objects/                   ← 🎯 DDD ICI aussi
      ├── scope.vo.ts
      ├── role-type.vo.ts
      └── permission-key.vo.ts
```

**C'est TOUT !** Le reste est du NestJS classique :

```
src/modules/rbac/
  ├── services/
  │   └── rbac.service.ts              ← NestJS classique (80%)
  │                                       Utilise Prisma + Domain Services
  └── controllers/
      └── rbac.controller.ts           ← NestJS classique
```

---

## 💡 Résumé en une phrase

**Approche Hybride = NestJS classique (Prisma direct) + Domain Services (logique métier pure)**

**Pas de** :
- ❌ Aggregates
- ❌ Repositories pattern
- ❌ CQRS
- ❌ Mappers

**Juste** :
- ✅ Domain Services (logique pure)
- ✅ Value Objects (validation)
- ✅ NestJS Services (Prisma + orchestration)

---

**C'est plus clair maintenant ? 🤔**
