# Décision : Pas de CASL dans le nouveau système RBAC

## 📌 Contexte

CASL est actuellement utilisé dans `PermissionsGuard` pour faire du gating binaire (peut/ne peut pas). Cependant :

- ❌ **CASL ne gère pas les scopes** : `own`, `team`, `org`, `any` sont ignorés
- ❌ **CASL ne fait pas de gating modules** : Pas de concept de Plans
- ❌ **CASL ne gère pas le multi-org avancé** : Limité à la logique binaire
- ❌ **CASL ne fonctionnait pas parfaitement** : Bugs et limitations dans l'implémentation actuelle

## 🎯 Décision

**Nous NE gardons PAS CASL dans le nouveau système.**

### Raisons

1. **Besoin de scopes réels** : Le nouveau système doit différencier `own` vs `team` vs `org` vs `any`
2. **Besoin de gating modules** : Plans Free/Pro/Enterprise avec activation/désactivation de modules
3. **Besoin de multi-org avancé** : User dans plusieurs orgs avec rôles différents
4. **Code plus simple** : Une seule logique d'autorisation au lieu de deux systèmes en parallèle
5. **CASL défaillant** : L'implémentation actuelle a des bugs, autant repartir sur des bases saines

## 🏗️ Architecture retenue

### Système 100% custom

```typescript
// AuthorizationService (nouveau moteur unique)
@Injectable()
export class AuthorizationService {
  constructor(
    private prisma: PrismaService,
    private modulesService: ModulesService,
    // ❌ PAS de CaslAbilityFactory
  ) {}

  async can(
    user: UserPayload,
    permissionKey: string,
    context: ScopeContext,
  ): Promise<boolean> {
    // 1. Bypass is_root
    if (user.is_root) return true;

    // 2. Vérifier module activé
    const moduleKey = getModuleFromPermission(permissionKey);
    const moduleEnabled = await this.modulesService.isModuleEnabledForTenant(
      context.actorTenantId,
      moduleKey,
    );
    if (!moduleEnabled) {
      throw new ForbiddenException(`Module '${moduleKey}' not enabled`);
    }

    // 3. Vérifier tenant membership
    if (!user.is_platform) {
      const isMember = await this.isTenantMember(user.id, context.actorTenantId);
      if (!isMember) {
        throw new ForbiddenException('Not a member of this organization');
      }
    }

    // 4. Récupérer le meilleur scope
    const bestScope = await this.getBestScopeForPermission(
      user.id,
      permissionKey,
      context.actorTenantId,
    );
    if (!bestScope) {
      throw new ForbiddenException(`Permission '${permissionKey}' not granted`);
    }

    // 5. Vérifier scope coverage
    const covers = this.scopeCovers(bestScope, context);
    if (!covers) {
      throw new ForbiddenException(
        `Insufficient scope for '${permissionKey}' (have: ${bestScope})`,
      );
    }

    return true;
  }
}
```

### Logique de scopes (custom)

```typescript
scopeCovers(scopeLimit: Scope, context: ScopeContext): boolean {
  switch (scopeLimit) {
    case 'any':
      return true; // Accès total

    case 'org':
      return context.resourceTenantId === context.actorTenantId;

    case 'team':
      if (!context.resourceTeamId || !context.actorTeamIds) return false;
      return context.actorTeamIds.includes(context.resourceTeamId);

    case 'assigned':
      // Logique custom selon votre modèle
      return false; // TODO

    case 'own':
      return context.resourceOwnerId === context.actorUserId;

    default:
      return false;
  }
}
```

## ✅ Avantages de cette approche

1. **Simplicité** : Une seule logique d'autorisation, pas de double système
2. **Contrôle total** : Nous maîtrisons 100% du code, pas de magie CASL
3. **Scopes réels** : Gestion complète de `own`, `team`, `org`, `any`
4. **Gating modules** : Intégration native des Plans et modules
5. **Multi-org avancé** : Support complet des users dans plusieurs orgs
6. **Messages clairs** : Erreurs explicites avec contexte précis
7. **Performance** : Pas de couche d'abstraction CASL, queries directes Prisma
8. **Testabilité** : Code simple à tester, pas de mock CASL complexe

## ⚠️ Migration depuis l'ancien système

### Phase de transition

```typescript
// AVANT (PermissionsGuard + CASL)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('events.read:any')  // ← CASL ignore le scope
async findAll() {
  // Checks manuels dans le service
  if (user.role !== 'ADMIN') {
    // Filtrer...
  }
}

// APRÈS (Guards séparés + AuthorizationService)
@UseGuards(
  JwtAuthGuard,
  TenantContextGuard,
  ModuleGatingGuard,
  RequirePermissionGuard,
)
@RequirePermission('event.read', { scope: 'org' })
async findAll() {
  // Plus de checks manuels, tout est géré par les Guards
}
```

### Plan de migration

1. **Phase 1** : Créer AuthorizationService sans CASL
2. **Phase 2** : Migrer module pilote (Events)
3. **Phase 3** : Migrer tous les autres modules
4. **Phase 4** : Supprimer complètement CASL du projet
   - Retirer `CaslAbilityFactory`
   - Retirer `PermissionsGuard` (ancien)
   - Retirer dépendance `@casl/ability`

## 📦 Dépendances à retirer (après migration complète)

```bash
# package.json - À SUPPRIMER après migration
npm uninstall @casl/ability
```

```typescript
// Fichiers à SUPPRIMER après migration
src/rbac/casl-ability.factory.ts  // ❌
src/common/guards/permissions.guard.ts  // ❌ (ancien)
```

## 🎯 Résultat final

Un système RBAC **100% custom** :
- ✅ Scopes réels (`own`, `team`, `org`, `any`)
- ✅ Gating modules (Plans Free/Pro/Enterprise)
- ✅ Multi-org avancé (user dans plusieurs orgs)
- ✅ Guards séparés (1 responsabilité par Guard)
- ✅ Code simple, testable, maintenable
- ✅ Messages d'erreur clairs et explicites
- ❌ Pas de dépendance à CASL
- ❌ Pas de double logique d'autorisation

**C'est la solution la plus propre et la plus professionnelle pour votre cas ! 🚀**
