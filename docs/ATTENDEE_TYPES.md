# 🏷️ Attendee Types Documentation

## Overview
Attendee Types allow organizations to categorize participants (e.g., VIP, Speaker, Staff, Participant). These types are defined at the organization level and can be enabled/configured for specific events.

## 🔄 Recent Changes (Dec 2025)
- **Auto-generated Codes**: The `code` field is now automatically generated from the `name` (slugified). Manual entry has been removed.
- **Name Uniqueness**: Strict uniqueness check on the `name` field within an organization.
- **Real-time Validation**: Added real-time availability checking for names during creation and edition.
- **UI Updates**: Removed "Icon" field. Standardized status display.
- **Permissions**: Creation and modification now require `organizations.update` permission.
- **Event Overrides**: Fixed color propagation in Registrations Table (Event colors > Global colors).

## 🗄️ Database Schema

### `AttendeeType` (Organization Level)
Defines the available types for an organization.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `org_id` | UUID | Foreign Key to Organization |
| `code` | String | **Auto-generated** unique code (e.g., 'vip', 'vip_1') |
| `name` | String | Display name (Must be unique per org) |
| `color_hex` | String | Background color for badges/UI |
| `text_color_hex` | String | Text color for badges/UI |
| `icon` | String | *Deprecated* (Removed from UI) |
| `is_active` | Boolean | Soft delete status |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Update timestamp |

### `EventAttendeeType` (Event Level)
Links an `AttendeeType` to an `Event`, allowing specific configuration per event.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `event_id` | UUID | Foreign Key to Event |
| `org_id` | UUID | Foreign Key to Organization |
| `attendee_type_id` | UUID | Foreign Key to AttendeeType |
| `capacity` | Integer | Optional capacity limit for this type in this event |
| `color_hex` | String | **Override** background color for this event |
| `text_color_hex` | String | **Override** text color for this event |

> **Note**: When displaying registrations, the system prioritizes the `EventAttendeeType` colors. If not set, it falls back to the global `AttendeeType` colors.

## 🔌 API Endpoints

### List Attendee Types
`GET /orgs/:orgId/attendee-types`
*Permission: `organizations.read`*

Returns all attendee types for the organization with usage statistics.

**Response:**
```json
[
  {
    "id": "uuid...",
    "code": "vip",
    "name": "VIP",
    "color_hex": "#FFD700",
    "text_color_hex": "#000000",
    "is_active": true,
    "usage_count": 5,       // Number of events using this type
    "registration_count": 120 // Total registrations with this type across all events
  },
  ...
]
```

### Check Name Availability
`GET /orgs/:orgId/attendee-types/check-name`
*Permission: `organizations.read`*

Checks if a name is available for use.

**Query Params:**
- `name`: The name to check.
- `excludeId` (optional): ID of the type to exclude (for updates).

**Response:**
```json
{
  "available": true,
  "name": "VIP"
}
```

### Create Attendee Type
`POST /orgs/:orgId/attendee-types`
*Permission: `organizations.update`*

**Logic:**
1. Checks if `name` is unique.
2. Auto-generates `code` from `name` (slugify).
3. If `code` exists, appends a counter (e.g., `vip_1`).

**Body:**
```json
{
  "name": "Staff Member",
  "color_hex": "#CCCCCC",
  "text_color_hex": "#000000"
}
```

### Update Attendee Type
`PATCH /orgs/:orgId/attendee-types/:id`
*Permission: `organizations.update`*

**Body:**
```json
{
  "name": "Updated Name",
  "color_hex": "#FFFFFF"
}
```
*Note: Updating the name checks for uniqueness against other types.*

### Delete Attendee Type
`DELETE /orgs/:orgId/attendee-types/:id`
*Permission: `organizations.update`*

Soft deletes the attendee type (sets `is_active` to false).

## 📊 Usage Statistics
The API calculates usage statistics in real-time:
- **Usage Count**: The number of events where this attendee type is enabled (`EventAttendeeType` records).
- **Registration Count**: The total number of registrations associated with this attendee type across all events.

## 🎨 UI Implementation

### Global Management Page
- **List View**: Displays Name, Color Preview, Usage Count, Registration Count, and Status.
- **Status Column**: Visual badges (Green for Active, Red for Inactive).
- **Actions**: Edit and Delete (Soft delete).
- **Permissions**: The "Nouveau type" button is protected by `<Can do="update" on="Organization">`.

### Creation Modal
- **Inputs**: Name, Background Color, Text Color.
- **Validation**: Real-time check for name availability with visual feedback (Spinner -> Green Check/Red X).
- **Removed**: Code input (auto-generated), Icon input.
- **Hook**: Uses `useAttendeeTypeNameAvailability` for debounce and API calls.

### Edit Modal
- **Inputs**: Name, Background Color, Text Color.
- **Read-only**: Code field is displayed but disabled (grayed out).
- **Validation**: Real-time check for name availability (excludes current type).

### Registrations Table
- **Color Logic**: Displays the attendee type badge using the event-specific color overrides if available, otherwise uses the global type color.

