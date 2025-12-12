# Index de la documentation RBAC Avancé

Cette page centralise toute la documentation du système RBAC multi-tenant avancé avec Guards séparés.

---

## 📖 Documents principaux

### 1. **Architecture & Vision** 
**Fichier :** `ARCHITECTURE_RBAC.md`  
**Quand le lire :** En premier, pour comprendre la vision globale  
**Contenu :**
- Brainstorming et objectifs
- Modèle conceptuel (types de rôles, scopes, plans/modules)
- Tables RBAC & Plans
- Invariants importants
- **Architecture des Guards NestJS** (Pipeline, Décorateurs, Services)
- **PermissionRegistry** : Source de vérité TypeScript
- DBML complet

**🎯 Lire en 30 minutes**

---

### 2. **Plan d'implémentation détaillé**
**Fichier :** `PLAN_IMPLEMENTATION_RBAC_AVANCE.md`  
**Quand le lire :** Après l'architecture, avant de coder  
**Contenu :**
- **Décision architecturale** : Pourquoi Guards séparés + `@RequirePermission()`
- **9 phases détaillées** avec code complet :
  - Phase 0 : Architecture (2-3j)
  - Phase 1 : Modèle de données (3-5j)
  - Phase 2 : PermissionRegistry (5-7j)
  - Phase 3 : Services d'autorisation (7-10j)
  - Phase 4 : Guards NestJS (5-7j)
  - Phase 5 : Module pilote Events (3-4j)
  - Phase 6 : Propagation rôles (4-5j)
  - Phase 7 : Multi-org (10-15j) ⚠️ BREAKING
  - Phase 8 : Gating modules (4-6j)
  - Phase 9 : Frontend (10-12j)
- Checklists de validation par phase
- Estimation : **8-10 semaines**

**🎯 Lire en 45 minutes**

---

### 3. **Guide de démarrage rapide**
**Fichier :** `GETTING_STARTED_RBAC_AVANCE.md`  
**Quand le lire :** Quand vous êtes prêt à coder  
**Contenu :**
- Prérequis
- **Phase 1 détaillée** : Modèle de données (étape par étape)
- **Phase 2 détaillée** : PermissionRegistry (code complet)
- **Phase 3 détaillée** : Services (code complet)
- Phases 4-5 : Guides rapides
- Scripts de test
- Checklists par phase

**🎯 Lire en 20 minutes, puis suivre étape par étape**

---

## 🗂️ Documents secondaires

### 4. **Plan d'origine (ChatGPT)**
**Fichier :** `# Plan : Implémentation RBAC Multi-Tenan.prompt.md`  
**Statut :** Référence historique  
**Contenu :** Plan générique adapté pour NestJS  
⚠️ **Ne plus utiliser** - Remplacé par `PLAN_IMPLEMENTATION_RBAC_AVANCE.md`

---

### 5. **Décision architecturale : Pas de CASL**
**Fichier :** `DECISION_NO_CASL.md`  
**Contenu :**
- Pourquoi CASL n'est PAS utilisé dans le nouveau système
- Architecture 100% custom avec scopes réels
- Plan de migration et suppression de CASL
- Comparaison avant/après

**🎯 Important à lire si vous vous demandez pourquoi on n'utilise pas CASL**

---

### 6. **Autres docs RBAC existantes**
- `RBAC_GUIDE.md` : Guide utilisateur/développeur (à mettre à jour)
- `RBAC_SYSTEM_UPDATED.md` : Changelog du système RBAC
- `ROLE_HIERARCHY.md` : Hiérarchie des rôles
- `ROLE_HIERARCHY_FIX.md` : Corrections de la hiérarchie
- `ROLE_HIERARCHY_COMPLETE.md` : Hiérarchie complète

---

## 🎓 Parcours de lecture recommandé

### Pour les nouveaux développeurs

1. **Jour 1 matin** : Lire `ARCHITECTURE_RBAC.md` (30 min)
2. **Jour 1 après-midi** : Lire `PLAN_IMPLEMENTATION_RBAC_AVANCE.md` (45 min)
3. **Jour 2** : Lire `GETTING_STARTED_RBAC_AVANCE.md` et commencer Phase 1 (full day)

### Pour les développeurs expérimentés

1. Lire rapidement `ARCHITECTURE_RBAC.md` - Sections 5 & 6 (Guards + PermissionRegistry)
2. Aller directement à `GETTING_STARTED_RBAC_AVANCE.md`
3. Commencer Phase 1

### Pour les architectes / tech leads

1. Lire `ARCHITECTURE_RBAC.md` - Complet
2. Lire `PLAN_IMPLEMENTATION_RBAC_AVANCE.md` - Décision architecturale + Phases
3. Valider l'approche avec l'équipe

---

## 🔧 Scripts utiles

```bash
# Synchroniser les permissions depuis le Registry
npm run permissions:sync

# Synchroniser les rôles pour toutes les orgs
npm run roles:sync

# Tester l'autorisation
ts-node scripts/test-authorization.ts

# Lancer les seeders
npm run seed

# Migrer la base de données
npx prisma migrate dev
```

---

## 📊 État d'avancement

| Phase | Statut | Durée estimée |
|-------|--------|---------------|
| Phase 0 - Architecture | ✅ Terminée | 2-3j |
| Phase 1 - Modèle BDD | 🔄 En cours | 3-5j |
| Phase 2 - PermissionRegistry | ⏳ À faire | 5-7j |
| Phase 3 - Services | ⏳ À faire | 7-10j |
| Phase 4 - Guards | ⏳ À faire | 5-7j |
| Phase 5 - Module pilote | ⏳ À faire | 3-4j |
| Phase 6 - Propagation | ⏳ À faire | 4-5j |
| Phase 7 - Multi-org | ⏳ À faire | 10-15j |
| Phase 8 - Gating | ⏳ À faire | 4-6j |
| Phase 9 - Frontend | ⏳ À faire | 10-12j |

---

## 🆘 Support

- **Questions d'architecture :** Consulter `ARCHITECTURE_RBAC.md`
- **Questions d'implémentation :** Consulter `PLAN_IMPLEMENTATION_RBAC_AVANCE.md`
- **Problèmes pratiques :** Consulter `GETTING_STARTED_RBAC_AVANCE.md`
- **Code existant :** Voir `src/rbac/`, `src/common/guards/`, `prisma/schema.prisma`

---

## 🎯 Prochaines étapes

1. **Maintenant :** Lire les 3 documents principaux
2. **Ensuite :** Commencer Phase 1 (Modèle de données)
3. **Puis :** Progresser phase par phase

**Bon courage ! 🚀**
