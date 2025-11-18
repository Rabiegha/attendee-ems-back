# Soft Delete pour les Inscriptions - Backend

## Modifications apportées

### 1. Base de données (Prisma Schema)
- ✅ Ajout du champ `deleted_at` au modèle `Registration`
- ✅ Ajout d'un index sur `deleted_at` pour optimiser les requêtes
- ✅ Création de la migration `20251118_add_deleted_at_to_registrations`

### 2. DTO (list-registrations.dto.ts)
- ✅ Ajout du paramètre `isActive?: boolean` avec transformation automatique (string → boolean)
- ✅ Documentation Swagger pour le nouveau paramètre

### 3. Service (registrations.service.ts)

#### Modification de `findAll()`
- ✅ Ajout du filtre `deleted_at` basé sur le paramètre `isActive`
  - `isActive: true` → `deleted_at: null` (inscriptions actives)
  - `isActive: false` → `deleted_at: { not: null }` (inscriptions supprimées)

#### Modification de `remove()`
- ✅ Transformé en **soft delete** : met à jour `deleted_at` au lieu de supprimer
- ✅ Conserve la vérification des permissions et du scope

#### Nouvelle méthode `restore()`
- ✅ Restaure une inscription supprimée (met `deleted_at` à `null`)
- ✅ Vérifie que l'inscription est bien supprimée avant de restaurer
- ✅ Retourne l'inscription complète avec toutes les relations

#### Nouvelle méthode `permanentDelete()`
- ✅ Supprime définitivement une inscription de la base de données
- ✅ Ne peut supprimer que les inscriptions déjà soft-deleted
- ✅ Utilise le vrai `DELETE` SQL

### 4. Controller (registrations.controller.ts)

#### Route existante modifiée
- `DELETE /registrations/:id` → Soft delete (commentaire mis à jour)

#### Nouvelles routes
- ✅ `POST /registrations/:id/restore` → Restaurer une inscription
- ✅ `DELETE /registrations/:id/permanent` → Supprimer définitivement

Toutes les routes respectent les permissions `registrations.delete` et le scope organisation.

## Migration de la base de données

Pour appliquer la migration, lancer Docker puis exécuter :

```bash
cd attendee-ems-back
npx prisma migrate deploy
# ou
npx prisma migrate dev
```

Ou appliquer manuellement le SQL :

```sql
ALTER TABLE "registrations" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "registrations_deleted_at_idx" ON "registrations"("deleted_at");
```

## Comportement

### Avant
- `DELETE /registrations/:id` → Suppression permanente immédiate

### Après
- `DELETE /registrations/:id` → Soft delete (inscription marquée comme supprimée)
- `POST /registrations/:id/restore` → Restauration d'une inscription supprimée
- `DELETE /registrations/:id/permanent` → Suppression définitive (seulement si déjà soft-deleted)

### Requêtes
- `GET /events/:id/registrations` → Par défaut, retourne les inscriptions actives
- `GET /events/:id/registrations?isActive=true` → Inscriptions actives
- `GET /events/:id/registrations?isActive=false` → Inscriptions supprimées

## Compatibilité

✅ Rétrocompatible : les inscriptions existantes ont `deleted_at = null` (actives)
✅ Les requêtes sans le paramètre `isActive` fonctionnent comme avant
✅ Aucune modification des autres endpoints nécessaire
