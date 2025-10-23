# 📋 SPÉCIFICATION API - EVENTS & REGISTRATIONS

**Date** : 23 octobre 2025  
**Version** : 1.0  
**Objectif** : Système complet de gestion d'événements avec inscriptions, CRM attendees, et formulaires publics embeddables

---

## 🎯 VUE D'ENSEMBLE

### **Architecture Multi-Tenant**
- Chaque **organisation** a ses propres événements, attendees, et registrations
- Isolation stricte via `org_id` sur toutes les tables
- SUPER_ADMIN peut voir/modifier toutes les organisations
- Autres rôles limités à leur organisation

### **Flux Principal**
```
1. Admin crée un événement → Génération public_token
2. Événement embeddable via iframe (formulaire public)
3. Visiteur s'inscrit → Création/Update attendee + Registration
4. Admin gère les inscriptions (approuver/refuser/exporter)
5. CRM global des attendees par organisation
```

---

## 🗂️ MODÈLE DE DONNÉES

### **1. EVENTS (Événements)**
```sql
events (
  id uuid pk,
  org_id uuid not null,
  code text not null,              -- Code unique (ex: TECH2025)
  name text not null,
  description text null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'UTC',
  status text not null,            -- 'draft'|'published'|'active'|'completed'|'cancelled'
  capacity int null,               -- Limite de participants (null = illimité)
  
  -- Location
  location_type text not null default 'physical',  -- 'physical'|'online'|'hybrid'
  address_formatted text null,
  address_city text null,
  address_country text null,
  latitude numeric(9,6) null,
  longitude numeric(9,6) null,
  
  -- Références
  org_activity_sector_id uuid null,
  org_event_type_id uuid null,
  created_by uuid null,
  
  created_at timestamptz,
  updated_at timestamptz,
  
  UNIQUE(id, org_id),
  UNIQUE(org_id, code)
)
```

### **2. EVENT_SETTINGS (Configuration événement)**
```sql
event_settings (
  id uuid pk,
  org_id uuid not null,
  event_id uuid not null unique,
  
  -- Public token pour formulaire embeddable
  public_token text not null unique,  -- 🆕 AJOUTER CETTE COLONNE
  
  -- URLs
  website_url text null,
  logo_asset_id uuid null,
  
  -- Mode de participation
  attendance_mode text not null default 'onsite',  -- 'onsite'|'online'|'hybrid'
  
  -- Configuration inscription
  registration_auto_approve boolean not null default false,
  registration_fields jsonb null,  -- 🆕 Configuration des champs du formulaire
  
  -- Check-in
  allow_checkin_out boolean not null default true,
  
  -- Badges
  badge_template_id uuid null,
  
  -- Transitions automatiques de statut
  auto_transition_to_active boolean not null default true,   -- 🆕 AJOUTER
  auto_transition_to_completed boolean not null default true, -- 🆕 AJOUTER
  
  extra jsonb null,
  created_at timestamptz,
  updated_at timestamptz
)
```

**Structure `registration_fields` (JSONB)** :
```json
{
  "fields": [
    {
      "name": "first_name",
      "type": "text",
      "label": "Prénom",
      "required": true,
      "enabled": true,
      "placeholder": "Votre prénom",
      "validation": { "minLength": 2, "maxLength": 50 }
    },
    {
      "name": "last_name",
      "type": "text",
      "label": "Nom",
      "required": true,
      "enabled": true
    },
    {
      "name": "email",
      "type": "email",
      "label": "Email",
      "required": true,
      "enabled": true
    },
    {
      "name": "phone",
      "type": "tel",
      "label": "Téléphone",
      "required": false,
      "enabled": true
    },
    {
      "name": "company",
      "type": "text",
      "label": "Entreprise",
      "required": false,
      "enabled": false
    },
    {
      "name": "dietary_restrictions",
      "type": "textarea",
      "label": "Restrictions alimentaires",
      "required": false,
      "enabled": true,
      "custom": true
    },
    {
      "name": "tshirt_size",
      "type": "select",
      "label": "Taille T-Shirt",
      "required": false,
      "enabled": true,
      "custom": true,
      "options": ["XS", "S", "M", "L", "XL", "XXL"]
    }
  ]
}
```

**Champs standards** : Mappés vers colonnes `attendees` (first_name, last_name, email, phone, company, job_title, country)  
**Champs custom** : Stockés dans `registrations.answers` (dietary_restrictions, tshirt_size, etc.)

### **3. ATTENDEES (CRM Contacts)**
```sql
attendees (
  id uuid pk,
  org_id uuid not null,
  
  -- Informations personnelles
  first_name text null,
  last_name text null,
  email citext null,
  phone text null,
  company text null,
  job_title text null,
  country text null,
  metadata jsonb null,
  
  -- CRM
  default_type_id uuid null,  -- Type par défaut (VIP, Speaker, etc.)
  labels text[] null,          -- Tags CRM ['vip', 'speaker', 'sponsor']
  notes text null,             -- Notes internes
  
  created_at timestamptz,
  updated_at timestamptz,
  
  UNIQUE(org_id, email),  -- ⚠️ Email unique PAR organisation
  UNIQUE(id, org_id)
)
```

### **4. REGISTRATIONS (Inscriptions)**
```sql
registrations (
  id uuid pk,
  org_id uuid not null,
  event_id uuid not null,
  attendee_id uuid not null,
  
  -- Statut
  status text not null,  -- 'awaiting'|'approved'|'refused'|'cancelled'
  
  -- Type de participation
  attendance_type text check (attendance_type in ('online','onsite','hybrid')),
  
  -- Données formulaire custom
  answers jsonb null,  -- Réponses aux champs personnalisés
  
  -- Type d'attendee pour cet événement
  event_attendee_type_id uuid null,
  
  -- Badge
  badge_template_id uuid null,
  
  -- Dates
  invited_at timestamptz null,
  confirmed_at timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  UNIQUE(event_id, attendee_id),  -- ⚠️ Un attendee ne peut s'inscrire qu'une fois par event
  UNIQUE(id, event_id, org_id)
)
```

### **5. EVENT_ACCESS (Assignation Partners/Hostess)**
```sql
event_access (
  id uuid pk,
  org_id uuid not null,
  event_id uuid not null,
  user_id uuid not null,  -- PARTNER ou HOSTESS assigné
  reason text null,
  granted_by uuid null,
  expires_at timestamptz null,
  created_at timestamptz,
  updated_at timestamptz,
  
  UNIQUE(org_id, event_id, user_id)
)
```

---

## 🔐 PERMISSIONS PAR RÔLE

| Action | SUPER_ADMIN | ADMIN | MANAGER | VIEWER | PARTNER | HOSTESS |
|--------|-------------|-------|---------|--------|---------|---------|
| **EVENTS** |
| Créer événement | ✅ Toutes orgs | ✅ Son org | ✅ Son org | ❌ | ❌ | ❌ |
| Modifier événement | ✅ Tous | ✅ Son org | ✅ Son org | ❌ | ❌ | ❌ |
| Supprimer événement | ✅ Tous | ✅ Son org | ❌ | ❌ | ❌ | ❌ |
| Voir événement | ✅ Tous | ✅ Son org | ✅ Son org | ✅ Son org | ✅ Assignés | ✅ Assignés |
| Changer statut manuellement | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **REGISTRATIONS** |
| Voir inscriptions | ✅ | ✅ | ✅ | ✅ | ✅ Assigné | ✅ Assigné (nom seulement) |
| Approuver/Refuser | ✅ | ✅ | ✅ | ❌ | ✅ Assigné | ❌ |
| Exporter liste | ✅ | ✅ | ✅ | ✅ | ✅ Assigné | ❌ |
| Import Excel | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **ATTENDEES (CRM)** |
| Voir CRM global | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier attendee | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Supprimer attendee | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **CHECK-IN** (Plus tard) |
| Check-in participant | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ Assigné |

**Notes importantes** :
- PARTNER assigné : Voir toutes les infos (email, téléphone, etc.)
- HOSTESS assignée : Voir SEULEMENT `first_name` et `last_name` pour le check-in

---

## 📡 ENDPOINTS API

### **🔓 API PUBLIQUE (Sans authentification)**

#### **1. GET `/api/public/events/:publicToken`**
Récupérer les infos d'un événement pour afficher le formulaire d'inscription.

**URL** : `/api/public/events/evt_pub_abc123def456`

**Response 200** :
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Tech Conference 2025",
  "description": "La plus grande conférence tech de l'année",
  "start_at": "2025-11-15T09:00:00Z",
  "end_at": "2025-11-15T18:00:00Z",
  "timezone": "Europe/Paris",
  "location": {
    "type": "physical",
    "formatted": "Paris Convention Center, 2 Place de la Porte de Versailles, 75015 Paris",
    "city": "Paris",
    "country": "France"
  },
  "capacity": 500,
  "registered_count": 342,
  "remaining_spots": 158,
  "settings": {
    "registration_enabled": true,
    "requires_approval": false,
    "allowed_attendance_types": ["onsite", "online"],
    "fields": [
      {
        "name": "first_name",
        "type": "text",
        "label": "Prénom",
        "required": true,
        "enabled": true,
        "placeholder": "Votre prénom"
      },
      {
        "name": "last_name",
        "type": "text",
        "label": "Nom",
        "required": true,
        "enabled": true
      },
      {
        "name": "email",
        "type": "email",
        "label": "Email",
        "required": true,
        "enabled": true
      },
      {
        "name": "phone",
        "type": "tel",
        "label": "Téléphone",
        "required": false,
        "enabled": true
      },
      {
        "name": "company",
        "type": "text",
        "label": "Entreprise",
        "required": false,
        "enabled": true
      },
      {
        "name": "dietary_restrictions",
        "type": "textarea",
        "label": "Restrictions alimentaires",
        "required": false,
        "enabled": true,
        "custom": true
      },
      {
        "name": "tshirt_size",
        "type": "select",
        "label": "Taille T-Shirt",
        "required": false,
        "enabled": true,
        "custom": true,
        "options": ["XS", "S", "M", "L", "XL", "XXL"]
      }
    ]
  }
}
```

**Errors** :
- `404` : Token invalide ou événement non trouvé
- `410 Gone` : Événement terminé (`status: 'completed'`) ou annulé (`status: 'cancelled'`)
- `403 Forbidden` : Inscriptions fermées (manuellement désactivées)

---

#### **2. POST `/api/public/events/:publicToken/register`**
Inscription publique à un événement (cœur du système).

**URL** : `/api/public/events/evt_pub_abc123def456/register`

**Request Body** :
```json
{
  "first_name": "Corentin",
  "last_name": "Kistler",
  "email": "corentin@example.com",
  "phone": "0601020304",
  "company": "My Company",
  "job_title": "CTO",
  "country": "France",
  "attendance_type": "onsite",
  "answers": {
    "dietary_restrictions": "Végétarien",
    "tshirt_size": "L"
  }
}
```

**Logique Backend (CRITIQUE)** :
```typescript
async registerToEvent(publicToken: string, data: RegisterDto) {
  // 1. Récupérer l'événement via public_token
  const event = await this.prisma.event.findFirst({
    where: { settings: { public_token: publicToken } },
    include: { settings: true, org: true }
  })
  
  if (!event) throw new NotFoundException('Event not found')
  if (event.status === 'cancelled') throw new GoneException('Event cancelled')
  if (event.status === 'completed') throw new GoneException('Event completed')
  
  // 2. Vérifier capacité
  if (event.capacity) {
    const currentCount = await this.prisma.registrations.count({
      where: { event_id: event.id, status: { in: ['approved', 'awaiting'] } }
    })
    if (currentCount >= event.capacity) {
      throw new ConflictException('Event is full')
    }
  }
  
  // 3. Chercher ou créer attendee (par org_id + email)
  let attendee = await this.prisma.attendees.findUnique({
    where: { org_id_email: { org_id: event.org_id, email: data.email } }
  })
  
  if (!attendee) {
    // Créer nouvel attendee
    attendee = await this.prisma.attendees.create({
      data: {
        org_id: event.org_id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        company: data.company,
        job_title: data.job_title,
        country: data.country
      }
    })
  } else {
    // UPDATE attendee avec nouvelles infos (si changées)
    attendee = await this.prisma.attendees.update({
      where: { id: attendee.id },
      data: {
        first_name: data.first_name || attendee.first_name,
        last_name: data.last_name || attendee.last_name,
        phone: data.phone || attendee.phone,
        company: data.company || attendee.company,
        job_title: data.job_title || attendee.job_title,
        country: data.country || attendee.country
      }
    })
  }
  
  // 4. Vérifier si déjà inscrit à cet événement
  const existingReg = await this.prisma.registrations.findUnique({
    where: { event_id_attendee_id: { event_id: event.id, attendee_id: attendee.id } }
  })
  
  if (existingReg) {
    // ⚠️ RÈGLE CRITIQUE : Si statut = 'refused', ne rien faire
    if (existingReg.status === 'refused') {
      throw new ForbiddenException(
        'Your registration was previously declined. Please contact the organizer.'
      )
    }
    
    // Si déjà inscrit (awaiting ou approved), renvoyer erreur
    if (['awaiting', 'approved'].includes(existingReg.status)) {
      throw new ConflictException('You are already registered for this event')
    }
  }
  
  // 5. Créer registration
  const registration = await this.prisma.registrations.create({
    data: {
      org_id: event.org_id,
      event_id: event.id,
      attendee_id: attendee.id,
      status: event.settings.registration_auto_approve ? 'approved' : 'awaiting',
      attendance_type: data.attendance_type || 'onsite',
      answers: data.answers || {},
      invited_at: new Date(),
      confirmed_at: event.settings.registration_auto_approve ? new Date() : null
    }
  })
  
  // 6. Générer numéro de confirmation
  const confirmationNumber = `CONF-${event.code}-${registration.id.substring(0, 8).toUpperCase()}`
  
  // 7. TODO: Envoyer email de confirmation
  // await this.emailService.sendRegistrationConfirmation(registration, confirmationNumber)
  
  // 8. TODO: Si auto-approve, générer badge
  // if (event.settings.registration_auto_approve) {
  //   await this.badgeService.generate(registration.id)
  // }
  
  return {
    success: true,
    message: event.settings.registration_auto_approve 
      ? 'Registration confirmed' 
      : 'Registration received, pending approval',
    registration: {
      id: registration.id,
      status: registration.status,
      attendee: {
        id: attendee.id,
        first_name: attendee.first_name,
        last_name: attendee.last_name,
        email: attendee.email
      },
      confirmation_number: confirmationNumber,
      registered_at: registration.created_at
    }
  }
}
```

**Response 201** :
```json
{
  "success": true,
  "message": "Registration confirmed",
  "registration": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "approved",
    "attendee": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "first_name": "Corentin",
      "last_name": "Kistler",
      "email": "corentin@example.com"
    },
    "confirmation_number": "CONF-TECH2025-550E8400",
    "registered_at": "2025-10-23T14:30:00Z"
  }
}
```

**Errors** :
- `400 Bad Request` : Données invalides ou champs requis manquants
- `404 Not Found` : Token invalide
- `409 Conflict` : Déjà inscrit à cet événement
- `410 Gone` : Événement complet (capacité atteinte)
- `403 Forbidden` : Inscription précédemment refusée

---

### **🔒 API AUTHENTIFIÉE (JWT Required)**

#### **3. GET `/api/events`**
Liste des événements (filtrés selon permissions).

**Query Params** :
```
?page=1
&limit=20
&status=published
&search=conference
&sortBy=start_at
&sortOrder=asc
&startAfter=2025-10-01
&startBefore=2025-12-31
&orgId=uuid  // SUPER_ADMIN seulement
```

**Permissions** :
- SUPER_ADMIN : Tous les événements (+ filtrer par `orgId`)
- ADMIN/MANAGER/VIEWER : Événements de leur org
- PARTNER/HOSTESS : Uniquement événements assignés via `event_access`

**Response 200** :
```json
{
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "code": "TECH2025",
      "name": "Tech Conference 2025",
      "description": "La plus grande conférence tech",
      "start_at": "2025-11-15T09:00:00Z",
      "end_at": "2025-11-15T18:00:00Z",
      "timezone": "Europe/Paris",
      "status": "published",
      "capacity": 500,
      "location": {
        "type": "physical",
        "formatted": "Paris Convention Center",
        "city": "Paris",
        "country": "France"
      },
      "statistics": {
        "total_registrations": 342,
        "approved": 320,
        "awaiting": 22,
        "refused": 5,
        "cancelled": 0
      },
      "org": {
        "id": "org-uuid",
        "name": "My Organization",
        "slug": "my-org"
      },
      "created_at": "2025-09-01T10:00:00Z",
      "updated_at": "2025-10-15T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "total_pages": 3
  }
}
```

---

#### **4. POST `/api/events`**
Créer un événement.

**Permissions** : SUPER_ADMIN, ADMIN, MANAGER

**Request Body** :
```json
{
  "code": "TECH2025",
  "name": "Tech Conference 2025",
  "description": "La plus grande conférence tech de l'année",
  "start_at": "2025-11-15T09:00:00Z",
  "end_at": "2025-11-15T18:00:00Z",
  "timezone": "Europe/Paris",
  "status": "published",
  "capacity": 500,
  "location": {
    "type": "physical",
    "address_formatted": "Paris Convention Center, 2 Place de la Porte de Versailles, 75015 Paris",
    "address_city": "Paris",
    "address_country": "France",
    "latitude": 48.8566,
    "longitude": 2.3522
  },
  "org_activity_sector_id": "sector-uuid",
  "org_event_type_id": "type-uuid",
  "settings": {
    "website_url": "https://techconf.com",
    "attendance_mode": "hybrid",
    "registration_auto_approve": true,
    "allow_checkin_out": true,
    "auto_transition_to_active": true,
    "auto_transition_to_completed": true,
    "registration_fields": {
      "fields": [
        {
          "name": "first_name",
          "type": "text",
          "label": "Prénom",
          "required": true,
          "enabled": true
        },
        {
          "name": "last_name",
          "type": "text",
          "label": "Nom",
          "required": true,
          "enabled": true
        },
        {
          "name": "email",
          "type": "email",
          "label": "Email",
          "required": true,
          "enabled": true
        },
        {
          "name": "phone",
          "type": "tel",
          "label": "Téléphone",
          "required": false,
          "enabled": true
        },
        {
          "name": "dietary_restrictions",
          "type": "textarea",
          "label": "Restrictions alimentaires",
          "required": false,
          "enabled": true,
          "custom": true
        }
      ]
    }
  },
  "partner_ids": ["user-uuid-1", "user-uuid-2"],
  "org_id": "org-uuid"  // SUPER_ADMIN seulement (créer pour une autre org)
}
```

**Logique Backend** :
```typescript
async createEvent(userId: string, userOrgId: string, data: CreateEventDto) {
  // 1. Déterminer l'org_id (SUPER_ADMIN peut choisir, autres = leur org)
  const orgId = user.isSuperAdmin && data.org_id ? data.org_id : userOrgId
  
  // 2. Générer public_token unique
  const publicToken = `evt_pub_${nanoid(24)}`
  
  // 3. Créer event + event_settings en transaction
  const event = await this.prisma.$transaction(async (tx) => {
    const newEvent = await tx.events.create({
      data: {
        org_id: orgId,
        code: data.code,
        name: data.name,
        description: data.description,
        start_at: data.start_at,
        end_at: data.end_at,
        timezone: data.timezone || 'UTC',
        status: data.status || 'published',
        capacity: data.capacity,
        location_type: data.location?.type || 'physical',
        address_formatted: data.location?.address_formatted,
        address_city: data.location?.address_city,
        address_country: data.location?.address_country,
        latitude: data.location?.latitude,
        longitude: data.location?.longitude,
        org_activity_sector_id: data.org_activity_sector_id,
        org_event_type_id: data.org_event_type_id,
        created_by: userId
      }
    })
    
    // Créer event_settings
    await tx.eventSettings.create({
      data: {
        org_id: orgId,
        event_id: newEvent.id,
        public_token: publicToken,
        website_url: data.settings?.website_url,
        attendance_mode: data.settings?.attendance_mode || 'onsite',
        registration_auto_approve: data.settings?.registration_auto_approve || false,
        allow_checkin_out: data.settings?.allow_checkin_out !== false,
        auto_transition_to_active: data.settings?.auto_transition_to_active !== false,
        auto_transition_to_completed: data.settings?.auto_transition_to_completed !== false,
        registration_fields: data.settings?.registration_fields || defaultFields
      }
    })
    
    // Assigner partners si fournis
    if (data.partner_ids?.length > 0) {
      await tx.eventAccess.createMany({
        data: data.partner_ids.map(userId => ({
          org_id: orgId,
          event_id: newEvent.id,
          user_id: userId,
          granted_by: userId,
          reason: 'Assigned as partner'
        }))
      })
    }
    
    return newEvent
  })
  
  return event
}
```

**Response 201** :
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "TECH2025",
  "name": "Tech Conference 2025",
  "description": "La plus grande conférence tech de l'année",
  "start_at": "2025-11-15T09:00:00Z",
  "end_at": "2025-11-15T18:00:00Z",
  "timezone": "Europe/Paris",
  "status": "published",
  "capacity": 500,
  "location": {
    "type": "physical",
    "formatted": "Paris Convention Center",
    "city": "Paris",
    "country": "France",
    "latitude": 48.8566,
    "longitude": 2.3522
  },
  "public_token": "evt_pub_abc123def456xyz789",
  "embed_url": "https://ems.example.com/embed/event/evt_pub_abc123def456xyz789",
  "settings": {
    "website_url": "https://techconf.com",
    "attendance_mode": "hybrid",
    "registration_auto_approve": true,
    "allow_checkin_out": true,
    "registration_fields": { ... }
  },
  "created_at": "2025-10-23T15:00:00Z"
}
```

---

#### **5. GET `/api/events/:id`**
Détails d'un événement.

**Permissions** : Vérifier via CASL + `event_access` pour PARTNER/HOSTESS

**Response 200** :
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "TECH2025",
  "name": "Tech Conference 2025",
  "description": "La plus grande conférence tech de l'année",
  "start_at": "2025-11-15T09:00:00Z",
  "end_at": "2025-11-15T18:00:00Z",
  "timezone": "Europe/Paris",
  "status": "published",
  "capacity": 500,
  "location": {
    "type": "physical",
    "formatted": "Paris Convention Center",
    "city": "Paris",
    "country": "France",
    "latitude": 48.8566,
    "longitude": 2.3522
  },
  "org": {
    "id": "org-uuid",
    "name": "My Organization",
    "slug": "my-org"
  },
  "activity_sector": {
    "id": "sector-uuid",
    "name": "Technology",
    "color_hex": "#3B82F6"
  },
  "event_type": {
    "id": "type-uuid",
    "name": "Conference",
    "icon": "presentation"
  },
  "settings": {
    "public_token": "evt_pub_abc123def456xyz789",
    "website_url": "https://techconf.com",
    "attendance_mode": "hybrid",
    "registration_auto_approve": true,
    "allow_checkin_out": true,
    "registration_fields": { ... }
  },
  "statistics": {
    "total_registrations": 342,
    "approved": 320,
    "awaiting": 22,
    "refused": 5,
    "cancelled": 0,
    "checked_in": 280,
    "attendance_rate": 87.5
  },
  "partners": [
    {
      "id": "user-uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    }
  ],
  "embed_url": "https://ems.example.com/embed/event/evt_pub_abc123def456xyz789",
  "created_by": {
    "id": "user-uuid",
    "first_name": "Admin",
    "last_name": "User"
  },
  "created_at": "2025-09-01T10:00:00Z",
  "updated_at": "2025-10-15T14:30:00Z"
}
```

---

#### **6. PUT `/api/events/:id`**
Modifier un événement.

**Permissions** : SUPER_ADMIN, ADMIN, MANAGER (de l'org)

**Request Body** : Mêmes champs que POST (tous optionnels)

**Response 200** : Même structure que GET `/api/events/:id`

---

#### **7. DELETE `/api/events/:id`**
Supprimer un événement.

**Permissions** : SUPER_ADMIN, ADMIN

**Response 204** : No Content

---

#### **8. PUT `/api/events/:id/status`**
Changer manuellement le statut d'un événement.

**Permissions** : SUPER_ADMIN, ADMIN, MANAGER

**Request Body** :
```json
{
  "status": "cancelled",
  "reason": "Annulé pour raisons techniques"
}
```

**Response 200** :
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "cancelled",
  "updated_at": "2025-10-23T16:00:00Z"
}
```

---

#### **9. GET `/api/events/:eventId/registrations`**
Liste des inscriptions d'un événement.

**Query Params** :
```
?page=1
&limit=50
&status=approved
&search=corentin
&attendeeTypeId=type-uuid
&attendanceType=onsite
&sortBy=created_at
&sortOrder=desc
```

**Permissions** :
- SUPER_ADMIN, ADMIN, MANAGER, VIEWER : Toutes les données
- PARTNER : Toutes les données (si assigné)
- HOSTESS : SEULEMENT `first_name` et `last_name` (masquer email/phone)

**Response 200** :
```json
{
  "registrations": [
    {
      "id": "reg-uuid",
      "status": "approved",
      "attendance_type": "onsite",
      "attendee": {
        "id": "attendee-uuid",
        "first_name": "Corentin",
        "last_name": "Kistler",
        "email": "corentin@example.com",    // Masqué si HOSTESS
        "phone": "0601020304",               // Masqué si HOSTESS
        "company": "My Company"              // Masqué si HOSTESS
      },
      "event_attendee_type": {
        "id": "eat-uuid",
        "display_name": "VIP",
        "color_hex": "#F59E0B"
      },
      "answers": {
        "dietary_restrictions": "Végétarien",
        "tshirt_size": "L"
      },
      "confirmation_number": "CONF-TECH2025-550E8400",
      "invited_at": "2025-10-01T10:00:00Z",
      "confirmed_at": "2025-10-01T10:05:00Z",
      "checked_in": true,
      "checked_in_at": "2025-11-15T09:15:00Z",
      "created_at": "2025-10-01T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 342,
    "page": 1,
    "limit": 50,
    "total_pages": 7
  },
  "summary": {
    "total": 342,
    "approved": 320,
    "awaiting": 22,
    "refused": 5,
    "cancelled": 0,
    "checked_in": 280
  }
}
```

**Masquage pour HOSTESS** :
```typescript
if (user.role === 'HOSTESS') {
  return registrations.map(reg => ({
    ...reg,
    attendee: {
      id: reg.attendee.id,
      first_name: reg.attendee.first_name,
      last_name: reg.attendee.last_name,
      // email, phone, company MASQUÉS
    }
  }))
}
```

---

#### **10. PUT `/api/registrations/:id/status`**
Changer le statut d'une inscription.

**Permissions** : SUPER_ADMIN, ADMIN, MANAGER, PARTNER (si assigné)

**Request Body** :
```json
{
  "status": "approved",
  "reason": "Profil validé par l'équipe"
}
```

**Valeurs possibles** : `awaiting`, `approved`, `refused`, `cancelled`

**Response 200** :
```json
{
  "id": "reg-uuid",
  "status": "approved",
  "confirmed_at": "2025-10-23T14:30:00Z",
  "updated_by": {
    "id": "user-uuid",
    "first_name": "Admin",
    "last_name": "User"
  },
  "updated_at": "2025-10-23T14:30:00Z"
}
```

---

#### **11. POST `/api/events/:eventId/registrations/bulk-import`**
Import Excel de plusieurs inscriptions.

**Permissions** : SUPER_ADMIN, ADMIN, MANAGER

**Request** :
```
Content-Type: multipart/form-data

file: registrations.xlsx
autoApprove: true  // Optionnel, override event settings
```

**Structure Excel Acceptée** :

**Colonnes standards** (mappées vers `attendees`) :
- `email` (REQUIS)
- `first_name`
- `last_name`
- `phone`
- `company`
- `job_title`
- `country`

**Colonnes événement** (mappées vers `registrations`) :
- `attendance_type` (onsite/online/hybrid)

**Colonnes custom** (mappées vers `registrations.answers`) :
- Toutes les autres colonnes (ex: `dietary_restrictions`, `tshirt_size`, etc.)

**Exemple Excel** :
```csv
email,first_name,last_name,phone,company,job_title,attendance_type,dietary_restrictions,tshirt_size
corentin@example.com,Corentin,Kistler,0601020304,My Company,CTO,onsite,vegetarian,L
john@example.com,John,Doe,0602030405,,Developer,online,,M
jane@example.com,Jane,Smith,,,Manager,onsite,vegan,S
```

**Logique Backend** :
```typescript
async bulkImport(eventId: string, file: Express.Multer.File, autoApprove?: boolean) {
  // 1. Parser Excel (xlsx)
  const workbook = XLSX.read(file.buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet)
  
  // 2. Récupérer event
  const event = await this.prisma.events.findUnique({
    where: { id: eventId },
    include: { settings: true }
  })
  
  // 3. Déterminer auto-approve
  const shouldAutoApprove = autoApprove !== undefined 
    ? autoApprove 
    : event.settings.registration_auto_approve
  
  const results = {
    total_rows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  }
  
  // 4. Traiter chaque ligne
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    
    try {
      // Validation email requis
      if (!row.email) {
        results.errors.push({ row: i + 1, error: 'Email required' })
        results.skipped++
        continue
      }
      
      // Séparer champs standards et custom
      const standardFields = ['email', 'first_name', 'last_name', 'phone', 'company', 'job_title', 'country']
      const eventFields = ['attendance_type']
      
      const attendeeData = {}
      const customAnswers = {}
      
      Object.keys(row).forEach(key => {
        if (standardFields.includes(key)) {
          attendeeData[key] = row[key]
        } else if (!eventFields.includes(key)) {
          customAnswers[key] = row[key]
        }
      })
      
      // Chercher ou créer attendee
      let attendee = await this.prisma.attendees.findUnique({
        where: { org_id_email: { org_id: event.org_id, email: row.email } }
      })
      
      if (!attendee) {
        attendee = await this.prisma.attendees.create({
          data: { org_id: event.org_id, ...attendeeData }
        })
        results.created++
      } else {
        attendee = await this.prisma.attendees.update({
          where: { id: attendee.id },
          data: attendeeData
        })
        results.updated++
      }
      
      // Vérifier si déjà inscrit
      const existingReg = await this.prisma.registrations.findUnique({
        where: { event_id_attendee_id: { event_id: eventId, attendee_id: attendee.id } }
      })
      
      if (existingReg) {
        results.skipped++
        continue
      }
      
      // Créer registration
      await this.prisma.registrations.create({
        data: {
          org_id: event.org_id,
          event_id: eventId,
          attendee_id: attendee.id,
          status: shouldAutoApprove ? 'approved' : 'awaiting',
          attendance_type: row.attendance_type || 'onsite',
          answers: customAnswers,
          invited_at: new Date(),
          confirmed_at: shouldAutoApprove ? new Date() : null
        }
      })
      
    } catch (error) {
      results.errors.push({ row: i + 1, email: row.email, error: error.message })
      results.skipped++
    }
  }
  
  return results
}
```

**Response 200** :
```json
{
  "success": true,
  "summary": {
    "total_rows": 150,
    "created": 120,
    "updated": 25,
    "skipped": 5,
    "errors": []
  },
  "details": [
    {
      "row": 1,
      "email": "corentin@example.com",
      "status": "created",
      "attendee_id": "attendee-uuid",
      "registration_id": "reg-uuid"
    },
    {
      "row": 3,
      "email": "invalid-email",
      "status": "error",
      "error": "Email invalide"
    }
  ]
}
```

---

#### **12. GET `/api/attendees`**
CRM global des attendees de l'organisation.

**Query Params** :
```
?page=1
&limit=50
&search=corentin       // Recherche dans nom, email, téléphone
&labels=vip,speaker    // Filtrer par labels
&eventIds=uuid1,uuid2  // Participants à ces événements
&minEvents=3           // Participants récurrents (≥ 3 événements)
&sortBy=last_name
&sortOrder=asc
```

**Permissions** : SUPER_ADMIN, ADMIN, MANAGER, VIEWER

**Response 200** :
```json
{
  "attendees": [
    {
      "id": "attendee-uuid",
      "first_name": "Corentin",
      "last_name": "Kistler",
      "email": "corentin@example.com",
      "phone": "0601020304",
      "company": "My Company",
      "job_title": "CTO",
      "country": "France",
      "default_type": {
        "id": "type-uuid",
        "name": "VIP",
        "color_hex": "#F59E0B"
      },
      "labels": ["speaker", "sponsor"],
      "notes": "Important contact for future events",
      "statistics": {
        "total_events": 5,
        "total_registrations": 5,
        "approved": 5,
        "awaiting": 0,
        "refused": 0,
        "checked_in": 4,
        "attendance_rate": 80.0,
        "last_event_at": "2025-10-15T10:00:00Z",
        "first_event_at": "2024-05-20T09:00:00Z"
      },
      "created_at": "2024-05-15T08:30:00Z",
      "updated_at": "2025-10-20T11:00:00Z"
    }
  ],
  "pagination": {
    "total": 1250,
    "page": 1,
    "limit": 50,
    "total_pages": 25
  }
}
```

---

#### **13. GET `/api/attendees/:id`**
Profil complet d'un attendee avec historique.

**Permissions** : SUPER_ADMIN, ADMIN, MANAGER, VIEWER

**Response 200** :
```json
{
  "id": "attendee-uuid",
  "first_name": "Corentin",
  "last_name": "Kistler",
  "email": "corentin@example.com",
  "phone": "0601020304",
  "company": "My Company",
  "job_title": "CTO",
  "country": "France",
  "default_type": {
    "id": "type-uuid",
    "name": "VIP",
    "color_hex": "#F59E0B"
  },
  "labels": ["speaker", "sponsor"],
  "notes": "Important contact for future events",
  "statistics": {
    "total_events": 5,
    "total_registrations": 5,
    "approved": 5,
    "awaiting": 0,
    "refused": 0,
    "checked_in": 4,
    "attendance_rate": 80.0
  },
  "registrations_history": [
    {
      "id": "reg-uuid-1",
      "event": {
        "id": "event-uuid-1",
        "code": "TECH2025",
        "name": "Tech Conference 2025",
        "start_at": "2025-11-15T09:00:00Z"
      },
      "status": "approved",
      "attendance_type": "onsite",
      "registered_at": "2025-10-01T10:00:00Z",
      "checked_in": false
    },
    {
      "id": "reg-uuid-2",
      "event": {
        "id": "event-uuid-2",
        "code": "WEB2025",
        "name": "Web Summit 2025",
        "start_at": "2025-09-10T08:00:00Z"
      },
      "status": "approved",
      "attendance_type": "onsite",
      "registered_at": "2025-08-05T14:30:00Z",
      "checked_in": true,
      "checked_in_at": "2025-09-10T08:15:00Z"
    }
  ],
  "created_at": "2024-05-15T08:30:00Z",
  "updated_at": "2025-10-20T11:00:00Z"
}
```

---

#### **14. PUT `/api/attendees/:id`**
Modifier un attendee (CRM).

**Permissions** : SUPER_ADMIN, ADMIN, MANAGER

**Request Body** :
```json
{
  "first_name": "Corentin",
  "last_name": "Kistler",
  "phone": "0606060606",
  "company": "New Company",
  "job_title": "CEO",
  "default_type_id": "type-uuid",
  "labels": ["vip", "speaker", "sponsor"],
  "notes": "Updated notes about this contact"
}
```

**Response 200** : Même structure que GET `/api/attendees/:id`

---

#### **15. DELETE `/api/attendees/:id`**
Supprimer un attendee (supprime aussi toutes ses registrations en cascade).

**Permissions** : SUPER_ADMIN, ADMIN

**Response 204** : No Content

---

#### **16. GET `/api/attendees/:id/export`**
Exporter toutes les données d'un attendee (GDPR compliance).

**Permissions** : SUPER_ADMIN, ADMIN, MANAGER

**Response 200** :
```json
{
  "attendee": {
    "id": "attendee-uuid",
    "first_name": "Corentin",
    "last_name": "Kistler",
    "email": "corentin@example.com",
    "phone": "0601020304",
    "company": "My Company",
    "job_title": "CTO",
    "country": "France",
    "labels": ["speaker", "sponsor"],
    "notes": "Important contact",
    "created_at": "2024-05-15T08:30:00Z",
    "updated_at": "2025-10-20T11:00:00Z"
  },
  "registrations": [
    {
      "id": "reg-uuid",
      "event": { ... },
      "status": "approved",
      "attendance_type": "onsite",
      "answers": { ... },
      "registered_at": "2025-10-01T10:00:00Z"
    }
  ],
  "badges": [ ... ],
  "presence_visits": [ ... ]
}
```

---

## 🔄 TÂCHE CRON : TRANSITIONS AUTOMATIQUES DE STATUT

**Scheduler** : Tous les jours à minuit (00:00 UTC)

```typescript
@Cron('0 0 * * *')  // Tous les jours à minuit
async transitionEventStatuses() {
  const now = new Date()
  
  // 1. PUBLISHED → ACTIVE (date de début atteinte)
  const toActivate = await this.prisma.events.updateMany({
    where: {
      status: 'published',
      start_at: { lte: now },
      settings: { auto_transition_to_active: true }
    },
    data: { 
      status: 'active',
      updated_at: now
    }
  })
  
  console.log(`[CRON] ${toActivate.count} events transitioned to ACTIVE`)
  
  // 2. ACTIVE → COMPLETED (date de fin atteinte)
  const toComplete = await this.prisma.events.updateMany({
    where: {
      status: 'active',
      end_at: { lte: now },
      settings: { auto_transition_to_completed: true }
    },
    data: { 
      status: 'completed',
      updated_at: now
    }
  })
  
  console.log(`[CRON] ${toComplete.count} events transitioned to COMPLETED`)
}
```

---

## 🔐 GÉNÉRATION DU PUBLIC TOKEN

**Lors de la création d'un événement** :

```typescript
import { customAlphabet } from 'nanoid'

// Alphabet sans caractères ambigus (0/O, 1/l/I)
const nanoid = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 24)

// Générer token unique
const publicToken = `evt_pub_${nanoid()}`
// Exemple : evt_pub_7kR3mN9pQx4Wy2Vh5Lz8Jt6B

// Vérifier unicité
const existing = await this.prisma.eventSettings.findUnique({
  where: { public_token: publicToken }
})

if (existing) {
  // Regénérer si collision (très rare)
  publicToken = `evt_pub_${nanoid()}`
}
```

---

## 📊 CALCUL DES STATISTIQUES

### **Statistiques Event** :
```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'approved') as approved,
  COUNT(*) FILTER (WHERE status = 'awaiting') as awaiting,
  COUNT(*) FILTER (WHERE status = 'refused') as refused,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
  COUNT(DISTINCT CASE WHEN pv.in_at IS NOT NULL THEN r.id END) as checked_in
FROM registrations r
LEFT JOIN presence_visits pv ON pv.registration_id = r.id 
  AND pv.subevent_id IS NULL 
  AND pv.voided_at IS NULL
WHERE r.event_id = :eventId
```

### **Statistiques Attendee** :
```sql
SELECT 
  COUNT(DISTINCT r.event_id) as total_events,
  COUNT(*) as total_registrations,
  COUNT(*) FILTER (WHERE r.status = 'approved') as approved,
  COUNT(*) FILTER (WHERE r.status = 'awaiting') as awaiting,
  COUNT(*) FILTER (WHERE r.status = 'refused') as refused,
  COUNT(DISTINCT CASE WHEN pv.in_at IS NOT NULL THEN r.id END) as checked_in,
  MAX(e.start_at) as last_event_at,
  MIN(e.start_at) as first_event_at
FROM registrations r
JOIN events e ON e.id = r.event_id
LEFT JOIN presence_visits pv ON pv.registration_id = r.id 
  AND pv.subevent_id IS NULL 
  AND pv.voided_at IS NULL
WHERE r.attendee_id = :attendeeId
```

---

## 🧪 TESTS À IMPLÉMENTER

### **Tests Unitaires** :

1. **Service EventsService**
   - ✅ Créer événement → Génère public_token unique
   - ✅ Update événement → Préserve public_token
   - ✅ Transition statut → Vérifie auto_transition flags

2. **Service RegistrationsService**
   - ✅ Inscription nouvelle → Crée attendee + registration
   - ✅ Inscription existante → Update attendee
   - ✅ Réinscription refusée → Renvoie erreur 403
   - ✅ Réinscription approuvée → Renvoie erreur 409
   - ✅ Capacité pleine → Renvoie erreur 410

3. **Service AttendeesService**
   - ✅ CRM global → Filtre par org_id
   - ✅ Recherche → Par nom/email/téléphone
   - ✅ Historique → Calcule stats correctement

### **Tests E2E** :

1. **Formulaire Public**
   - ✅ GET `/api/public/events/:token` → 200 avec fields
   - ✅ POST `/api/public/events/:token/register` → 201 nouvelle inscription
   - ✅ POST `/api/public/events/:token/register` (doublon) → 409 Conflict
   - ✅ POST `/api/public/events/:token/register` (refused) → 403 Forbidden
   - ✅ POST `/api/public/events/:token/register` (full) → 410 Gone

2. **CRUD Events**
   - ✅ POST `/api/events` → 201 avec public_token
   - ✅ GET `/api/events` (PARTNER) → Seulement événements assignés
   - ✅ GET `/api/events` (HOSTESS) → Seulement événements assignés
   - ✅ PUT `/api/events/:id/status` → 200 statut modifié

3. **Import Excel**
   - ✅ POST `/api/events/:id/registrations/bulk-import` → 200 avec summary
   - ✅ Colonnes custom → Stockées dans `answers`
   - ✅ Doublons → Skippés

---

## 📝 TODO BACKEND

### **Phase 1 : Core (Prioritaire)** ✅
- [ ] Créer migration pour ajouter `public_token` à `event_settings`
- [ ] Créer migration pour ajouter `registration_fields` (JSONB) à `event_settings`
- [ ] Créer migration pour ajouter `auto_transition_to_active` et `auto_transition_to_completed` à `event_settings`
- [ ] Module Events (CRUD + public token generation)
- [ ] Module Public (GET event, POST register)
- [ ] Module Registrations (liste, update status)
- [ ] Module Attendees (CRM global)
- [ ] Logique inscription : attendee create/update + registration
- [ ] Vérification contrainte `UNIQUE(event_id, attendee_id)`
- [ ] Règle "refused" → Bloquer réinscription

### **Phase 2 : Features** 🚧
- [ ] Import Excel avec mapping flexible
- [ ] Export CSV/Excel des registrations
- [ ] Export GDPR attendee (toutes données)
- [ ] Cron job transitions automatiques statut
- [ ] Email confirmation inscription
- [ ] Email approbation/refus

### **Phase 3 : Advanced** 🔮
- [ ] Badges & QR codes
- [ ] Check-in système
- [ ] Subevents
- [ ] Analytics avancées
- [ ] Webhooks (inscription, approbation, etc.)

---

## 🎯 RÉSUMÉ POUR LE FRONTEND

### **Variables d'Environnement** :
```env
VITE_API_BASE_URL=https://api.ems.example.com
VITE_EMBED_BASE_URL=https://ems.example.com/embed
```

### **Endpoints à Mocker en Priorité** :
1. ✅ `GET /api/events` (liste)
2. ✅ `POST /api/events` (création)
3. ✅ `GET /api/events/:id` (détails)
4. ✅ `GET /api/public/events/:token` (formulaire public)
5. ✅ `POST /api/public/events/:token/register` (inscription)
6. ✅ `GET /api/events/:id/registrations` (liste inscriptions)
7. ✅ `PUT /api/registrations/:id/status` (approuver/refuser)
8. ✅ `GET /api/attendees` (CRM)

### **URL Iframe Embeddable** :
```html
<iframe 
  src="https://ems.example.com/embed/event/evt_pub_abc123def456xyz789"
  width="100%"
  height="800px"
  frameborder="0"
></iframe>
```

---

**FIN DE LA SPÉCIFICATION** ✅

**Questions ou clarifications ?** Contacte-moi avant de commencer l'implémentation !
