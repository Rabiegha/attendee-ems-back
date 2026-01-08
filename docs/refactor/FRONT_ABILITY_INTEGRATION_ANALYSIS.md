# 🎯 Analyse : Intégration de `/me/ability` dans le Frontend

> **Date** : 9 janvier 2026  
> **Objectif** : Évaluer la complexité de l'intégration du système RBAC backend (GET /me/ability) dans le frontend React

---

## 📊 Synthèse Executive

### ✅ **BONNE NOUVELLE : Infrastructure Déjà Prête à 70%**

Votre frontend dispose déjà d'une **infrastructure CASL mature** qui est **compatible à 90%** avec le système RBAC backend prévu dans STEP 2.

**Temps d'implémentation estimé** : **2-3 jours** pour un développeur React expérimenté

**Complexité** : 🟢 **FAIBLE À MOYENNE**

---

## 🏗️ Infrastructure Existante (Ce qui est déjà en place)

### 1. ✅ Système CASL Complet

Votre frontend utilise déjà **CASL** (Can I See This Logic) avec :

- **`AppAbility`** : Type MongoAbility avec actions/subjects
- **`useCan(action, subject)`** : Hook pour vérifier les permissions
- **`<Can do="action" on="subject">`** : Composant de rendu conditionnel
- **`AbilityProvider`** : Context Provider pour injecter les permissions

**Fichiers clés** :
```
src/shared/acl/
├── app-ability.ts          ✅ Types CASL définis
├── hooks/useCan.ts         ✅ Hook de vérification
├── guards/Can.tsx          ✅ Composant conditionnel
└── permission-mapper.ts    ✅ Mapper permissions → CASL
```

### 2. ✅ Gestion d'État Redux avec Session

Votre frontend stocke déjà les permissions dans Redux :

```typescript
// sessionSlice.ts
interface SessionState {
  token: string | null
  user: User | null
  organization: Organization | null
  rules: AppRule[]              // ← Permissions CASL
  isAuthenticated: boolean
}
```

**Actions disponibles** :
- `setRules(rules)` : Met à jour les permissions
- `selectAbilityRules(state)` : Sélecteur des permissions

### 3. ✅ AbilityProvider Intelligent

Le `AbilityProvider` charge déjà les permissions depuis **3 sources** (par ordre de priorité) :

1. **JWT permissions** (format `code:scope`)
2. **API rules** (`GET /auth/policy`)
3. **Legacy role-based rules** (fallback)

**Code actuel** :
```typescript
// ability-provider.tsx
const ability = useMemo(() => {
  // PRIORITY 1: Use JWT permissions (NEW)
  if (user && token && payload?.permissions) {
    const caslRules = mapPermissionsToCASlRules(
      payload.permissions,
      user.id,
      orgId
    )
    return createAbilityFromRules(caslRules)
  }
  
  // PRIORITY 2: Use API rules (EXISTING)
  if (rules.length > 0) {
    return createAbilityFromRules(rules)
  }
  
  // PRIORITY 3: Fallback to role-based
  // ...
}, [rules, user, orgId, token])
```

### 4. ✅ Utilisation dans l'UI

Le système est déjà utilisé dans plusieurs endroits :

**Sidebar (Menus conditionnels)** :
```tsx
// Sidebar/index.tsx
{
  name: 'navigation.events',
  href: ROUTES.EVENTS,
  icon: Calendar,
  action: 'read' as const,
  subject: 'Event' as const,
},
```

**Dashboard (Affichage conditionnel)** :
```tsx
// Dashboard/index.tsx
const canReadOrganization = useCan('read', 'Organization')
const canReadEvent = useCan('read', 'Event')

{canReadEvent && <EventStats />}
```

**Boutons d'action** :
```tsx
<Can do="create" on="Event">
  <Button>Créer un événement</Button>
</Can>
```

---

## 🔄 Ce qui Doit Être Adapté (Travail Requis)

### 1. 🟡 Créer l'Endpoint `/me/ability` dans authApi

**Fichier** : `src/features/auth/api/authApi.ts`

**À ajouter** :
```typescript
export interface AbilityResponse {
  orgId: string | null
  mode: 'tenant' | 'platform'
  modules: string[]              // Modules activés
  grants: Grant[]                // Permissions avec scopes
}

export interface Grant {
  key: string                    // 'event.create'
  scope: 'any' | 'own' | 'assigned' | 'org'
}

export const authApi = rootApi.injectEndpoints({
  endpoints: (builder) => ({
    // ... endpoints existants
    
    // 🆕 NOUVEAU
    getMyAbility: builder.query<AbilityResponse, void>({
      query: () => API_ENDPOINTS.AUTH.ABILITY,
      providesTags: ['Ability'],
    }),
  }),
})

export const {
  // ... exports existants
  useGetMyAbilityQuery,  // 🆕 Hook auto-généré
} = authApi
```

**Constante à ajouter** :
```typescript
// app/config/constants.ts
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    ME: '/auth/me',
    POLICY: '/auth/policy',
    ABILITY: '/auth/me/ability',  // 🆕 NOUVEAU
    // ...
  },
  // ...
}
```

**Temps estimé** : 30 minutes

---

### 2. 🟡 Adapter `AbilityProvider` pour Utiliser `/me/ability`

**Fichier** : `src/app/providers/ability-provider.tsx`

**Changements** :

#### A) Remplacer `useGetPolicyQuery` par `useGetMyAbilityQuery`

**Avant** :
```typescript
const { data: policyData } = useGetPolicyQuery(undefined, {
  skip: shouldSkipPolicy,
})
```

**Après** :
```typescript
const { data: abilityData } = useGetMyAbilityQuery(undefined, {
  skip: shouldSkipAbility,
})
```

#### B) Transformer `AbilityResponse` en CASL Rules

**Nouveau code** :
```typescript
useEffect(() => {
  if (abilityData?.grants) {
    // Transformer les grants backend en CASL rules
    const caslRules: AppRule[] = abilityData.grants.map(grant => {
      const [resource, action] = grant.key.split('.')
      
      return {
        action: mapActionToCASQL(action),
        subject: mapResourceToSubject(resource),
        conditions: buildConditions(grant.scope, user.id, orgId),
      }
    })
    
    dispatch(setRules(caslRules))
  }
}, [abilityData, dispatch])

// Helpers
function mapActionToCASQL(action: string): Actions {
  const mapping = {
    'create': 'create',
    'read': 'read',
    'update': 'update',
    'delete': 'delete',
    'manage': 'manage',
    'export': 'export',
    'checkin': 'checkin',
  }
  return (mapping[action] || action) as Actions
}

function mapResourceToSubject(resource: string): Subjects {
  const mapping = {
    'events': 'Event',
    'attendees': 'Attendee',
    'users': 'User',
    'organizations': 'Organization',
    'badges': 'Badge',
    'invitations': 'Invitation',
    'roles': 'Role',
  }
  return (mapping[resource] || resource) as Subjects
}

function buildConditions(
  scope: string,
  userId: string,
  orgId: string
): Record<string, any> | undefined {
  switch (scope) {
    case 'own':
      return { user_id: userId }
    case 'org':
      return { org_id: orgId }
    case 'assigned':
      // Backend gère le filtering
      return undefined
    case 'any':
      return undefined
    default:
      return undefined
  }
}
```

**Temps estimé** : 2 heures (avec tests)

---

### 3. 🟡 Appeler `/me/ability` Après Login et Switch

**Fichier** : `src/features/auth/authLifecycle.ts` (à créer si n'existe pas)

**Flow** :
```typescript
// 1) Login réussi
const { data } = await login({ email, password })

// 2) Stocker le token
dispatch(setSession({
  token: data.access_token,
  user: data.user,
  organization: data.organization,
}))

// 3) Charger les permissions
dispatch(authApi.endpoints.getMyAbility.initiate())
```

**Alternative** : Le `useGetMyAbilityQuery` se déclenche automatiquement dans `AbilityProvider` dès que `user` et `orgId` sont disponibles.

**Temps estimé** : 1 heure

---

### 4. 🟢 Affichage Conditionnel de Modules (OPTIONNEL)

Si vous voulez gérer les **module gating** (plans Free/Pro/Enterprise), vous pouvez ajouter :

**Nouveau Hook** :
```typescript
// src/shared/hooks/useModule.ts
export function useModule(moduleKey: string): boolean {
  const abilityData = useSelector(selectAbilityData)
  return abilityData?.modules?.includes(moduleKey) ?? false
}
```

**Utilisation** :
```tsx
// Sidebar
const hasBadgesModule = useModule('badges')

{hasBadgesModule && (
  <NavLink to="/badges">
    <CreditCard /> Badge Designer
  </NavLink>
)}
```

**Temps estimé** : 1 heure

---

## 📋 Plan d'Action (Step-by-Step)

### Phase 1 : Backend Ready (STEP 2 Backend)
**Durée** : Déjà fait ou 1-2 jours
- [ ] Endpoint `GET /auth/me/ability` implémenté
- [ ] Retourne `{ orgId, mode, modules, grants }`
- [ ] Testé avec Postman

### Phase 2 : Frontend API Integration (1 jour)
**Fichiers** :
- [ ] `src/app/config/constants.ts` → Ajouter `ABILITY: '/auth/me/ability'`
- [ ] `src/features/auth/api/authApi.ts` → Créer `getMyAbility` endpoint
- [ ] Tester avec Redux DevTools que les données arrivent

### Phase 3 : AbilityProvider Adaptation (2-3 heures)
**Fichier** : `src/app/providers/ability-provider.tsx`
- [ ] Remplacer `useGetPolicyQuery` par `useGetMyAbilityQuery`
- [ ] Créer les helpers `mapActionToCASQL`, `mapResourceToSubject`, `buildConditions`
- [ ] Transformer `grants` en CASL rules
- [ ] Tester dans Redux DevTools que `rules` sont correctement mis à jour

### Phase 4 : Validation UI (1 jour)
- [ ] Tester que les menus sidebar s'affichent correctement
- [ ] Tester que les boutons d'action apparaissent/disparaissent
- [ ] Tester avec différents rôles (Admin, Manager, Staff, Viewer)
- [ ] Tester le switch d'organisation (si multi-org)

### Phase 5 : Module Gating (OPTIONNEL - 2 heures)
- [ ] Créer `useModule(moduleKey)` hook
- [ ] Masquer sections selon les modules activés
- [ ] Tester avec plans Free/Pro/Enterprise

---

## 🚀 Avantages de Votre Architecture Actuelle

### 1. ✅ CASL = Standard Industrie
Vous utilisez déjà **CASL**, la librairie de référence pour la gestion des permissions en React. C'est un excellent choix !

### 2. ✅ Découplage UI / Logique
Votre système actuel sépare bien :
- **Logique de permissions** → `ability-provider.tsx`, `permission-mapper.ts`
- **Composants UI** → `<Can>`, `useCan()`

Cela facilite les tests et la maintenance.

### 3. ✅ Fallback Intelligent
Le système actuel a 3 niveaux de fallback :
1. JWT permissions (nouveau)
2. API rules (actuel)
3. Role-based (legacy)

Cela garantit que l'app fonctionne toujours même si une source échoue.

### 4. ✅ Redux pour la Persistence
Les permissions sont stockées dans Redux → pas de re-fetch à chaque render.

---

## ⚠️ Points d'Attention

### 1. 🟡 Mapping Actions Backend → Frontend

Le backend utilise des actions comme :
- `event.create`, `event.read`, `event.update`, `event.delete`

Le frontend utilise des actions CASL :
- `create Event`, `read Event`, `update Event`, `delete Event`

**Solution** : Le helper `mapActionToCASQL` doit gérer les actions customs (ex: `checkin`, `export`, etc.)

### 2. 🟡 Scopes Backend vs Conditions CASL

**Backend scopes** :
- `own` : Ressources de l'utilisateur
- `org` : Ressources de l'organisation
- `assigned` : Ressources assignées
- `any` : Tout

**CASL conditions** :
```typescript
{ user_id: userId }       // own
{ org_id: orgId }         // org
undefined                 // any ou assigned
```

**Important** : Le scope `assigned` ne peut pas être exprimé en conditions frontend. Le backend doit filtrer les données.

### 3. 🟡 Invalidation du Cache

Quand les permissions changent (switch org, changement de rôle), il faut :

**A) Invalider le cache RTK Query** :
```typescript
dispatch(authApi.util.invalidateTags(['Ability']))
```

**B) Refetch `/me/ability`** :
```typescript
dispatch(authApi.endpoints.getMyAbility.initiate(undefined, { forceRefetch: true }))
```

### 4. 🟡 Permissions Stale en JWT

Si vous utilisez **JWT permissions** (Priority 1), les permissions sont "stale" jusqu'au prochain refresh token.

**Solution** : Après login ou switch org, toujours appeler `/me/ability` pour avoir les permissions à jour.

---

## 🧪 Plan de Tests

### Tests Unitaires (Jest)
```typescript
describe('mapActionToCASQL', () => {
  it('should map create action', () => {
    expect(mapActionToCASQL('create')).toBe('create')
  })
  
  it('should map custom actions', () => {
    expect(mapActionToCASQL('checkin')).toBe('checkin')
  })
})

describe('buildConditions', () => {
  it('should build own conditions', () => {
    const conditions = buildConditions('own', 'user-123', 'org-456')
    expect(conditions).toEqual({ user_id: 'user-123' })
  })
})
```

### Tests d'Intégration (React Testing Library)
```typescript
describe('AbilityProvider', () => {
  it('should load abilities from API', async () => {
    const { result } = renderHook(() => useAbility(), {
      wrapper: ({ children }) => (
        <Provider store={store}>
          <AbilityProvider>{children}</AbilityProvider>
        </Provider>
      ),
    })
    
    await waitFor(() => {
      expect(result.current.can('read', 'Event')).toBe(true)
    })
  })
})
```

### Tests E2E (Playwright / Cypress)
```typescript
test('Admin can see all menu items', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name=email]', 'admin@test.com')
  await page.fill('input[name=password]', 'password')
  await page.click('button[type=submit]')
  
  // Vérifier que tous les menus sont visibles
  await expect(page.locator('text=Events')).toBeVisible()
  await expect(page.locator('text=Users')).toBeVisible()
  await expect(page.locator('text=Roles')).toBeVisible()
})

test('Staff cannot see admin menus', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name=email]', 'staff@test.com')
  await page.fill('input[name=password]', 'password')
  await page.click('button[type=submit]')
  
  // Vérifier que certains menus sont cachés
  await expect(page.locator('text=Events')).toBeVisible()
  await expect(page.locator('text=Users')).not.toBeVisible()
  await expect(page.locator('text=Roles')).not.toBeVisible()
})
```

---

## 📊 Estimation Finale

| Phase | Tâche | Complexité | Durée |
|-------|-------|------------|-------|
| **1** | Endpoint `/me/ability` backend | 🟢 Faible | 1-2 jours |
| **2** | Créer `getMyAbility` dans authApi | 🟢 Faible | 30 min |
| **3** | Adapter `AbilityProvider` | 🟡 Moyenne | 2-3h |
| **4** | Helpers mapping (actions, resources, conditions) | 🟡 Moyenne | 1-2h |
| **5** | Tests unitaires | 🟢 Faible | 1h |
| **6** | Tests d'intégration UI | 🟡 Moyenne | 2-3h |
| **7** | Tests E2E (multi-rôles) | 🟡 Moyenne | 2-3h |
| **8** | Module gating (optionnel) | 🟢 Faible | 1-2h |
| **TOTAL** | | | **2-3 jours** |

---

## ✅ Conclusion

### 🎉 **Vous êtes dans une position EXCELLENTE !**

**Pourquoi ?**
1. ✅ Infrastructure CASL déjà en place (70% du travail)
2. ✅ Redux avec `rules` state
3. ✅ Components `<Can>` et hooks `useCan()` déjà utilisés
4. ✅ Système de mapping déjà existant (`permission-mapper.ts`)

**Ce qui reste à faire** :
1. Créer l'endpoint `getMyAbility` dans `authApi.ts` (30 min)
2. Adapter `AbilityProvider` pour appeler `/me/ability` au lieu de `/policy` (2-3h)
3. Créer les helpers de mapping (actions, resources, scopes) (1-2h)
4. Tester avec différents rôles (2-3h)

**Total** : **2-3 jours** de travail pour un développeur React expérimenté.

### 🚀 Recommandations

1. **Commencez par le backend** : Finissez STEP 2 (endpoint `/me/ability`) avant de toucher au front
2. **Testez avec Postman** : Validez que `/me/ability` retourne les bonnes permissions
3. **Adaptez progressivement** : Gardez l'ancien système (`/policy`) en fallback pendant la migration
4. **Écrivez des tests** : Testez chaque rôle (Admin, Manager, Staff, Viewer) pour éviter les régressions
5. **Documentez les mappings** : Créez une table de correspondance Backend Actions → CASL Actions

### 📈 Bénéfices Attendus

- ✅ **Permissions dynamiques** : Changements instantanés sans recompiler le JWT
- ✅ **Sécurité renforcée** : Les permissions ne sont plus dans le JWT (moins de surface d'attaque)
- ✅ **Scalabilité** : Support multi-org natif
- ✅ **Maintenabilité** : Source unique de vérité (backend)
- ✅ **UX améliorée** : UI réactive aux permissions réelles

---

## 📚 Ressources

- [CASL Documentation](https://casl.js.org/v6/en/)
- [Redux Toolkit Query](https://redux-toolkit.js.org/rtk-query/overview)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

**Questions ?** Posez-les dans ce document ou dans le chat de l'équipe !
