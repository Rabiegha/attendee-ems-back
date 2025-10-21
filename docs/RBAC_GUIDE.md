# 🛡️ Guide RBAC & Permissions - EMS

## 🎯 Vue d'ensemble du système RBAC

EMS utilise un système RBAC (Role-Based Access Control) avancé basé sur **CASL** pour la gestion granulaire des permissions avec support multi-tenant.

### Architecture RBAC
```
Utilisateur → Rôle → Permissions → Actions sur Ressources
    ↓         ↓         ↓              ↓
  John    ADMIN    [manage.User]   Peut gérer utilisateurs
  Jane    VIEWER   [read.Event]    Peut voir événements
```

## 👥 Rôles Hiérarchiques

### 🔴 SUPER_ADMIN
**Accès**: Global omniscient
```typescript
permissions: [
  { action: 'manage', subject: 'all' }, // Accès total système
]
```
**Capacités**:
- ✅ Accès à toutes les organisations
- ✅ Gestion globale du système
- ✅ Création/suppression organisations
- ✅ Promotion/rétrogradation utilisateurs

### 🟠 ADMIN
**Accès**: Gestion complète organisation
```typescript
permissions: [
  { action: 'manage', subject: 'Organization', conditions: { id: orgId } },
  { action: 'manage', subject: 'User', conditions: { orgId } },
  { action: 'manage', subject: 'Event', conditions: { orgId } },
  { action: 'manage', subject: 'Invitation', conditions: { orgId } },
  { action: 'manage', subject: 'Role', conditions: { orgId } },
]
```
**Capacités**:
- ✅ Gestion utilisateurs organisation
- ✅ Création/modification événements
- ✅ Envoi invitations
- ✅ Attribution rôles
- ✅ Configuration organisation

### 🟡 MANAGER
**Accès**: Gestion événements
```typescript
permissions: [
  { action: 'read', subject: 'Organization', conditions: { id: orgId } },
  { action: 'manage', subject: 'Event', conditions: { orgId } },
  { action: 'manage', subject: 'Attendee', conditions: { orgId } },
  { action: 'assign', subject: 'User', conditions: { orgId } },
]
```
**Capacités**:
- ✅ Création/modification événements
- ✅ Gestion participants
- ✅ Assignment partenaires aux événements
- ❌ Création utilisateurs

### 🔵 VIEWER
**Accès**: Lecture seule organisation
```typescript
permissions: [
  { action: 'read', subject: 'Organization', conditions: { id: orgId } },
  { action: 'read', subject: 'Event', conditions: { orgId } },
  { action: 'read', subject: 'Attendee', conditions: { orgId } },
]
```
**Capacités**:
- ✅ Consultation événements organisation
- ✅ Consultation participants
- ✅ Export données (lecture)
- ❌ Modification/suppression

### 🟣 PARTNER
**Accès**: Événements assignés uniquement
```typescript
permissions: [
  { action: 'read', subject: 'Event', conditions: { id: assignedEventIds } },
  { action: 'read', subject: 'Attendee', conditions: { eventId: assignedEventIds } },
]
```
**Capacités**:
- ✅ Consultation événements assignés
- ✅ Consultation participants de ses événements
- ❌ Accès autres événements organisation

### 🟢 HOSTESS
**Accès**: Check-in et scan QR codes
```typescript
permissions: [
  { action: 'read', subject: 'Event', conditions: { id: assignedEventIds } },
  { action: 'checkin', subject: 'Attendee', conditions: { eventId: assignedEventIds } },
  { action: 'scan', subject: 'QRCode', conditions: { eventId: assignedEventIds } },
]
```
**Capacités**:
- ✅ Check-in participants
- ✅ Scan QR codes entrée
- ✅ Consultation liste participants
- ❌ Modification données participants

## 🔧 Implémentation Technique

### Configuration CASL Factory
```typescript
// rbac/casl-ability.factory.ts
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: UserWithPermissions): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

    // Attribution permissions selon le rôle
    user.permissions.forEach((permission: string) => {
      const ability = this.parsePermissionToAbility(permission)
      if (ability) {
        can(ability.action, ability.subject, ability.conditions)
      }
    })

    // Règles spéciales pour SUPER_ADMIN
    if (user.role === 'SUPER_ADMIN') {
      can('manage', 'all')
    }

    return build()
  }
}
```

### Types TypeScript
```typescript
// Types pour actions et sujets
export type Action = 
  | 'create' | 'read' | 'update' | 'delete' | 'manage'
  | 'assign' | 'checkin' | 'scan' | 'export'

export type Subjects = 
  | 'User' | 'Event' | 'Organization' | 'Attendee' 
  | 'Role' | 'Permission' | 'Invitation' | 'QRCode'
  | 'all'

export type AppAbility = Ability<[Action, Subjects]>

// Conditions contextuelles
export interface PermissionConditions {
  orgId?: string
  eventIds?: string[]
  userId?: string
}
```

## 🎨 Utilisation dans les Composants

### Guards Déclaratifs
```tsx
import { Can } from '@/shared/acl'

// Protection simple
<Can do="create" on="Event">
  <Button>Créer un événement</Button>
</Can>

// Protection avec conditions
<Can do="update" on="Event" data={event}>
  <Button>Modifier</Button>
</Can>

// Protection négative
<Can not do="delete" on="User">
  <span>Suppression interdite</span>
</Can>
```

### Hooks Programmatiques
```tsx
import { useCan } from '@/shared/acl'

const EventActions = ({ event }) => {
  const canUpdate = useCan('update', 'Event', event)
  const canDelete = useCan('delete', 'Event', event)
  const canAssignUsers = useCan('assign', 'User')

  return (
    <div>
      {canUpdate && <EditButton />}
      {canDelete && <DeleteButton />}
      {canAssignUsers && <AssignUserButton />}
    </div>
  )
}
```

### Guards sur Routes
```tsx
import { GuardedRoute } from '@/shared/acl/guards'

// Protection de pages complètes
<GuardedRoute action="manage" subject="User">
  <UsersPage />
</GuardedRoute>

// Avec redirection personnalisée
<GuardedRoute 
  action="read" 
  subject="Event" 
  fallback={<ForbiddenPage />}
>
  <EventDetails />
</GuardedRoute>
```

## 🔍 Matrice de Permissions Détaillée

### Actions Utilisateurs
| Action | SUPER_ADMIN | ADMIN | MANAGER | VIEWER | PARTNER | HOSTESS |
|--------|-------------|--------|---------|---------|---------|---------|
| **Création utilisateur** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Modification utilisateur** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Suppression utilisateur** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Consultation utilisateurs** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Assignment rôles** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Actions Événements
| Action | SUPER_ADMIN | ADMIN | MANAGER | VIEWER | PARTNER | HOSTESS |
|--------|-------------|--------|---------|---------|---------|---------|
| **Création événement** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Modification événement** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Suppression événement** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Consultation tous événements** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Consultation événements assignés** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Actions Participants
| Action | SUPER_ADMIN | ADMIN | MANAGER | VIEWER | PARTNER | HOSTESS |
|--------|-------------|--------|---------|---------|---------|---------|
| **Ajout participant** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Modification participant** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Check-in participant** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Export données** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Scan QR codes** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |

## 🛠️ Configuration Permissions Backend

### Modèle Base de Données
```sql
-- Table des rôles
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

-- Table des permissions
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

-- Table d'association rôles-permissions
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id),
  permission_id UUID REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);
```

### Seeders Permissions
```typescript
// Permissions par rôle
const rolePermissions = {
  SUPER_ADMIN: [
    'organizations.manage',
    'users.manage',
    'events.manage',
    'attendees.manage'
  ],
  ADMIN: [
    'organizations.read:own',
    'users.manage:org',
    'events.manage:org',
    'invitations.manage:org'
  ],
  MANAGER: [
    'organizations.read:own',
    'events.manage:org',
    'attendees.manage:org',
    'users.assign:org'
  ],
  // ... autres rôles
}
```

## 🎯 Cas d'Usage Avancés

### 1. Permissions Contextuelles
```tsx
// Utilisateur peut modifier seulement ses propres événements
<Can do="update" on="Event" data={{ createdBy: event.createdBy }}>
  <EditButton />
</Can>

// Partner peut voir seulement événements assignés
const EventList = () => {
  const events = useGetEventsQuery({
    filters: user.role === 'PARTNER' ? { assignedTo: user.id } : {}
  })
}
```

### 2. Permissions Dynamiques
```tsx
// Permissions changent selon l'état de l'événement
const getEventPermissions = (event: Event, user: User) => {
  if (event.status === 'DRAFT') {
    return ['update', 'delete']
  } else if (event.status === 'LIVE') {
    return ['read', 'checkin']
  }
  return ['read']
}
```

### 3. Permissions Temporaires
```typescript
// Accès temporaire pour un événement spécifique
interface TemporaryPermission {
  userId: string
  eventId: string
  permissions: Action[]
  expiresAt: Date
}

// Utilisation dans les guards
const hasTemporaryAccess = checkTemporaryPermission(user.id, event.id, 'manage')
```

## 🔒 Sécurité et Validation

### Validation Côté Serveur
```typescript
// Guard NestJS pour protection API
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(['events.manage'])
@Post('events')
async createEvent(@Body() eventData: CreateEventDto) {
  // Vérification automatique des permissions
}
```

### Audit et Logging
```typescript
// Audit trail des actions
interface AuditLog {
  userId: string
  action: string
  resource: string
  resourceId: string
  timestamp: Date
  success: boolean
  metadata?: Record<string, any>
}

// Logging automatique des actions sensibles
@LogAction('user.create')
async createUser(userData: CreateUserDto) {
  // Action loggée automatiquement
}
```

## 🚀 Évolutions Futures

### Rôles Personnalisés
```typescript
// Interface pour rôles créés par les ADMIN
interface CustomRole {
  id: string
  name: string
  orgId: string
  basedOnRole: UserRole // Template de base
  customPermissions: Permission[]
  isActive: boolean
}

// Page de gestion des rôles (future)
const RoleManagementPage = () => (
  <Can do="manage" on="Role">
    <CreateCustomRoleForm />
    <RolePermissionsMatrix />
  </Can>
)
```

### Permissions Granulaires
```typescript
// Permissions sur champs spécifiques
interface FieldPermission {
  field: string
  action: 'read' | 'write'
  conditions?: Record<string, any>
}

// Exemple: PARTNER peut lire email mais pas modifier
const permissions = {
  'attendee.email': ['read'],
  'attendee.phone': ['read', 'write'],
}
```

## 📊 Monitoring et Métriques

### Tableau de Bord Permissions
- Nombre d'utilisateurs par rôle
- Actions les plus utilisées
- Tentatives d'accès refusées
- Permissions temporaires actives

### Alertes Sécurité
- Tentatives d'escalade de privilèges
- Accès inhabituels aux ressources
- Modifications de permissions critiques
- Sessions suspectes

---

**Ce guide RBAC assure une sécurité granulaire et évolutive pour votre système EMS** 🛡️

**Dernière mise à jour**: Octobre 2025  
**Maintenu par**: Équipe Sécurité EMS