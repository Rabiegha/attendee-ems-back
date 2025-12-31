# RBAC Multi-Tenant - Guide de Démarrage

> **Date :** Décembre 2024  
> **Projet :** Attendee EMS Backend (NestJS)

## 📚 Documentation mise à jour

Votre documentation RBAC a été complètement revue et adaptée pour **NestJS + Prisma** :

### ✅ Fichiers créés/mis à jour

1. **`docs/ARCHITECTURE_RBAC.md`** ✅ MISE À JOUR
   - Brainstorming adapté à NestJS (Guards, Services, Decorators)
   - Architecture complète avec diagrammes
   - Description des composants NestJS existants
   - Invariants et règles métier
   - Tables Prisma documentées

2. **`docs/PLAN_IMPLEMENTATION_RBAC_NESTJS.md`** ✅ NOUVEAU
   - Plan d'implémentation en 8 phases
   - Détails techniques spécifiques à NestJS
   - Code examples pour chaque phase
   - Checklist complète
   - Estimation : 8-10 semaines

3. **`docs/# Plan : Implémentation RBAC Multi-Tenan.prompt.md`** (original de ChatGPT)
   - Conservé pour référence
   - Non orienté NestJS (générique)

---

## 🎯 Prochaines étapes

### Priorité immédiate : Phase 0 & 1

Vous êtes actuellement en **Phase 0** (Documentation) - ✅ **COMPLÉTÉE**

**Prochaine phase : Phase 1 - Modèle de données** (3-5 jours)

#### Actions concrètes à faire maintenant :

1. **Lire attentivement les 2 documents** :
   ```bash
   # Lire l'architecture
   cat docs/ARCHITECTURE_RBAC.md
   
   # Lire le plan d'implémentation
   cat docs/PLAN_IMPLEMENTATION_RBAC_NESTJS.md
   ```

2. **Vérifier votre schema Prisma actuel** :
   ```bash
   npm run db:studio
   # Vérifier que toutes les tables RBAC existent
   ```

3. **Identifier les différences entre le plan et votre implémentation actuelle**
   - Quels champs manquent dans vos seeders ?
   - Quels guards sont déjà en place ?
   - Quels services existent déjà ?

---

## 📋 État actuel de votre projet

### ✅ Ce qui existe déjà

**Schema Prisma** (100% complet)
- ✅ `User` avec `is_platform`, `is_root`
- ✅ `OrgUser` (multi-tenant)
- ✅ `UserRole` (rôles par org)
- ✅ `Role` avec tous les nouveaux champs (`rank`, `role_type`, `is_locked`, `managed_by_template`)
- ✅ `Permission` avec `module_key`, `allowed_scopes`, `default_scope_ceiling`
- ✅ `RolePermission` avec `scope`
- ✅ `Plan`, `Module`, `PlanModule`, `OrgModuleOverride`
- ✅ `PlatformUserOrgAccess`

**Guards NestJS**
- ✅ `JwtAuthGuard` (authentification)
- ✅ `TenantContextGuard` (contexte org)
- ✅ `PermissionsGuard` (vérification permissions)
- ✅ `RoleModificationGuard` (protection rôles)

**Services**
- ✅ `CaslAbilityFactory` (gating binaire)
- ✅ `RbacService` (embryonnaire, à améliorer)

**Seeders**
- ✅ `permissions.seeder.ts` (~931 lignes)
- ✅ `roles.seeder.ts` (~256 lignes)

### ⚠️ Ce qui doit être amélioré

**Seeders**
- ⚠️ Utilisent `level` au lieu de `rank`
- ⚠️ Ne remplissent pas tous les nouveaux champs RBAC
- ⚠️ Pas de seeder pour Plans/Modules

**Services**
- ⚠️ `RbacService` incomplet (logique scope partielle)
- ⚠️ Pas de `AuthorizationService` complet
- ⚠️ Pas de `ModulesService` (gating plans)
- ⚠️ Pas de `RoleProvisioningService` (propagation)

**Guards**
- ⚠️ `PermissionsGuard` utilise CASL uniquement (pas de scopes)
- ⚠️ Pas de gating par module
- ⚠️ Anti-escalade incomplète dans `RoleModificationGuard`

**JWT**
- ⚠️ Mono-org (pas de `currentOrgId`, `availableOrgIds`)
- ⚠️ Pas de switch d'organisation

**Registry**
- ❌ Pas de `PermissionRegistry` TypeScript

---

## 🚀 Démarrer Phase 1 (maintenant)

### Phase 1 : Mise à niveau modèle de données (3-5 jours)

**Objectif :** Mettre à jour les seeders pour utiliser tous les nouveaux champs Prisma.

#### Checklist Phase 1

**Étape 1.1 : Migrer roles.seeder.ts** (1 jour)
```bash
# 1. Ouvrir le fichier
code prisma/seeders/roles.seeder.ts

# 2. Remplacer tous les `level` par `rank`
# 3. Ajouter les champs manquants pour chaque rôle :
#    - is_root, is_platform, role_type, is_locked, 
#      managed_by_template, permission_ceiling_scope

# 4. Tester
npm run db:seed
npm run db:studio  # Vérifier en DB
```

**Étape 1.2 : Compléter permissions.seeder.ts** (1 jour)
```bash
# 1. Ouvrir le fichier
code prisma/seeders/permissions.seeder.ts

# 2. Pour chaque permission, vérifier/ajouter :
#    - module_key (ex: 'events', 'attendees', 'badges')
#    - allowed_scopes (ex: ['own', 'team', 'any'])
#    - default_scope_ceiling (ex: 'any')

# 3. Regrouper par module pour lisibilité

# 4. Tester
npm run db:seed
```

**Étape 1.3 : Créer plans.seeder.ts** (1 jour)
```bash
# 1. Créer le fichier
touch prisma/seeders/plans.seeder.ts

# 2. Implémenter (voir PLAN_IMPLEMENTATION_RBAC_NESTJS.md Phase 1)

# 3. Créer les modules de base
#    - events, attendees, badges, reports, analytics, etc.

# 4. Créer 3 plans
#    - FREE (events, attendees)
#    - PRO (events, attendees, badges, reports)
#    - ENTERPRISE (tous les modules)

# 5. Tester
npm run db:seed
```

**Étape 1.4 : Vérifier les migrations** (1 jour)
```bash
# Vérifier que le schema est à jour
npm run db:generate

# Si besoin, créer une migration
npm run db:migrate -- --name update_rbac_fields

# Vérifier l'état
npx prisma migrate status
```

**Critères de succès Phase 1 :**
- [ ] Tous les rôles ont `rank`, `role_type`, `is_locked`, `managed_by_template`
- [ ] Toutes les permissions ont `module_key`, `allowed_scopes`
- [ ] Plans FREE, PRO, ENTERPRISE créés
- [ ] Modules créés (events, attendees, badges, reports, etc.)
- [ ] `npm run start:dev` démarre sans erreur
- [ ] `npm run db:studio` montre toutes les données correctes

---

## 💡 Conseils pour la suite

### Après Phase 1 : Phase 2 (PermissionRegistry)

**Ne pas tout faire d'un coup !**

1. Commencer avec 10-20 permissions critiques seulement
   - events.read, events.create, events.update, events.delete
   - attendees.read, attendees.create, etc.

2. Compléter au fur et à mesure (incremental)

3. Utiliser le script de génération pour synchroniser avec les seeders

### Approche recommandée

**✅ Bon :**
- Phase par phase
- Tests après chaque phase
- Documentation au fur et à mesure
- Code reviews régulières

**❌ À éviter :**
- Tout coder d'un coup
- Pas de tests intermédiaires
- Casser l'existant sans plan de rollback

---

## 📖 Ressources

### Documentation créée
1. `docs/ARCHITECTURE_RBAC.md` - Vue d'ensemble complète
2. `docs/PLAN_IMPLEMENTATION_RBAC_NESTJS.md` - Plan d'implémentation détaillé
3. `docs/GETTING_STARTED_RBAC.md` - Ce fichier

### Liens utiles
- [NestJS Guards](https://docs.nestjs.com/guards)
- [Prisma Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
- [CASL](https://casl.js.org/v6/en/)

### Commandes utiles
```bash
# Développement
npm run start:dev

# Base de données
npm run db:studio          # Ouvrir Prisma Studio
npm run db:generate        # Générer le client Prisma
npm run db:migrate         # Créer une migration
npm run db:seed            # Seeder la DB

# Tests
npm run test
npm run test:e2e

# Debugging
npm run start:debug
```

---

## ❓ Questions à se poser avant de commencer

### Questions architecture

1. **Multi-org** : Voulez-vous implémenter le multi-org dès maintenant ou plus tard ?
   - Si "plus tard" : Garder Phase 5 pour la fin
   - Si "maintenant" : Prioriser Phase 5 après Phase 3

2. **Propagation** : Est-ce critique maintenant ou peut attendre ?
   - Si "peut attendre" : Phase 6 en dernière position
   - Si "critique" : Faire après Phase 2

3. **Frontend** : Allez-vous travailler aussi sur le frontend ?
   - Si "oui" : Faire Phase 8 progressivement avec le backend
   - Si "non" : Laisser Phase 8 pour plus tard

### Questions techniques

1. **Redis** : Avez-vous Redis disponible pour le cache des permissions ?
   - Si "oui" : Implémenter le cache dès Phase 3
   - Si "non" : Commencer sans cache, l'ajouter plus tard

2. **Tests** : Quelle stratégie de tests ?
   - Tests unitaires pour chaque service
   - Tests e2e pour les flows complets
   - Tests d'intégration pour les guards

3. **Migration** : Comment gérer la transition ?
   - Feature flags pour activer progressivement ?
   - Migration big bang ?
   - Cohabitation ancien/nouveau système ?

---

## 🎬 Action immédiate

**Maintenant, faites ceci :**

1. ✅ Lire `docs/ARCHITECTURE_RBAC.md` (30 min)
2. ✅ Lire `docs/PLAN_IMPLEMENTATION_RBAC_NESTJS.md` Phase 0 et Phase 1 (30 min)
3. ⬜ Ouvrir `prisma/seeders/roles.seeder.ts` et identifier les changements nécessaires (15 min)
4. ⬜ Créer une branche Git `feature/rbac-phase1`
5. ⬜ Commencer les modifications du seeder roles (2-3 heures)
6. ⬜ Tester avec `npm run db:seed`
7. ⬜ Commit & push
8. ⬜ Passer à `permissions.seeder.ts`

**Vous êtes prêt ! 🚀**

---

## 🆘 Besoin d'aide ?

Si vous êtes bloqué ou avez des questions :

1. Relire la section concernée dans `ARCHITECTURE_RBAC.md`
2. Vérifier les exemples de code dans `PLAN_IMPLEMENTATION_RBAC_NESTJS.md`
3. Consulter la documentation NestJS/Prisma
4. Demander des clarifications sur les points bloquants

**Bon courage ! 💪**
