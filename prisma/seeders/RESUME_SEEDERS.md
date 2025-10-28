# 📋 Résumé - Seeders créés pour l'événement 8639f5cc-a4b5-4790-89a5-ffcb96f82c81

## ✅ Fichiers créés

### 1. **attendee-types.seeder.ts**
Crée 6 types de participants pour l'organisation :
- **VIP** (Or, capacité: 50)
- **SPEAKER** - Conférencier (Violet, capacité: 20)
- **SPONSOR** (Orange, capacité: 30)
- **PRESS** - Presse (Bleu, capacité: 25)
- **PARTICIPANT** (Vert, capacité: 500)
- **STAFF** (Gris, capacité: 40)

### 2. **event-attendee-types.seeder.ts**
Associe tous les types de participants à l'événement spécifique avec leurs capacités respectives.

### 3. **registrations.seeder.ts**
Crée 20 inscriptions pour l'événement avec :
- 20 participants variés (développeurs, managers, journalistes, etc.)
- Distribution des statuts : 80% approved, 10% awaiting, 5% refused, 5% cancelled
- Types de participation : onsite, online, hybrid (aléatoire)
- Répartition cyclique entre tous les types de participants

### 4. **seed-specific-event.ts**
Script orchestrateur qui exécute les 3 seeders dans le bon ordre.

### 5. **SEED_EVENT_GUIDE.md**
Guide complet d'utilisation avec exemples et dépannage.

## 🚀 Comment exécuter

### Méthode 1 : Via npm (Recommandé)
```bash
cd attendee-ems-back
npm run db:seed:event
```

### Méthode 2 : Via npx
```bash
cd attendee-ems-back
npx ts-node prisma/seeders/seed-specific-event.ts
```

### Méthode 3 : Avec Docker
```bash
docker-compose -f docker-compose.dev.yml exec api npm run db:seed:event
```

## 📊 Résultat attendu

Après exécution, vous aurez :
- ✅ 6 types de participants créés dans `attendee_types`
- ✅ 6 associations créées dans `event_attendee_types` pour l'événement
- ✅ 20 inscriptions créées dans `registrations`
- ✅ 20 participants créés dans `attendees` (si non existants)

## 🔍 Vérification

### Via Prisma Studio
```bash
npm run db:studio
```

### Via SQL
```sql
-- Compter les types associés à l'événement
SELECT COUNT(*) FROM event_attendee_types 
WHERE event_id = '8639f5cc-a4b5-4790-89a5-ffcb96f82c81';
-- Résultat attendu: 6

-- Compter les inscriptions
SELECT COUNT(*) FROM registrations 
WHERE event_id = '8639f5cc-a4b5-4790-89a5-ffcb96f82c81';
-- Résultat attendu: 20

-- Voir la répartition par type
SELECT at.name, COUNT(*) as count
FROM registrations r
JOIN event_attendee_types eat ON r.event_attendee_type_id = eat.id
JOIN attendee_types at ON eat.attendee_type_id = at.id
WHERE r.event_id = '8639f5cc-a4b5-4790-89a5-ffcb96f82c81'
GROUP BY at.name;
```

## 📝 Modifications apportées

### Fichiers modifiés
1. **prisma/seeders/index.ts** - Ajout des nouveaux seeders au flux principal
2. **prisma/seeders/exports.ts** - Export des nouvelles fonctions
3. **prisma/seeders/README.md** - Documentation mise à jour
4. **package.json** - Ajout du script `db:seed:event`

### Fichiers créés
1. `prisma/seeders/attendee-types.seeder.ts`
2. `prisma/seeders/event-attendee-types.seeder.ts`
3. `prisma/seeders/registrations.seeder.ts`
4. `prisma/seeders/seed-specific-event.ts`
5. `prisma/seeders/SEED_EVENT_GUIDE.md`
6. `prisma/seeders/RESUME_SEEDERS.md` (ce fichier)

## ⚠️ Prérequis

Avant d'exécuter le seed, assurez-vous que :
1. ✅ L'événement avec l'ID `8639f5cc-a4b5-4790-89a5-ffcb96f82c81` existe
2. ✅ L'organisation `acme-corp` existe
3. ✅ La base de données est accessible
4. ✅ Les migrations Prisma sont à jour

Si ces prérequis ne sont pas remplis, exécutez d'abord :
```bash
npm run db:seed  # Seed complet incluant organisations et événements
```

## 🎯 Utilisation dans le seed principal

Les nouveaux seeders sont automatiquement inclus dans le seed principal (`npm run db:seed`).
Ils s'exécutent dans cet ordre :
1. Organizations
2. Roles
3. Permissions
4. Users
5. **Attendee Types** ← Nouveau
6. Events
7. Attendees & Registrations (génériques)
8. **Event Attendee Types** ← Nouveau (pour événement spécifique)
9. **Registrations** ← Nouveau (pour événement spécifique)

## 💡 Personnalisation

Pour modifier les données, éditez les constantes dans les fichiers seeders :
- Types de participants : `attendee-types.seeder.ts` → `attendeeTypesData`
- Capacités par type : `event-attendee-types.seeder.ts` → section `switch`
- Participants : `registrations.seeder.ts` → `attendeesData`

## 📚 Documentation complète

Consultez `SEED_EVENT_GUIDE.md` pour :
- Guide détaillé d'utilisation
- Exemples de personnalisation
- Dépannage
- Requêtes SQL de vérification

## ✨ Fonctionnalités

- ✅ **Idempotent** : Peut être exécuté plusieurs fois sans créer de doublons
- ✅ **Modulaire** : Chaque seeder peut être utilisé indépendamment
- ✅ **Flexible** : Facile à personnaliser et étendre
- ✅ **Documenté** : Guide complet et exemples fournis
- ✅ **Intégré** : Fait partie du flux de seed principal
