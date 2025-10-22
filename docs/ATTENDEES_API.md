# Attendees API Documentation

## Overview

The Attendees API provides CRUD operations for managing event attendees with multi-tenancy support, historical revisions, and RBAC permissions.

## Features

- **Multi-tenancy**: All operations are scoped by organization ID (`org_id`)
- **Unique constraint**: Email addresses are unique per organization (case-insensitive using `citext`)
- **Upsert semantics**: POST creates or updates based on email existence
- **Revisions**: Every write operation creates a historical revision
- **Soft/Hard delete**: Soft delete by default, hard delete with `?force=true` when no dependencies exist
- **Pagination & Filtering**: Advanced query capabilities with sorting
- **RBAC**: Permission-based access control

## Permissions Required

- `attendee.create` - Create or upsert attendees
- `attendee.read` - Read attendee data
- `attendee.update` - Update attendee information
- `attendee.delete` - Delete attendees (soft or hard)

## Endpoints

### POST /attendees

Create a new attendee or update an existing one if the email already exists in the organization.

**Behavior:**
- If an attendee with the same email exists in the org → partial update of provided fields
- If no attendee exists → create new attendee
- Always creates a revision with `change_type='upsert'`

**Request Body:**
```json
{
  "email": "alice@example.com",
  "first_name": "Alice",
  "last_name": "Doe",
  "phone": "+33612345678",
  "company": "ACME Corp",
  "job_title": "Software Engineer",
  "country": "FR",
  "labels": ["vip", "speaker"],
  "notes": "VIP guest, requires special access",
  "metadata": {
    "preferences": {
      "diet": "vegetarian"
    }
  },
  "is_active": true
}
```

**cURL Example:**
```bash
curl -X POST https://api.example.com/attendees \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "first_name": "Alice",
    "last_name": "Doe",
    "company": "ACME Corp",
    "labels": ["vip", "speaker"]
  }'
```

**Response:** `201 Created`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "org_id": "org-uuid",
  "email": "alice@example.com",
  "first_name": "Alice",
  "last_name": "Doe",
  "company": "ACME Corp",
  "labels": ["vip", "speaker"],
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

---

### GET /attendees

List attendees with pagination, filtering, and sorting.

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `pageSize` (number, default: 20, max: 200) - Items per page
- `q` (string) - Search across email, first_name, last_name, phone, company, job_title
- `email` (string) - Filter by exact email
- `typeId` (UUID) - Filter by type ID
- `isActive` (boolean) - Filter by active status
- `createdFrom` (ISO date) - Filter by creation date (from)
- `createdTo` (ISO date) - Filter by creation date (to)
- `sortBy` (enum: created_at, updated_at, email, last_name, default: created_at)
- `sortDir` (enum: asc, desc, default: desc)

**cURL Example:**
```bash
curl "https://api.example.com/attendees?page=1&pageSize=50&q=alice&isActive=true&sortBy=email&sortDir=asc" \
  -H "Authorization: Bearer <JWT>"
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "org_id": "org-uuid",
      "email": "alice@example.com",
      "first_name": "Alice",
      "last_name": "Doe",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

---

### GET /attendees/:id

Retrieve a single attendee by ID.

**cURL Example:**
```bash
curl https://api.example.com/attendees/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <JWT>"
```

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "org_id": "org-uuid",
  "email": "alice@example.com",
  "first_name": "Alice",
  "last_name": "Doe",
  "phone": "+33612345678",
  "company": "ACME Corp",
  "job_title": "Software Engineer",
  "country": "FR",
  "labels": ["vip", "speaker"],
  "notes": "VIP guest",
  "metadata": {},
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Error Response:** `404 Not Found` if attendee doesn't exist in the organization

---

### PUT /attendees/:id

Update an attendee. Only provided fields are updated.

**Request Body:** (all fields optional)
```json
{
  "email": "alice.new@example.com",
  "phone": "+33612345679",
  "job_title": "Senior Software Engineer",
  "labels": ["vip", "speaker", "sponsor"]
}
```

**cURL Example:**
```bash
curl -X PUT https://api.example.com/attendees/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+33612345679",
    "email": "alice.new@example.com"
  }'
```

**Response:** `200 OK` with updated attendee

**Error Responses:**
- `404 Not Found` - Attendee not found in organization
- `409 Conflict` - Email already exists for another attendee in the organization

---

### DELETE /attendees/:id

Delete an attendee. Soft delete by default, hard delete with `?force=true`.

**Query Parameters:**
- `force` (boolean, default: false) - Force hard delete if no dependencies exist

**Soft Delete (default):**
```bash
curl -X DELETE https://api.example.com/attendees/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <JWT>"
```

**Response:** `200 OK`
```json
{
  "message": "Attendee deactivated",
  "deleted": false
}
```

**Hard Delete:**
```bash
curl -X DELETE "https://api.example.com/attendees/123e4567-e89b-12d3-a456-426614174000?force=true" \
  -H "Authorization: Bearer <JWT>"
```

**Response:** `200 OK`
```json
{
  "message": "Attendee permanently deleted",
  "deleted": true
}
```

**Error Responses:**
- `404 Not Found` - Attendee not found in organization
- `409 Conflict` - Cannot hard delete: attendee has dependencies (e.g., registrations)

---

## Database Schema

### Attendees Table

```sql
CREATE TABLE "attendees" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    "default_type_id" UUID,
    "email" CITEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "job_title" TEXT,
    "country" TEXT,
    "metadata" JSONB,
    "labels" TEXT[],
    "notes" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    UNIQUE(org_id, email)
);
```

### Attendee Revisions Table

```sql
CREATE TABLE "attendee_revisions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "attendee_id" UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    "change_type" TEXT NOT NULL,  -- 'import' | 'merge' | 'manual' | 'upsert'
    "source" TEXT,                -- 'api' | 'ui' | 'csv:<file>'
    "snapshot" JSONB NOT NULL,
    "changed_by" UUID,
    "note" TEXT,
    "changed_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
```

---

## Revision Tracking

Every write operation (create, update, delete) creates a revision record with:
- **change_type**: Type of change (`upsert`, `manual`, `import`, `merge`)
- **source**: Origin of the change (`api`, `ui`, `csv:<filename>`)
- **snapshot**: Full JSON snapshot of the attendee after the change
- **changed_by**: User ID who made the change
- **note**: Additional context (e.g., "upsert-create", "soft delete")
- **changed_at**: Timestamp of the change

---

## Error Codes

- `400 Bad Request` - Invalid input data (validation errors)
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Attendee not found in organization
- `409 Conflict` - Email uniqueness violation or hard delete constraint

---

## Multi-Tenancy

All operations are automatically scoped to the authenticated user's organization (`req.user.org_id`). Users can only access attendees within their own organization. Cross-organization access is prevented at the database and application level.

---

## Testing

To seed attendee permissions in the database:

```sql
-- Insert attendee permissions
INSERT INTO permissions (id, code, name, description) VALUES
  (gen_random_uuid(), 'attendee.create', 'Create Attendees', 'Can create or upsert attendees'),
  (gen_random_uuid(), 'attendee.read', 'Read Attendees', 'Can view attendee information'),
  (gen_random_uuid(), 'attendee.update', 'Update Attendees', 'Can update attendee information'),
  (gen_random_uuid(), 'attendee.delete', 'Delete Attendees', 'Can delete attendees');
```

Then assign these permissions to roles as needed.
