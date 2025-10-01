# Seeders Modulaires

Cette structure de seeders modulaires permet une meilleure organisation et maintenabilité du code de seeding.

## Structure

```
prisma/seeders/
├── README.md                    # Ce fichier
├── index.ts                     # Orchestrateur principal
├── utils.ts                     # Utilitaires partagés
├── organizations.seeder.ts      # Seeder pour les organisations
├── roles.seeder.ts             # Seeder pour les rôles
├── permissions.seeder.ts       # Seeder pour les permissions
└── users.seeder.ts             # Seeder pour les utilisateurs
```

## Utilisation

### Exécuter tous les seeders
```bash
npm run seed
# ou
npx prisma db seed
```

### Exécuter un seeder spécifique
Vous pouvez importer et exécuter des seeders individuels :

```typescript
import { seedOrganizations } from './prisma/seeders/organizations.seeder';
import { getOrganizationBySlug } from './prisma/seeders/organizations.seeder';

// Seeder seulement les organisations
const results = await seedOrganizations();

// Obtenir une organisation spécifique
const org = await getOrganizationBySlug('acme-corp');
```

## Avantages de cette approche

1. **Séparation des responsabilités** : Chaque seeder s'occupe d'une seule entité
2. **Réutilisabilité** : Les fonctions utilitaires peuvent être réutilisées
3. **Maintenabilité** : Plus facile de modifier les données d'une table spécifique
4. **Testabilité** : Chaque seeder peut être testé individuellement
5. **Flexibilité** : Possibilité d'exécuter des seeders partiels
6. **Organisation** : Code mieux structuré et plus lisible

## Ajouter un nouveau seeder

1. Créer un nouveau fichier `[entity].seeder.ts`
2. Implémenter les fonctions de seeding suivant le pattern existant
3. Ajouter l'import et l'appel dans `index.ts`
4. Documenter les nouvelles fonctions

## Pattern des seeders

Chaque seeder suit ce pattern :

```typescript
// Interface pour les données de seed
export interface EntitySeedData {
  // propriétés de l'entité
}

// Données par défaut
const entitiesData: EntitySeedData[] = [
  // données de démo
];

// Fonction principale de seeding
export async function seedEntities(orgId?: string): Promise<SeedResult[]> {
  // logique de seeding
}

// Fonctions utilitaires pour récupérer les entités
export async function getEntityById(id: string) {
  // logique de récupération
}
```

## Configuration

Les données de démo sont définies dans chaque seeder. Pour modifier les données :

1. Éditer les constantes `*Data` dans chaque seeder
2. Relancer le seed : `npm run seed`

## Dépendances

- `@prisma/client` : Client Prisma
- `bcrypt` : Pour le hachage des mots de passe
- `uuid` : Pour la génération d'IDs uniques
