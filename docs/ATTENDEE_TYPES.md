# 🏷️ Attendee Types Documentation

## Overview
Attendee Types allow organizations to categorize participants (e.g., VIP, Speaker, Staff, Participant). These types are defined at the organization level and can be enabled/configured for specific events.

## 🗄️ Database Schema

### `AttendeeType` (Organization Level)
Defines the available types for an organization.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `org_id` | UUID | Foreign Key to Organization |
| `code` | String | Unique code per org (e.g., 'VIP') |
| `name` | String | Display name |
| `color_hex` | String | Background color for badges/UI |
| `text_color_hex` | String | Text color for badges/UI |
| `icon` | String | Icon name (Lucide React) |
| `is_active` | Boolean | Soft delete status |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Update timestamp |

> **Note**: The `sort_order` column has been removed. Sorting is now alphabetical by name.

### `EventAttendeeType` (Event Level)
Links an `AttendeeType` to an `Event`, allowing specific configuration per event.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `event_id` | UUID | Foreign Key to Event |
| `org_id` | UUID | Foreign Key to Organization |
| `attendee_type_id` | UUID | Foreign Key to AttendeeType |
| `capacity` | Integer | Optional capacity limit for this type in this event |

## 🔌 API Endpoints

### List Attendee Types
`GET /orgs/:orgId/attendee-types`

Returns all attendee types for the organization with usage statistics.

**Response:**
```json
[
  {
    "id": "uuid...",
    "code": "VIP",
    "name": "VIP",
    "color_hex": "#FFD700",
    "text_color_hex": "#000000",
    "icon": "star",
    "is_active": true,
    "usage_count": 5,       // Number of events using this type
    "registration_count": 120 // Total registrations with this type across all events
  },
  ...
]
```

### Create Attendee Type
`POST /orgs/:orgId/attendee-types`

**Body:**
```json
{
  "code": "STAFF",
  "name": "Staff Member",
  "color_hex": "#CCCCCC",
  "text_color_hex": "#000000",
  "icon": "user"
}
```

### Update Attendee Type
`PATCH /orgs/:orgId/attendee-types/:id`

**Body:**
```json
{
  "name": "Updated Name",
  "color_hex": "#FFFFFF"
}
```

### Delete Attendee Type
`DELETE /orgs/:orgId/attendee-types/:id`

Soft deletes the attendee type (sets `is_active` to false).

## 📊 Usage Statistics
The API calculates usage statistics in real-time:
- **Usage Count**: The number of events where this attendee type is enabled (`EventAttendeeType` records).
- **Registration Count**: The total number of registrations associated with this attendee type across all events.

## 🎨 UI Implementation
- **List View**: Displays Name, Color, Usage Count, and Registration Count.
- **Icons**: Uses Lucide React icons.
- **Dark Mode**: Fully supported with specific color adaptations.
