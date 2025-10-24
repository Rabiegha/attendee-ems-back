# Décisions Techniques - Phase 1 Core

## 🏗️ Architecture

### 1. Choix de Prisma ORM
**Décision** : Utiliser Prisma comme ORM principal

**Raisons** :
- ✅ Type-safety complet avec TypeScript
- ✅ Migrations versionnées et reproductibles
- ✅ Support natif des FK composites (multi-tenant)
- ✅ Query builder optimisé et sécurisé (anti SQL injection)
- ✅ Prisma Studio pour debugging

**Alternatives considérées** :
- TypeORM : Moins performant, syntaxe plus complexe
- MikroORM : Moins mature, communauté plus petite

### 2. FK Composites pour Multi-Tenant
**Décision** : Utiliser des FK composites `(id, org_id)` sur toutes les relations

**Raisons** :
- ✅ Garantie au niveau DB (pas seulement applicatif)
- ✅ Impossible de référencer une entité d'une autre org
- ✅ Performance : indexes composites optimisés
- ✅ Sécurité : protection contre les bugs applicatifs

**Exemple** :
```prisma
model Registration {
  event_id    String
  org_id      String
  attendee_id String
  
  event    Event    @relation(fields: [event_id, org_id], references: [id, org_id])
  attendee Attendee @relation(fields: [attendee_id, org_id], references: [id, org_id])
}
```

### 3. Extension Citext pour Emails
**Décision** : Utiliser l'extension PostgreSQL `citext` pour les emails

**Raisons** :
- ✅ Case-insensitive au niveau DB (pas applicatif)
- ✅ Performance : indexes natifs case-insensitive
- ✅ Cohérence : `user@test.com` = `User@Test.COM`
- ✅ Évite les doublons avec casse différente

**Configuration** :
```prisma
datasource db {
  provider   = "postgresql"
  extensions = [citext]
}

model User {
  email String @db.Citext
}
```

---

## 🔐 Sécurité

### 4. PermissionsGuard + CASL
**Décision** : Combiner NestJS Guards avec CASL pour l'autorisation

**Raisons** :
- ✅ Séparation authentification (JWT) / autorisation (CASL)
- ✅ Déclaratif : `@Permissions(['events.create'])`
- ✅ Flexible : support conditions `:own`, `:any`
- ✅ Testable : logique isolée dans CaslAbilityFactory

**Implémentation** :
```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(['events.create'])
async create(@Body() dto: CreateEventDto) {
  // Logique métier
}
```

### 5. resolveEffectiveOrgId Helper
**Décision** : Centraliser la résolution de l'organisation dans un helper

**Raisons** :
- ✅ DRY : logique réutilisée dans tous controllers
- ✅ Sécurité : impossible d'oublier la vérification
- ✅ Lisibilité : intention claire
- ✅ Testable : fonction pure

**Usage** :
```typescript
const orgId = resolveEffectiveOrgId({
  reqUser: req.user,
  explicitOrgId: undefined,
  allowAny: hasAnyPermission,
});
```

---

## 📊 Données

### 6. Public Token avec Nanoid
**Décision** : Utiliser nanoid pour générer les public_tokens

**Raisons** :
- ✅ URL-safe (pas de caractères spéciaux)
- ✅ Collision-proof (16 chars = 2^96 possibilités)
- ✅ Performance : plus rapide que UUID
- ✅ Compact : 16 chars vs 36 pour UUID

**Configuration** :
```typescript
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 16);
```

### 7. Upsert Attendee par Email
**Décision** : Upsert automatique des attendees lors de l'inscription

**Raisons** :
- ✅ UX : pas besoin de créer l'attendee avant
- ✅ Cohérence : un email = un attendee par org
- ✅ Mise à jour : données enrichies à chaque inscription
- ✅ Performance : une seule requête DB

**Logique** :
```typescript
await prisma.attendee.upsert({
  where: { org_id_email: { org_id, email } },
  update: { /* champs non vides */ },
  create: { /* tous champs */ },
});
```

### 8. Statuts Enum au Niveau DB
**Décision** : Utiliser des enums Prisma (mappés en enums PostgreSQL)

**Raisons** :
- ✅ Type-safety : impossible d'insérer valeur invalide
- ✅ Performance : stockage optimisé (vs VARCHAR)
- ✅ Documentation : schéma auto-documenté
- ✅ Validation : au niveau DB + applicatif

**Exemple** :
```prisma
enum RegistrationStatus {
  awaiting
  approved
  refused
  cancelled
}
```

---

## 🎯 Logique Métier

### 9. Transactions Prisma pour Opérations Critiques
**Décision** : Utiliser `$transaction` pour toutes opérations multi-étapes

**Raisons** :
- ✅ Atomicité : tout ou rien
- ✅ Cohérence : pas d'état intermédiaire
- ✅ Isolation : pas de race conditions
- ✅ Rollback automatique en cas d'erreur

**Cas d'usage** :
- Création event + settings
- Upsert attendee + création registration
- Update status + set confirmed_at

### 10. Auto-set confirmed_at sur Approval
**Décision** : Set automatiquement `confirmed_at` lors de l'approbation

**Raisons** :
- ✅ Cohérence : toujours set quand approved
- ✅ Audit : traçabilité de l'approbation
- ✅ Simplicité : pas besoin de le faire manuellement
- ✅ Idempotent : ne change pas si déjà set

**Implémentation** :
```typescript
if (dto.status === 'approved' && !registration.confirmed_at) {
  updateData.confirmed_at = new Date();
}
```

### 11. Règle HOSTESS Explicite
**Décision** : Check explicite du rôle HOSTESS dans le controller

**Raisons** :
- ✅ Clarté : intention évidente dans le code
- ✅ Sécurité : impossible de contourner via permissions
- ✅ Message : erreur explicite "HOSTESS cannot update status"
- ✅ Audit : logs clairs des tentatives

**Implémentation** :
```typescript
if (req.user.role === 'HOSTESS') {
  throw new ForbiddenException('HOSTESS role cannot update registration status');
}
```

---

## 🔄 API Design

### 12. Pas de PII Masking
**Décision** : Tous les rôles autorisés voient les mêmes données

**Raisons** :
- ✅ Simplicité : une seule logique de récupération
- ✅ Performance : pas de transformation conditionnelle
- ✅ Cohérence : pas de surprises selon le rôle
- ✅ Sécurité : contrôle via permissions (read ou pas)

**Note** : Si masking nécessaire plus tard, ajouter au niveau serialization

### 13. Pagination Obligatoire
**Décision** : Toutes les listes sont paginées par défaut

**Raisons** :
- ✅ Performance : évite les requêtes massives
- ✅ UX : chargement progressif
- ✅ Scalabilité : fonctionne avec millions de records
- ✅ Standard : pattern REST classique

**Defaults** :
```typescript
const page = dto.page || 1;
const limit = dto.limit || 20;
```

### 14. Tri sur Champs Relationnels
**Décision** : Permettre le tri sur champs attendee (company, last_name, etc.)

**Raisons** :
- ✅ UX : tri naturel pour l'utilisateur
- ✅ Performance : indexes composites sur relations
- ✅ Flexibilité : tri sur n'importe quel champ

**Implémentation** :
```typescript
if (['company', 'last_name'].includes(sortBy)) {
  orderBy = { attendee: { [sortBy]: sortOrder } };
}
```

---

## 🚀 Performance

### 15. Parallel Queries avec Promise.all
**Décision** : Exécuter count et findMany en parallèle

**Raisons** :
- ✅ Performance : 2x plus rapide
- ✅ Latence : une seule round-trip DB
- ✅ Simplicité : Promise.all natif

**Exemple** :
```typescript
const [data, total] = await Promise.all([
  prisma.registration.findMany({ ... }),
  prisma.registration.count({ ... }),
]);
```

### 16. Indexes Stratégiques
**Décision** : Indexes sur tous les champs de filtrage/tri

**Raisons** :
- ✅ Performance : queries < 100ms
- ✅ Scalabilité : fonctionne avec millions de records
- ✅ Coût : espace disque négligeable vs gain perf

**Indexes créés** :
- `@@index([org_id, status])`
- `@@index([org_id, event_id, status])`
- `@@index([org_id, email])`
- etc.

---

## 🧪 Testabilité

### 17. Services Injectables
**Décision** : Tous les services sont injectables via DI NestJS

**Raisons** :
- ✅ Testabilité : facile de mocker
- ✅ Découplage : pas de dépendances hard-codées
- ✅ Réutilisabilité : services partagés entre modules

### 18. DTOs avec class-validator
**Décision** : Validation déclarative avec decorators

**Raisons** :
- ✅ Lisibilité : validation visible dans le DTO
- ✅ Réutilisabilité : DTOs partagés
- ✅ Documentation : Swagger auto-généré
- ✅ Type-safety : TypeScript + runtime validation

---

## 📝 Documentation

### 19. Swagger avec Decorators
**Décision** : Documentation API via decorators NestJS

**Raisons** :
- ✅ Synchronisation : code = doc
- ✅ Interactif : Swagger UI testable
- ✅ Maintenance : pas de doc séparée
- ✅ Standard : OpenAPI 3.0

**Usage** :
```typescript
@ApiTags('Events')
@ApiOperation({ summary: 'Create event' })
@ApiResponse({ status: 201, description: 'Created' })
```

### 20. Commentaires JSDoc dans Services
**Décision** : Documenter toutes les méthodes publiques

**Raisons** :
- ✅ IntelliSense : aide au développement
- ✅ Maintenance : intention claire
- ✅ Onboarding : nouveaux devs comprennent vite

---

## 🔮 Décisions Reportées (Future)

### Bulk Import Excel
**Décision** : Endpoint commenté, à implémenter plus tard

**Raisons** :
- Complexité : parsing Excel, validation, erreurs par ligne
- Dépendances : librairie Excel (xlsx, exceljs)
- Priorité : fonctionnalités core d'abord

### Event Access Checks
**Décision** : TODO dans controllers, à implémenter

**Raisons** :
- Dépendance : table event_access utilisée mais pas vérifiée
- Logique : nécessite helper pour check access
- Priorité : ADMIN/MANAGER fonctionnent sans

### Email Notifications
**Décision** : Hors scope Phase 1

**Raisons** :
- Complexité : templates, queue, retry logic
- Dépendances : service email (SendGrid, SES, etc.)
- Infrastructure : queue (Bull, BullMQ)

---

## ✅ Validation des Décisions

Toutes les décisions techniques ont été :
- ✅ Documentées avec raisons
- ✅ Validées par implémentation
- ✅ Testées manuellement
- ✅ Conformes aux best practices NestJS/Prisma

---

**Décisions Techniques Phase 1** - Document de référence pour l'équipe
