# Architecture Visuelle - Multi-tenant Model

## Vue d'ensemble du Modèle de Données

```mermaid
erDiagram
    User ||--o{ OrgUser : "membre de N orgs"
    User ||--o{ TenantUserRole : "a N rôles tenant"
    User ||--o| PlatformUserRole : "a 0-1 rôle platform"
    User ||--o{ PlatformUserOrgAccess : "accès platform assigned"
    
    Organization ||--o{ OrgUser : "a N membres"
    Organization ||--o{ Role : "possède N rôles tenant"
    Organization ||--o{ TenantUserRole : "assignations tenant"
    Organization ||--o{ PlatformUserOrgAccess : "accès platform"
    
    Role ||--o{ TenantUserRole : "assigné à N users (si tenant)"
    Role ||--o{ PlatformUserRole : "assigné à N users (si platform)"
    
    OrgUser ||--|| TenantUserRole : "garantit membership (FK composite)"
    
    User {
        uuid id PK
        citext email UK "unique global"
        string password_hash
        string first_name
        string last_name
    }
    
    Organization {
        uuid id PK
        string name
        citext slug UK
    }
    
    OrgUser {
        uuid user_id PK,FK
        uuid org_id PK,FK
        timestamp joined_at
    }
    
    Role {
        uuid id PK
        uuid org_id FK "NULL=platform, NOT NULL=tenant"
        string code
        string name
        int level
        boolean is_platform
        boolean is_root
        boolean is_locked
    }
    
    TenantUserRole {
        uuid user_id PK,FK
        uuid org_id PK,FK
        uuid role_id FK
        timestamp assigned_at
    }
    
    PlatformUserRole {
        uuid user_id PK,FK
        uuid role_id FK
        enum scope "all | assigned"
        timestamp assigned_at
    }
    
    PlatformUserOrgAccess {
        uuid user_id PK,FK
        uuid org_id PK,FK
        timestamp granted_at
    }
```

## Flux d'Assignation des Rôles

### Rôle Tenant (par organisation)

```mermaid
flowchart TD
    Start([User existe]) --> CheckMembership{User membre<br/>de l'org ?}
    
    CheckMembership -->|Non| CreateMembership[Créer OrgUser<br/>membership]
    CheckMembership -->|Oui| CheckRole{Rôle tenant<br/>existe ?}
    
    CreateMembership --> CheckRole
    
    CheckRole -->|Non| Error1[❌ Erreur:<br/>Rôle invalide]
    CheckRole -->|Oui| CheckRoleOrg{Rôle appartient<br/>à cette org ?}
    
    CheckRoleOrg -->|Non| Error2[❌ Erreur:<br/>Cross-org role]
    CheckRoleOrg -->|Oui| CreateAssignment[Créer/Update<br/>TenantUserRole]
    
    CreateAssignment --> Success[✅ 1 rôle tenant<br/>actif par org]
    
    style Start fill:#e1f5ff
    style Success fill:#d4edda
    style Error1 fill:#f8d7da
    style Error2 fill:#f8d7da
```

### Rôle Platform (global)

```mermaid
flowchart TD
    Start([User existe]) --> CheckRoleType{Rôle est<br/>platform ?}
    
    CheckRoleType -->|Non| Error1[❌ Erreur:<br/>Rôle tenant invalide<br/>trigger fired]
    CheckRoleType -->|Oui| CheckExisting{User a déjà<br/>rôle platform ?}
    
    CheckExisting -->|Oui| Update[Update<br/>PlatformUserRole]
    CheckExisting -->|Non| Create[Create<br/>PlatformUserRole]
    
    Update --> CheckScope{Scope ?}
    Create --> CheckScope
    
    CheckScope -->|all| Success1[✅ Accès à<br/>toutes les orgs]
    CheckScope -->|assigned| ManageAccess[Gérer<br/>PlatformUserOrgAccess]
    
    ManageAccess --> Success2[✅ Accès limité<br/>aux orgs assignées]
    
    style Start fill:#e1f5ff
    style Success1 fill:#d4edda
    style Success2 fill:#d4edda
    style Error1 fill:#f8d7da
```

## Scénarios d'Utilisation

### Scénario 1 : User Multi-tenant

```mermaid
graph TB
    subgraph "User: Alice"
        A[alice@example.com]
    end
    
    subgraph "Organization A"
        OrgA[Org A]
        RoleAdminA[Role: Admin]
        A -->|OrgUser| OrgA
        A -->|TenantUserRole<br/>level: 1| RoleAdminA
    end
    
    subgraph "Organization B"
        OrgB[Org B]
        RoleViewerB[Role: Viewer]
        A -->|OrgUser| OrgB
        A -->|TenantUserRole<br/>level: 4| RoleViewerB
    end
    
    style A fill:#4a90e2,color:#fff
    style OrgA fill:#50e3c2
    style OrgB fill:#50e3c2
    style RoleAdminA fill:#f5a623
    style RoleViewerB fill:#f5a623
```

**Résultat** : Alice est Admin dans Org A et Viewer dans Org B

---

### Scénario 2 : Support Agent (Platform Assigned)

```mermaid
graph TB
    subgraph "User: Bob (Support)"
        B[bob@support.com]
        RoleSupport[Role: Support<br/>is_platform: true<br/>scope: assigned]
        B -.->|PlatformUserRole| RoleSupport
    end
    
    subgraph "Accès Assignés"
        OrgX[Org X]
        OrgY[Org Y]
        OrgZ[Org Z]
        
        B -->|PlatformUserOrgAccess| OrgX
        B -->|PlatformUserOrgAccess| OrgY
        B -->|PlatformUserOrgAccess| OrgZ
    end
    
    OrgW[Org W]
    B -.->|❌ Pas d'accès| OrgW
    
    style B fill:#4a90e2,color:#fff
    style RoleSupport fill:#bd10e0,color:#fff
    style OrgX fill:#50e3c2
    style OrgY fill:#50e3c2
    style OrgZ fill:#50e3c2
    style OrgW fill:#d0d0d0
```

**Résultat** : Bob peut accéder aux orgs X, Y, Z uniquement (pas W)

---

### Scénario 3 : Root Administrator

```mermaid
graph TB
    subgraph "User: Charlie (Root)"
        C[charlie@admin.com]
        RoleRoot[Role: Root<br/>is_platform: true<br/>is_root: true<br/>scope: all]
        C -.->|PlatformUserRole| RoleRoot
    end
    
    subgraph "Toutes les Organizations"
        direction LR
        Org1[Org 1]
        Org2[Org 2]
        Org3[Org 3]
        OrgN[Org ...]
        
        C -.->|✅ Accès complet| Org1
        C -.->|✅ Accès complet| Org2
        C -.->|✅ Accès complet| Org3
        C -.->|✅ Accès complet| OrgN
    end
    
    style C fill:#4a90e2,color:#fff
    style RoleRoot fill:#d0021b,color:#fff
    style Org1 fill:#50e3c2
    style Org2 fill:#50e3c2
    style Org3 fill:#50e3c2
    style OrgN fill:#50e3c2
```

**Résultat** : Charlie bypass toute la logique d'autorisation (accès root)

---

## Contraintes DB Visuelles

### Contraintes sur TenantUserRole

```mermaid
graph LR
    subgraph "tenant_user_roles"
        TUR[user_id, org_id, role_id]
    end
    
    subgraph "Contraintes"
        C1[UNIQUE<br/>user_id, org_id<br/>1 rôle/org]
        C2[FK Composite<br/>user_id, org_id → org_users<br/>membership requis]
        C3[FK Composite<br/>role_id, org_id → roles<br/>même org]
        C4[Trigger<br/>check_tenant_role<br/>pas de rôle platform]
    end
    
    TUR --> C1
    TUR --> C2
    TUR --> C3
    TUR --> C4
    
    style TUR fill:#4a90e2,color:#fff
    style C1 fill:#f5a623
    style C2 fill:#f5a623
    style C3 fill:#f5a623
    style C4 fill:#f5a623
```

### Contraintes sur PlatformUserRole

```mermaid
graph LR
    subgraph "platform_user_roles"
        PUR[user_id, role_id, scope]
    end
    
    subgraph "Contraintes"
        C1[UNIQUE<br/>user_id<br/>1 rôle platform max]
        C2[FK<br/>role_id → roles<br/>role doit exister]
        C3[Trigger<br/>check_platform_role<br/>seulement rôles platform]
    end
    
    PUR --> C1
    PUR --> C2
    PUR --> C3
    
    style PUR fill:#bd10e0,color:#fff
    style C1 fill:#f5a623
    style C2 fill:#f5a623
    style C3 fill:#f5a623
```

---

## Hiérarchie des Rôles

```mermaid
graph TD
    subgraph "Platform Roles (org_id = NULL)"
        Root[ROOT<br/>level: 0<br/>is_root: true<br/>scope: all]
        Support[SUPPORT<br/>level: 10<br/>is_root: false<br/>scope: assigned]
    end
    
    subgraph "Tenant Roles (org_id != NULL)"
        Admin[ADMIN<br/>level: 1<br/>managed_by_template]
        Manager[MANAGER<br/>level: 2<br/>managed_by_template]
        Staff[STAFF<br/>level: 3<br/>managed_by_template]
        Viewer[VIEWER<br/>level: 4<br/>managed_by_template]
    end
    
    Root -.->|bypass all| Admin
    Root -.->|bypass all| Manager
    Root -.->|bypass all| Staff
    Root -.->|bypass all| Viewer
    
    Admin --> Manager
    Manager --> Staff
    Staff --> Viewer
    
    style Root fill:#d0021b,color:#fff
    style Support fill:#bd10e0,color:#fff
    style Admin fill:#f5a623
    style Manager fill:#7ed321
    style Staff fill:#4a90e2,color:#fff
    style Viewer fill:#9013fe,color:#fff
```

**Légende** :
- **Root** : Accès complet à tout, bypass RBAC
- **Support** : Accès limité aux orgs assignées
- **Admin → Viewer** : Hiérarchie tenant (level croissant = permissions décroissantes)

---

## Timeline de Migration

```mermaid
gantt
    title Migration STEP 1 - Multi-tenant
    dateFormat HH:mm
    axisFormat %H:%M
    
    section Préparation
    Backup DB           :done, prep1, 00:00, 10m
    Validation schéma   :done, prep2, 00:10, 5m
    
    section Migration
    Génération client   :active, mig1, 00:15, 5m
    Exécution SQL       :mig2, 00:20, 15m
    Validation tables   :mig3, 00:35, 10m
    
    section Seed
    Création rôles      :seed1, 00:45, 10m
    
    section Tests
    Tests unitaires     :test1, 00:55, 15m
    Tests intégration   :test2, 01:10, 20m
    
    section Finalisation
    Redémarrage app     :final1, 01:30, 5m
    Validation prod     :final2, 01:35, 10m
```

**Durée estimée** : 1h45

---

## Comparaison Avant/Après

| Aspect | Avant (Single-tenant) | Après (Multi-tenant) |
|--------|----------------------|---------------------|
| **User → Org** | 1:1 (FK direct) | N:N (via `org_users`) |
| **User → Role** | 1:1 (FK direct) | 1:N tenant + 0-1 platform |
| **Email unique** | Par org | Global |
| **Rôles platform** | ❌ Non supporté | ✅ Séparés (table dédiée) |
| **Invariants DB** | Partiels (FK simples) | Complets (FK composites + triggers) |
| **Multi-tenant** | ❌ Impossible | ✅ Natif |

---

**Pour plus de détails, consultez** :
- [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md)
- [STEP_1_EXECUTION_GUIDE.md](./STEP_1_EXECUTION_GUIDE.md)
