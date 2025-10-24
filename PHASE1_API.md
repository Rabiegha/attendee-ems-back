# Phase 1 Core - API Documentation

## Base URL
- **Development**: `http://localhost:3000/api`
- **Public endpoints**: No authentication required
- **Protected endpoints**: Require JWT Bearer token

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 📅 Events Module

### POST /api/events
**Create a new event with settings**
- **Permission**: `events.create`
- **Body**:
```json
{
  "code": "CONF2024",
  "name": "Tech Conference 2024",
  "start_at": "2024-12-01T09:00:00Z",
  "end_at": "2024-12-01T18:00:00Z",
  "timezone": "Europe/Paris",
  "status": "draft",
  "capacity": 500,
  "location_type": "physical",
  "description": "Annual tech conference",
  "address_city": "Paris",
  "registration_auto_approve": false
}
```
- **Response**: Event object with `settings` (including `public_token`)

### GET /api/events
**List all events**
- **Permission**: `events.read:any` or `events.read:own`
- **Query params**: `status`, `search`, `startAfter`, `startBefore`, `page`, `limit`, `sortBy`, `sortOrder`
- **Response**: Paginated list of events

### GET /api/events/:id
**Get event by ID**
- **Permission**: `events.read:any` or `events.read:own`
- **Response**: Event object with settings

### PUT /api/events/:id
**Update an event**
- **Permission**: `events.update`
- **Body**: Partial event data
- **Response**: Updated event

### DELETE /api/events/:id
**Delete an event**
- **Permission**: `events.delete`
- **Response**: Success message
- **Note**: Fails if registrations exist (409 Conflict)

### PUT /api/events/:id/status
**Change event status**
- **Permission**: `events.update`
- **Body**: `{ "status": "published" }`
- **Response**: Updated event

---

## 🌐 Public Module (No Auth)

### GET /api/public/events/:publicToken
**Get event information by public token**
- **No authentication required**
- **Response**: Safe event fields (no internal IDs)
```json
{
  "code": "CONF2024",
  "name": "Tech Conference 2024",
  "description": "...",
  "start_at": "2024-12-01T09:00:00Z",
  "end_at": "2024-12-01T18:00:00Z",
  "capacity": 500,
  "registration_fields": {...},
  "activity_sector": {...},
  "event_type": {...}
}
```

### POST /api/public/events/:publicToken/register
**Register to an event (public)**
- **No authentication required**
- **Body**:
```json
{
  "attendee": {
    "email": "corentin@example.com",
    "first_name": "Corentin",
    "last_name": "Kistler",
    "phone": "+33601020304",
    "company": "MyCompany",
    "job_title": "CTO",
    "country": "FR"
  },
  "attendance_type": "onsite",
  "event_attendee_type_id": "uuid-optional",
  "answers": { "dietary": "vegetarian" }
}
```
- **Response**: Registration confirmation
- **Errors**:
  - `409`: Event is full or already registered
  - `403`: Previously declined or event not open

---

## 📝 Registrations Module

### GET /api/events/:eventId/registrations
**List registrations for an event**
- **Permission**: `registrations.read`
- **Query params**: `status`, `attendanceType`, `attendeeTypeId`, `company`, `search`, `page`, `limit`, `sortBy`, `sortOrder`
- **Response**: Paginated list with full attendee data (no PII masking)
- **Note**: HOSTESS role can see all data but cannot update status

### PUT /api/registrations/:id/status
**Update registration status**
- **Permission**: `registrations.update`
- **Body**: `{ "status": "approved" }`
- **Response**: Updated registration
- **Note**: HOSTESS role is forbidden (403)
- **Auto-behavior**: Sets `confirmed_at` when status changes to `approved`

### POST /api/events/:eventId/registrations
**Create a registration with attendee upsert**
- **Permission**: `registrations.create`
- **Body**:
```json
{
  "attendee": {
    "email": "alice@example.com",
    "first_name": "Alice",
    "last_name": "Smith",
    "company": "ACME Corp"
  },
  "attendance_type": "onsite",
  "event_attendee_type_id": "uuid-optional",
  "answers": {}
}
```
- **Response**: Created registration
- **Behavior**:
  - Upserts attendee by `(org_id, email)`
  - Checks event capacity
  - Checks for duplicate registrations
  - Auto-approves if `registration_auto_approve` is enabled

---

## 🔐 Permissions & Roles

### Role Capabilities

| Role | Events | Registrations | Notes |
|------|--------|---------------|-------|
| **SUPER_ADMIN** | Full access (all orgs) | Full access | Cross-tenant |
| **ADMIN** | Full access (own org) | Full access | Can manage everything |
| **MANAGER** | Create, Read, Update | Create, Read, Import | Cannot update status |
| **VIEWER** | Read only | Read only | No modifications |
| **PARTNER** | Read (assigned events) | Read (assigned events) | Via `event_access` |
| **HOSTESS** | Read (assigned events) | Read only | **Cannot update status** |

### Key Rules
1. **HOSTESS** can see all registration data (including PII) but **cannot** update registration status
2. **PARTNER** can only access events assigned via `event_access` table
3. All roles see the same data when listing registrations (no PII masking)
4. Public endpoints bypass authentication entirely

---

## 🔄 Business Logic

### Event Creation
1. Creates `Event` record
2. Automatically creates `EventSetting` with unique `public_token` (nanoid, 16 chars)
3. Returns both in single response

### Public Registration
1. Validates event is `published`
2. Checks capacity (if set)
3. **Upserts** attendee by `(org_id, email)`:
   - If exists: updates non-empty fields
   - If new: creates attendee
4. Checks for duplicate registration:
   - `awaiting`/`approved`: 409 Conflict
   - `refused`: 403 Forbidden
5. Creates registration with auto-approve logic
6. Sets `confirmed_at` if auto-approved

### Authenticated Registration
Same logic as public registration, but:
- Requires authentication
- Uses organization from authenticated user
- Can specify additional options

### Status Update
- Only users with `registrations.update` permission
- **HOSTESS role explicitly blocked** (403)
- Auto-sets `confirmed_at` when changing to `approved`

---

## 📊 Data Model Highlights

### Event
- `code`: Unique per organization
- `status`: `draft`, `published`, `archived`
- `capacity`: Optional max attendees
- `location_type`: `physical`, `online`, `hybrid`

### EventSetting (1:1 with Event)
- `public_token`: Unique, URL-safe, 16 chars
- `registration_auto_approve`: Auto-approve registrations
- `registration_fields`: JSON schema for custom fields

### Registration
- `status`: `awaiting`, `approved`, `refused`, `cancelled`
- `attendance_type`: `onsite`, `online`, `hybrid`
- `answers`: JSON for custom form responses
- `confirmed_at`: Auto-set on approval

### Attendee
- Unique by `(org_id, email)`
- Upserted during registration
- Shared across events within same org

---

## 🚀 Next Steps (Not Implemented)

1. **Bulk Import**: Excel import for registrations
2. **Event Access**: Implement `event_access` checks for PARTNER/HOSTESS
3. **Email Notifications**: Confirmation/reminder emails
4. **Badge Generation**: Badge templates and printing
5. **Check-in/out**: Presence tracking (Phase 3)
