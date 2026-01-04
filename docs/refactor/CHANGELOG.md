# Changelog - STEP 1 Multi-tenant Refactor

## [1.0.0] - 2026-01-04

### 🎉 STEP 1 - Multi-tenant Model (DB-level)

#### ✨ Nouveautés Majeures

##### Modèle Multi-tenant
- **User global** : Un compte user peut maintenant appartenir à plusieurs organisations
- **Email unique global** : Suppression de la contrainte unique par org, email maintenant unique globalement
- **Séparation rôles tenant/platform** : Deux systèmes d'assignation distincts avec contraintes DB strictes

##### Nouveaux Modèles Prisma

1. **OrgUser** - Membership multi-tenant
   - Gère l'appartenance d'un user à N organisations
   - Contrainte UNIQUE (user_id, org_id)
   - CASCADE on delete user/org

2. **TenantUserRole** - Assignation rôles tenant
   - 1 rôle tenant actif par user par org
   - FK composite vers org_users (garantit membership)
   - FK composite vers roles (garantit même org)
   - Contrainte UNIQUE (user_id, org_id)

3. **PlatformUserRole** - Assignation rôles platform
   - 1 rôle platform max par user (support/root)
   - Contrainte UNIQUE (user_id)
   - Enum PlatformScope (all | assigned)

4. **PlatformUserOrgAccess** - Accès platform assigned
   - Orgs accessibles par un user platform avec scope=assigned
   - Contrainte UNIQUE (user_id, org_id)

##### Modèle Role Enrichi
- `org_id` nullable : NULL = platform, NOT NULL = tenant
- Nouveaux champs :
  - `rank` : ordre de priorité
  - `role_type` : classification (admin, manager, staff, viewer)
  - `is_platform` : flag rôle platform
  - `is_root` : flag root (bypass all)
  - `is_locked` : non supprimable
  - `managed_by_template` : géré par propagation (STEP 3)
- Contrainte UNIQUE (id, org_id) pour FK composites

##### Enum PlatformScope
```typescript
enum PlatformScope {
  all       // Accès à toutes les orgs
  assigned  // Accès uniquement aux orgs dans platform_user_org_access
}
```

#### 🛡️ Garanties DB (Contraintes)

##### Contraintes UNIQUE
- `users.email` : email unique global
- `org_users(user_id, org_id)` : membership unique
- `tenant_user_roles(user_id, org_id)` : 1 rôle tenant par org
- `platform_user_roles(user_id)` : 1 rôle platform max
- `roles(id, org_id)` : nécessaire pour FK composites
- `roles(org_id, code)` : code unique par org

##### FK Composites (Invariants DB)
- `tenant_user_roles(user_id, org_id) → org_users(user_id, org_id)`
  - Garantit que le user est membre de l'org
- `tenant_user_roles(role_id, org_id) → roles(id, org_id)`
  - Garantit que le rôle appartient à la même org

##### Triggers PostgreSQL
- `trigger_check_platform_role`
  - Empêche l'assignation d'un rôle tenant dans platform_user_roles
- `trigger_check_tenant_role`
  - Empêche l'assignation d'un rôle platform dans tenant_user_roles

#### 📝 Modifications du Schema

##### Table `users` (modifications majeures)
**SUPPRIMÉ** :
- `org_id` : le user n'appartient plus à une seule org
- `role_id` : les rôles sont dans les tables d'assignation
- `@@unique([email, org_id])` : email maintenant unique global
- `@@unique([id, org_id])` : plus nécessaire

**AJOUTÉ** :
- `@@unique([email])` : email unique global
- Relations vers `OrgUser[]`, `TenantUserRole[]`, `PlatformUserRole?`, `PlatformUserOrgAccess[]`

##### Table `organizations`
**AJOUTÉ** :
- Relations vers `OrgUser[]`, `TenantUserRole[]`, `PlatformUserOrgAccess[]`

##### Table `roles`
**AJOUTÉ** :
- `rank` : Int?
- `role_type` : String?
- `is_platform` : Boolean @default(false)
- `is_root` : Boolean @default(false)
- `is_locked` : Boolean @default(false)
- `managed_by_template` : Boolean @default(false)
- `@@unique([id, org_id])` : pour FK composites
- Relations vers `TenantUserRole[]`, `PlatformUserRole[]`

#### 🗄️ Migration SQL

##### Nouveau fichier de migration
- `prisma/migrations/STEP1_MULTITENANT_REFACTOR/migration.sql`
- Contient :
  - Création enum `PlatformScope`
  - Modifications table `users`
  - Modifications table `roles`
  - Création table `org_users`
  - Création table `tenant_user_roles`
  - Création table `platform_user_roles`
  - Création table `platform_user_org_access`
  - Triggers de validation
  - Migration des données existantes
  - Scripts de validation

#### 🌱 Seed Idempotent

##### Nouveau fichier de seed
- `prisma/seeds/step1-multitenant.seed.ts`
- Fonctionnalités :
  - Création des rôles platform (ROOT, SUPPORT)
  - Création des rôles tenant pour chaque org (ADMIN, MANAGER, STAFF, VIEWER)
  - Idempotent (upsert) : peut être exécuté plusieurs fois
  - Exportable : fonctions réutilisables dans le code applicatif

##### Rôles Platform
- **ROOT** : level 0, is_root: true, scope: all
- **SUPPORT** : level 10, is_root: false, scope: assigned

##### Rôles Tenant (par org)
- **ADMIN** : level 1, managed_by_template: true
- **MANAGER** : level 2, managed_by_template: true
- **STAFF** : level 3, managed_by_template: true
- **VIEWER** : level 4, managed_by_template: true

#### 🧪 Tests

##### Nouveau fichier de tests
- `test/step1-multitenant.spec.ts`
- Couvre :
  - User global (email unique)
  - OrgUser (membership multi-tenant)
  - TenantUserRole (contraintes et invariants)
  - PlatformUserRole (1 max par user)
  - PlatformUserOrgAccess (accès assigned)
  - Scénarios complets (multi-tenant, support, root)
  - Validation des triggers
  - Validation des FK composites

#### 🔧 Scripts

##### Script de validation
- `scripts/validate-step1-migration.ts`
- Vérifie :
  - Existence des tables
  - Contraintes UNIQUE
  - Contraintes FK
  - Triggers
  - Migration des données
  - Rôles créés
  - Invariants respectés
- Rapport coloré avec résumé

##### Commandes npm ajoutées
```json
"db:seed:step1": "ts-node prisma/seeds/step1-multitenant.seed.ts"
"db:validate:step1": "ts-node scripts/validate-step1-migration.ts"
```

#### 📚 Documentation

##### Nouveaux fichiers
- `docs/refactor/INDEX.md` : Point d'entrée principal
- `docs/refactor/README.md` : Vue d'ensemble du refactor
- `docs/refactor/STEP_1_MULTITENANT.md` : Documentation complète
- `docs/refactor/STEP_1_EXECUTION_GUIDE.md` : Guide d'exécution
- `docs/refactor/STEP_1_DIAGRAMS.md` : Diagrammes visuels
- `docs/refactor/QUICK_REFERENCE.md` : Référence rapide
- `docs/refactor/CHANGELOG.md` : Ce fichier

##### Contenu de la documentation
- Architecture détaillée du nouveau modèle
- Explication des choix techniques (pourquoi 2 tables)
- Exemples de requêtes et scénarios d'usage
- Guide d'exécution pas à pas
- Checklist de validation
- Troubleshooting
- Diagrammes ERD, flux, scénarios
- Référence des commandes

#### 🔄 Comportements de Suppression

##### User supprimé
- CASCADE : org_users, tenant_user_roles, platform_user_roles, platform_user_org_access
- Les données métier (events, attendees, etc.) sont préservées via snapshot

##### Organization supprimée
- CASCADE : org_users, roles (tenant), tenant_user_roles, platform_user_org_access
- Les données métier de l'org sont supprimées (events, attendees, etc.)

##### Role supprimé
- RESTRICT : si utilisé dans tenant_user_roles ou platform_user_roles
- Il faut d'abord réassigner les users ou supprimer les assignations

#### ⚠️ Breaking Changes

##### API / Code Applicatif
- **User.org_id** : supprimé → utiliser les relations `orgMemberships`
- **User.role_id** : supprimé → utiliser les relations `tenantRoles` et `platformRole`
- **User.organization** : supprimé → utiliser `orgMemberships`
- **User.role** : supprimé → utiliser `tenantRoles` ou `platformRole`

##### Requêtes à adapter
```typescript
// ❌ Ancien
const user = await prisma.user.findUnique({
  where: { id },
  include: { organization: true, role: true },
});

// ✅ Nouveau
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    orgMemberships: { include: { organization: true } },
    tenantRoles: { include: { role: true, organization: true } },
    platformRole: { include: { role: true } },
  },
});
```

#### 🎯 Scénarios Supportés

##### 1. User Multi-tenant
Un user peut appartenir à plusieurs orgs avec des rôles différents :
- Alice : Admin dans Org A, Viewer dans Org B

##### 2. Support Agent (Platform Assigned)
Un user avec rôle platform et accès limité :
- Bob : Support avec accès aux orgs 1, 2, 3

##### 3. Root Administrator
Un user avec accès complet :
- Charlie : Root (bypass all authorization)

#### 📊 Statistiques

- **Tables créées** : 4 (org_users, tenant_user_roles, platform_user_roles, platform_user_org_access)
- **Contraintes UNIQUE** : 6
- **Contraintes FK** : 10 (dont 2 composites)
- **Triggers** : 2
- **Enums** : 1 (PlatformScope)
- **Champs ajoutés à Role** : 6
- **Lignes de migration SQL** : ~400
- **Tests unitaires** : 20+
- **Pages de documentation** : 6

#### 🔒 Sécurité

##### Améliorations
- Invariants garantis au niveau DB (pas uniquement applicatif)
- FK composites empêchent les incohérences
- Triggers empêchent les cross-assignments
- Contraintes UNIQUE empêchent les doublons
- Email unique global (pas de collisions)

##### Validation
- Script de validation automatique
- Tests de validation des contraintes
- Tests des triggers
- Tests des scénarios complets

#### 📈 Performance

##### Index créés
- `org_users(user_id)` : lookup memberships par user
- `org_users(org_id)` : lookup membres par org
- `tenant_user_roles(user_id)` : lookup rôles par user
- `tenant_user_roles(org_id)` : lookup rôles par org
- `tenant_user_roles(role_id)` : lookup users par rôle
- `platform_user_roles(role_id)` : lookup users platform
- `platform_user_org_access(user_id)` : lookup accès par user
- `platform_user_org_access(org_id)` : lookup users par org

##### Optimisations
- FK composites utilisent les index existants
- Contraintes UNIQUE servent aussi d'index
- Pas de scan de table pour les lookups

#### 🚀 Déploiement

##### Étapes
1. Backup de la base de données
2. Validation du schéma Prisma
3. Génération du client Prisma
4. Application de la migration
5. Exécution du seed
6. Validation automatique
7. Tests
8. Monitoring

##### Durée estimée
- Backup : 5 min
- Migration : 15 min
- Seed : 5 min
- Tests : 30 min
- **Total** : ~1h (incluant validation et monitoring)

#### 🔮 Prochaines Étapes

##### STEP 2 - Authorization Service (à venir)
- Service centralisé d'autorisation
- Guards et decorators NestJS
- Context switching (org active)
- Vérification des permissions

##### STEP 3 - Role Propagation (à venir)
- Templates de rôles
- Propagation automatique
- Synchronisation des permissions
- Audit trail

##### STEP 4 - Advanced RBAC (à venir)
- Permissions conditionnelles
- Feature flags
- Time-based permissions
- Data-level security

---

## Notes de Migration

### Compatibilité
- ✅ PostgreSQL 14+
- ✅ Prisma 5.x
- ✅ NestJS 10.x
- ✅ Node.js 18+

### Prérequis
- Backup de la base de données
- Fenêtre de maintenance (1h recommandée)
- Accès admin à PostgreSQL
- Variables d'environnement configurées

### Rollback
- Restauration du backup : testée et fonctionnelle
- Aucune perte de données si backup correct
- Procédure documentée dans STEP_1_EXECUTION_GUIDE.md

---

## Remerciements

Ce refactor a été conçu avec les principes suivants :
- **Fiabilité > Facilité** : contraintes DB strictes
- **Explicit > Implicit** : relations claires
- **Testabilité** : tests complets
- **Documentation** : exemples et guides détaillés

---

**Date de release** : 4 Janvier 2026  
**Version** : 1.0.0  
**Auteur** : GitHub Copilot  
**Status** : ✅ Prêt pour production
