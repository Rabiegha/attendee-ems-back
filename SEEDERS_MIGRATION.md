# Migration vers des Seeders Modulaires

## 🎯 Objectif

Refactorisation du système de seed Prisma monolithique vers une architecture modulaire pour améliorer la maintenabilité, la réutilisabilité et l'organisation du code.

## 📁 Nouvelle Structure

```
prisma/seeders/
├── README.md                    # Documentation détaillée
├── index.ts                     # Orchestrateur principal
├── utils.ts                     # Utilitaires partagés
├── organizations.seeder.ts      # Seeder pour les organisations
├── roles.seeder.ts             # Seeder pour les rôles
├── permissions.seeder.ts       # Seeder pour les permissions
├── users.seeder.ts             # Seeder pour les utilisateurs
├── examples.ts                 # Exemples d'utilisation
└── exports.ts                  # Exports centralisés

scripts/
└── seed-specific.ts            # Script pour seeders spécifiques
```

## 🚀 Utilisation

### Seed Complet
```bash
npm run db:seed
# ou
npx prisma db seed
```

### Seeders Spécifiques
```bash
# Organisations seulement
npm run db:seed:orgs

# Utilisateurs seulement
npm run db:seed:users

# Seed minimal (org + admin)
npm run db:seed:minimal

# Script personnalisé
ts-node scripts/seed-specific.ts [command] [param]
```

### Utilisation Programmatique
```typescript
import { 
  seedOrganizations, 
  seedUsers, 
  getOrganizationBySlug 
} from './prisma/seeders/exports';

// Seeder seulement les organisations
const orgResults = await seedOrganizations();

// Obtenir une organisation
const org = await getOrganizationBySlug('acme-corp');

// Seeder les utilisateurs pour une organisation
const userResults = await seedUsers(org.id);
```

## ✨ Avantages

### 1. **Séparation des Responsabilités**
- Chaque seeder gère une seule entité
- Code plus lisible et maintenable
- Facilite les modifications spécifiques

### 2. **Réutilisabilité**
- Fonctions exportées réutilisables
- Possibilité d'exécuter des seeders partiels
- Intégration facile dans les tests

### 3. **Flexibilité**
- Seed complet ou partiel selon les besoins
- Configuration par environnement
- Gestion d'erreurs granulaire

### 4. **Organisation**
- Structure claire et logique
- Documentation intégrée
- Exemples d'utilisation

## 🔧 Fonctionnalités

### Types et Interfaces
```typescript
interface SeedResult {
  success: boolean;
  message: string;
  data?: any;
}
```

### Utilitaires Partagés
- Client Prisma centralisé
- Fonctions de logging standardisées
- Gestion de la déconnexion

### Fonctions Utilitaires
- `getOrganizationBySlug(slug: string)`
- `getRoleByCode(orgId: string, code: string)`
- `getPermissionByCode(orgId: string, code: string)`
- `getUserByEmail(orgId: string, email: string)`

### Gestion d'Erreurs
- Résultats structurés avec `SeedResult`
- Logging détaillé des succès/échecs
- Continuation en cas d'erreur partielle

## 📊 Données de Démo

### Organisation
- **Nom**: Acme Corp
- **Slug**: acme-corp
- **Timezone**: UTC

### Rôles
- **org_admin**: Organization Administrator
- **user**: Standard User

### Permissions
- `users.*` (create, read, update, delete)
- `organizations.*` (read, update)
- `roles.read`
- `permissions.read`

### Utilisateurs
- **Admin**: admin@acme-corp.com / admin123
- **User**: user@acme-corp.com / user123

## 🔄 Migration depuis l'Ancien Système

L'ancien fichier `prisma/seed.ts` monolithique a été remplacé par un simple import vers la nouvelle structure modulaire :

```typescript
// Ancien: 180+ lignes de code mélangé
// Nouveau: Import vers la structure modulaire
import './seeders/index';
```

## 📝 Scripts Disponibles

```json
{
  "db:seed": "prisma db seed",
  "db:seed:orgs": "ts-node scripts/seed-specific.ts organizations",
  "db:seed:users": "ts-node scripts/seed-specific.ts users",
  "db:seed:minimal": "ts-node scripts/seed-specific.ts minimal"
}
```

## 🎯 Cas d'Usage

### Développement
- Seed complet pour environnement de dev
- Reset rapide avec données de test

### Tests
- Seeders spécifiques pour tests unitaires
- Données contrôlées et prévisibles

### Production
- Seed minimal pour déploiement initial
- Organisations spécifiques selon les besoins

## 📚 Documentation

Consultez `prisma/seeders/README.md` pour la documentation détaillée et `prisma/seeders/examples.ts` pour des exemples d'utilisation avancés.

---

Cette migration améliore significativement la maintenabilité et la flexibilité du système de seeding tout en conservant la compatibilité avec les commandes existantes.
