# Documentation RBAC Multi-Tenant - Index

> **Projet :** Attendee EMS Backend (NestJS)  
> **Dernière mise à jour :** Décembre 2024

---

## 📚 Navigation rapide

### 🚀 Pour démarrer

1. **[RESUME_MISE_A_JOUR_RBAC.md](./RESUME_MISE_A_JOUR_RBAC.md)** ⭐ COMMENCER ICI
   - Résumé de toutes les mises à jour
   - Ce qui a été fait vs ce qui reste à faire
   - Vue d'ensemble rapide

2. **[GETTING_STARTED_RBAC.md](./GETTING_STARTED_RBAC.md)** ⭐ ENSUITE
   - Guide de démarrage pratique
   - Prochaines étapes concrètes
   - Commandes à exécuter

---

### 📖 Documentation de référence

3. **[ARCHITECTURE_RBAC.md](./ARCHITECTURE_RBAC.md)** 📘 RÉFÉRENCE PRINCIPALE
   - Architecture complète du système RBAC
   - Brainstorming et vision
   - Modèle conceptuel (scopes, rôles, permissions)
   - Tables Prisma documentées
   - Invariants et règles métier
   - Architecture NestJS (Guards, Services, Modules)
   - **À lire pour comprendre le système dans sa globalité**

4. **[PLAN_IMPLEMENTATION_RBAC_NESTJS.md](./PLAN_IMPLEMENTATION_RBAC_NESTJS.md)** 🗺️ PLAN D'ACTION
   - Plan d'implémentation en 8 phases
   - Code examples NestJS pour chaque phase
   - Checklist complète
   - Estimation : 8-10 semaines
   - **À consulter avant de coder chaque phase**

5. **[NOTE_APPROCHE_PERMISSIONS.md](./NOTE_APPROCHE_PERMISSIONS.md)** 💡 DÉCISION ARCHITECTURE
   - Explication de l'approche choisie
   - Pourquoi `@Permissions()` au lieu de `@RequirePermission()`
   - Amélioration du `PermissionsGuard` existant
   - Migration progressive
   - **À lire pour comprendre nos choix techniques**

---

### 📄 Fichiers originaux (référence)

5. **[# Plan : Implémentation RBAC Multi-Tenan.prompt.md](./%23%20Plan%20%3A%20Impl%C3%A9mentation%20RBAC%20Multi-Tenan.prompt.md)**
   - Fichier original de ChatGPT (générique)
   - Non orienté NestJS
   - Conservé pour référence historique

---

## 🎯 Parcours recommandé

### Vous êtes nouveau sur le projet RBAC ?

```
1. RESUME_MISE_A_JOUR_RBAC.md (10 min)
   ↓
2. NOTE_APPROCHE_PERMISSIONS.md (15 min) 💡 IMPORTANT
   ↓
3. GETTING_STARTED_RBAC.md (20 min)
   ↓
4. ARCHITECTURE_RBAC.md (1h - lecture complète)
   ↓
5. PLAN_IMPLEMENTATION_RBAC_NESTJS.md Phase 1 (30 min)
   ↓
6. Commencer à coder Phase 1 ! 🚀
```

### Vous cherchez une info précise ?

| Besoin | Document | Section |
|--------|----------|---------|
| **Comprendre les scopes** | ARCHITECTURE_RBAC.md | 2. Modèle conceptuel → 2.1 Axes principaux |
| **Voir les tables Prisma** | ARCHITECTURE_RBAC.md | 3. Tables RBAC & Plans |
| **Comprendre le flow NestJS** | ARCHITECTURE_RBAC.md | Architecture NestJS → Flow d'autorisation |
| **Code example AuthorizationService** | PLAN_IMPLEMENTATION_RBAC_NESTJS.md | Phase 3 |
| **Code example PermissionRegistry** | PLAN_IMPLEMENTATION_RBAC_NESTJS.md | Phase 2 |
| **Gating par plan/module** | PLAN_IMPLEMENTATION_RBAC_NESTJS.md | Phase 4 |
| **Multi-org & JWT** | PLAN_IMPLEMENTATION_RBAC_NESTJS.md | Phase 5 |
| **Propagation automatique** | PLAN_IMPLEMENTATION_RBAC_NESTJS.md | Phase 6 |
| **Migrer un module** | PLAN_IMPLEMENTATION_RBAC_NESTJS.md | Phase 7 |
| **Frontend integration** | PLAN_IMPLEMENTATION_RBAC_NESTJS.md | Phase 8 |
| **Démarrer Phase 1** | GETTING_STARTED_RBAC.md | Démarrer Phase 1 |
| **Questions à se poser** | GETTING_STARTED_RBAC.md | Questions à se poser |
| **Commandes utiles** | GETTING_STARTED_RBAC.md | Ressources → Commandes |

---

## 📊 Roadmap

### Phase 0 : Documentation ✅ COMPLÉTÉE
- ✅ ARCHITECTURE_RBAC.md mis à jour
- ✅ PLAN_IMPLEMENTATION_RBAC_NESTJS.md créé
- ✅ GETTING_STARTED_RBAC.md créé
- ✅ RESUME_MISE_A_JOUR_RBAC.md créé
- ✅ INDEX_RBAC.md créé

### Phase 1 : Modèle de données ⬜ SUIVANTE
- ⬜ Migrer roles.seeder.ts
- ⬜ Compléter permissions.seeder.ts
- ⬜ Créer plans.seeder.ts
- ⬜ Tester seeders

### Phase 2-8 : Implémentation ⬜ À VENIR
- Voir [PLAN_IMPLEMENTATION_RBAC_NESTJS.md](./PLAN_IMPLEMENTATION_RBAC_NESTJS.md)

---

## 🔑 Concepts clés

### RBAC (Role-Based Access Control)
Système d'autorisation basé sur les rôles, avec :
- **Rôles** : Admin, Manager, Staff, etc.
- **Permissions** : event.read, attendee.create, etc.
- **Scopes** : own, assigned, team, any

### Multi-tenant
Un utilisateur peut appartenir à plusieurs organisations avec des rôles différents dans chacune.

### Gating par module
Les fonctionnalités (modules) sont activées/désactivées selon le plan de l'organisation.

### Propagation
Mise à jour automatique des permissions pour les rôles managés, sans toucher aux rôles custom.

---

## 🛠️ Stack technique

- **Framework** : NestJS 10+
- **ORM** : Prisma
- **Database** : PostgreSQL
- **Auth** : JWT
- **Authorization** : CASL + Custom (scopes)
- **Cache** : Redis (optionnel)

---

## 📞 Aide & Support

### Documentation externe
- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs)
- [CASL Docs](https://casl.js.org/)

### Fichiers du projet
- `prisma/schema.prisma` - Schema complet
- `src/common/guards/` - Guards NestJS
- `src/rbac/` - Services RBAC
- `prisma/seeders/` - Seeders

---

## ✅ Checklist rapide

Avant de commencer à coder :

- [ ] J'ai lu RESUME_MISE_A_JOUR_RBAC.md
- [ ] J'ai lu GETTING_STARTED_RBAC.md
- [ ] J'ai parcouru ARCHITECTURE_RBAC.md
- [ ] J'ai lu la Phase 1 du PLAN_IMPLEMENTATION_RBAC_NESTJS.md
- [ ] J'ai compris le flow d'autorisation NestJS
- [ ] J'ai compris la différence entre scopes tenant et plateforme
- [ ] J'ai identifié les fichiers à modifier en Phase 1
- [ ] J'ai créé une branche Git `feature/rbac-phase1`
- [ ] Je suis prêt à coder ! 🚀

---

**Navigation :**  
[📚 Retour au README principal](../README.md) | [🚀 Démarrer Phase 1](./GETTING_STARTED_RBAC.md#-démarrer-phase-1-maintenant)
