# Phase 1 Core - Progress Tracker

## ✅ Completed

### 1. Database Schema (Prisma)
- ✅ Added all required models:
  - `OrgActivitySector` (with hierarchical parent/child)
  - `OrgEventType`
  - `AttendeeType`
  - `BadgeTemplate`
  - `EmailSender`
  - `Event` (with FK composites to sectors/types)
  - `EventSetting` (1:1 with Event, includes `public_token`)
  - `EmailSetting` (1:1 with Event)
  - `EventAttendeeType`
  - `EventAttendeeTypeBadge`
  - `Registration` (with all required fields)
  - `Badge`, `BadgePrint`
  - `Subevent`, `PartnerScan`, `PresenceVisit` (Phase 3 placeholders)
  - `EventAccess` (user assignment to events)
- ✅ All composite foreign keys implemented
- ✅ All indexes and unique constraints added
- ✅ Migration generated and applied successfully

### 2. Permissions RBAC
- ✅ Added permissions for:
  - `events.read:own`, `events.read:any`, `events.create`, `events.update`, `events.delete`, `events.publish`
  - `registrations.read`, `registrations.create`, `registrations.update`, `registrations.import`
- ✅ Permissions assigned to roles:
  - SUPER_ADMIN: all permissions
  - ADMIN: all permissions (org-scoped)
  - MANAGER: read, create, import (no update status)
  - VIEWER: read only
  - PARTNER: read only (assigned events)
  - HOSTESS: read only (assigned events, cannot update status)
- ✅ Seed executed successfully

### 3. EventsModule
- ✅ DTOs created:
  - `CreateEventDto` (with embedded event_settings fields)
  - `UpdateEventDto`
  - `ListEventsDto` (filters, pagination, sorting)
  - `ChangeEventStatusDto`
- ✅ Service implemented:
  - `create()`: Creates event + event_settings with unique `public_token` (nanoid)
  - `findAll()`: List with filters (status, search, dates), pagination, sorting
  - `findOne()`: Get by ID with settings
  - `update()`: Update event and settings
  - `remove()`: Delete with dependency check (registrations)
  - `changeStatus()`: Change event status
- ✅ Controller implemented:
  - All CRUD endpoints with PermissionsGuard
  - Multi-tenant with `resolveEffectiveOrgId`
  - Swagger documentation
- ✅ Module configured with PrismaModule and CaslModule

### 4. Utilities
- ✅ `generatePublicToken()`: nanoid-based token generator (16 chars, alphanumeric)
- ✅ `CaslModule`: Global module for CASL ability factory

## ✅ Completed (continued)

### 5. PublicModule
- ✅ DTOs created:
  - `PublicRegisterDto` (with nested `AttendeeDataDto`)
- ✅ Service implemented:
  - `getEventByPublicToken()`: Returns safe event fields + registration_fields
  - `registerToEvent()`: Public registration with attendee upsert, capacity check, duplicate check, auto-approve
- ✅ Controller implemented:
  - `GET /api/public/events/:publicToken` - No auth required
  - `POST /api/public/events/:publicToken/register` - No auth required
- ✅ Module configured with PrismaModule

### 6. RegistrationsModule
- ✅ DTOs created:
  - `ListRegistrationsDto` (filters: status, attendanceType, company, search, pagination, sorting)
  - `CreateRegistrationDto` (with nested attendee data)
  - `UpdateRegistrationStatusDto`
- ✅ Service implemented:
  - `findAll()`: List with filters, pagination, sorting (no PII masking)
  - `updateStatus()`: Update status with confirmed_at auto-set on approval
  - `create()`: Create with attendee upsert, capacity check, duplicate check
- ✅ Controller implemented:
  - `GET /api/events/:eventId/registrations` - All roles see same data
  - `PUT /api/registrations/:id/status` - HOSTESS role explicitly forbidden (403)
  - `POST /api/events/:eventId/registrations` - Create with upsert
- ✅ Module configured with PrismaModule and CaslModule
- ⚠️ Bulk import endpoint commented (TODO for future implementation)

## ⏳ Pending

### 7. Tests
- Unit tests for EventsService
- Unit tests for RegistrationsService
- E2E tests for all endpoints

### 8. Documentation
- Swagger completion
- Definition of Done verification

## Notes

- All TypeScript errors resolved after Prisma client regeneration
- nanoid library installed for public token generation
- Attendees module already exists with upsert functionality (reuse for registrations)
- HOSTESS role can read all registration data but cannot update status (as per requirements)
