# Note : Approche choisie pour les Permissions Guards

**Date :** Décembre 2024  
**Décision :** Utiliser `@Permissions()` existant + améliorer `PermissionsGuard`

---

## 🎯 Décision d'architecture

Au lieu de créer un nouveau decorator `@RequirePermission()`, nous avons décidé d'**améliorer le `PermissionsGuard` existant** pour :
- ✅ Utiliser `AuthorizationService.can()` au lieu de juste CASL
- ✅ Gérer les scopes (own, assigned, team, any)
- ✅ Gérer le gating par module (plans)
- ✅ Rester rétrocompatible avec le code existant

---

## 📊 Comparaison des approches

### ❌ Approche initiale (ChatGPT)

**Créer un nouveau decorator :**
```typescript
@RequirePermission('event.create', 'events')  // Nouveau decorator
async create() { }
```

**Inconvénients :**
- ❌ Dupliquer la logique (`@Permissions` + `@RequirePermission`)
- ❌ Nécessite refactoring de tous les controllers
- ❌ Confusion : quel decorator utiliser ?
- ❌ Migration complexe du code existant

---

### ✅ Approche retenue (votre choix)

**Améliorer le guard existant :**
```typescript
@Permissions('event.create')  // Decorator existant
async create() { }
```

**Avantages :**
- ✅ Utilise le decorator déjà en place
- ✅ Moins de refactoring
- ✅ Rétrocompatible
- ✅ Une seule façon de faire
- ✅ Le module_key est extrait automatiquement du `PermissionRegistry`

---

## 🔧 Implémentation

### 1. Decorator (aucun changement)

```typescript
// src/common/decorators/permissions.decorator.ts
export const PERMISSIONS_KEY = 'permissions';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

**✅ Existant - Rien à faire**

---

### 2. Guard (à améliorer)

**Avant (actuel) :**
```typescript
// src/common/guards/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,  // ⚠️ Gating binaire uniquement
  ) {}
  
  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    
    // ⚠️ Utilise CASL uniquement - pas de scopes, pas de gating module
    const ability = this.caslAbilityFactory.createForUser(user);
    return requiredPermissions.some(permission => {
      const [action, subject] = this.parsePermission(permission);
      return ability.can(action, subject);  // Gating binaire
    });
  }
}
```

**Après (amélioré) :**
```typescript
// src/common/guards/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authorizationService: AuthorizationService,  // ✅ Nouveau service
    private caslAbilityFactory: CaslAbilityFactory,      // ✅ Garder pour fallback
  ) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    
    if (!requiredPermissions) {
      return true;
    }
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }
    
    // ✅ NOUVEAU : Utiliser AuthorizationService
    for (const permissionKey of requiredPermissions) {
      const authContext = {
        actorUserId: user.sub,
        actorOrgId: user.currentOrgId,
        // resourceTenantId, resourceOwnerId ajoutés au besoin
      };
      
      const allowed = await this.authorizationService.can(
        user, 
        permissionKey, 
        authContext
      );
      
      if (allowed) {
        return true;  // Au moins une permission OK
      }
    }
    
    throw new ForbiddenException('Insufficient permissions');
  }
}
```

---

### 3. AuthorizationService (nouveau)

```typescript
// src/rbac/authorization.service.ts
@Injectable()
export class AuthorizationService {
  constructor(
    private prisma: PrismaService,
    private modulesService: ModulesService,  // Pour gating module
  ) {}
  
  async can(user, permissionKey, context): Promise<boolean> {
    // 1. Bypass root
    if (user.is_root) return true;
    
    // 2. Extraire module_key depuis PermissionRegistry
    const permissionDef = PERMISSION_REGISTRY[permissionKey];
    if (!permissionDef) return false;
    
    const moduleKey = permissionDef.module;
    
    // 3. Gating par module
    const isModuleEnabled = await this.modulesService.isModuleEnabledForTenant(
      context.actorOrgId,
      moduleKey,
    );
    if (!isModuleEnabled) {
      return false;  // Module désactivé
    }
    
    // 4. Vérifier permission + scope
    const scope = await this.getBestScopeForPermission(
      user.sub,
      context.actorOrgId,
      permissionKey,
    );
    
    if (!scope) return false;
    
    // 5. Vérifier si le scope couvre la ressource
    return this.scopeCovers(scope, context);
  }
}
```

---

## 🎨 Exemples d'utilisation

### Controller (aucun changement nécessaire)

```typescript
// src/modules/events/events.controller.ts
@Controller('events')
@UseGuards(JwtAuthGuard, PermissionsGuard)  // ✅ Guards existants
export class EventsController {
  @Get()
  @Permissions('events.read')  // ✅ Decorator existant
  async findAll(@CurrentUser() user: any) {
    return this.eventsService.findAllForUser(user);
  }
  
  @Post()
  @Permissions('events.create')  // ✅ Decorator existant
  async create(@Body() dto: any) {
    return this.eventsService.create(dto);
  }
}
```

**✅ Le code existant continue de fonctionner !**

---

## 📦 Module_key : extraction automatique

Le `module_key` est **automatiquement extrait** depuis le `PermissionRegistry` :

```typescript
// src/rbac/permission-registry.ts
export const PERMISSION_REGISTRY = {
  'events.read': {
    module: 'events',  // ✅ Module key défini ici
    allowedScopes: ['own', 'assigned', 'team', 'any'],
    // ...
  },
  'attendees.create': {
    module: 'attendees',  // ✅ Module key défini ici
    allowedScopes: ['team', 'any'],
    // ...
  },
};
```

**Dans `AuthorizationService.can()` :**
```typescript
const permissionDef = PERMISSION_REGISTRY[permissionKey];
const moduleKey = permissionDef.module;  // ✅ Extraction auto

// Vérifier si le module est activé
const isModuleEnabled = await this.modulesService.isModuleEnabledForTenant(
  context.actorOrgId,
  moduleKey,
);
```

**✅ Pas besoin de passer module_key manuellement !**

---

## 🔄 Migration progressive

### Étape 1 : Créer AuthorizationService
```bash
# Créer le service sans toucher au guard
nest g service rbac/authorization
```

### Étape 2 : Tester AuthorizationService isolément
```typescript
// Test unitaire
describe('AuthorizationService', () => {
  it('should allow admin to read events', async () => {
    const canRead = await authService.can(adminUser, 'events.read', context);
    expect(canRead).toBe(true);
  });
});
```

### Étape 3 : Améliorer PermissionsGuard
```typescript
// Ajouter AuthorizationService comme dépendance
constructor(
  private reflector: Reflector,
  private authorizationService: AuthorizationService,  // ✅ Nouveau
  private caslAbilityFactory: CaslAbilityFactory,      // ✅ Garder
) {}
```

### Étape 4 : Feature flag (optionnel)
```typescript
// Permettre d'activer/désactiver progressivement
const useNewAuthz = process.env.USE_NEW_AUTHZ === 'true';

if (useNewAuthz) {
  return this.authorizationService.can(user, permissionKey, context);
} else {
  return this.caslAbilityFactory.can(action, subject);  // Ancien
}
```

---

## ✅ Avantages de cette approche

1. **Rétrocompatibilité**
   - Le code existant avec `@Permissions()` continue de fonctionner
   - Pas de refactoring massif nécessaire

2. **Migration progressive**
   - On peut tester `AuthorizationService` isolément
   - On peut activer progressivement avec feature flags
   - Rollback facile si problème

3. **Simplicité**
   - Une seule façon de faire : `@Permissions()`
   - Pas de confusion sur quel decorator utiliser
   - Moins de code à maintenir

4. **Extensibilité**
   - `AuthorizationService` peut évoluer indépendamment
   - CASL reste disponible comme fallback
   - Facile d'ajouter de nouveaux checks (scope, module, etc.)

5. **Performance**
   - Cache possible dans `AuthorizationService`
   - Optimisations centralisées
   - Pas de duplication de logique

---

## 📝 Checklist d'implémentation

### Phase 1 : Préparation
- [ ] Créer `PermissionRegistry` avec module_key
- [ ] Créer `AuthorizationService`
- [ ] Implémenter `can()`, `getBestScopeForPermission()`, `scopeCovers()`
- [ ] Tests unitaires

### Phase 2 : Intégration Guard
- [ ] Injecter `AuthorizationService` dans `PermissionsGuard`
- [ ] Remplacer appel CASL par `authorizationService.can()`
- [ ] Tester avec différents scopes
- [ ] Tests e2e

### Phase 3 : Module Gating
- [ ] Créer `ModulesService`
- [ ] Intégrer dans `AuthorizationService.can()`
- [ ] Tester désactivation de module
- [ ] Tests e2e

### Phase 4 : Déploiement
- [ ] Feature flag pour rollback si besoin
- [ ] Monitoring des permissions denied
- [ ] Documentation mise à jour
- [ ] Formation équipe

---

## 🎓 Conclusion

**Pourquoi cette approche est meilleure :**
- ✅ Moins de code à écrire
- ✅ Migration plus simple
- ✅ Rétrocompatible
- ✅ Plus maintenable
- ✅ Une seule source de vérité

**Votre intuition était correcte ! 🎯**

