import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  IsUUID,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum LocationType {
  PHYSICAL = 'physical',
  ONLINE = 'online',
  HYBRID = 'hybrid',
}

export enum AttendanceMode {
  ONSITE = 'onsite',
  ONLINE = 'online',
  HYBRID = 'hybrid',
}

export class CreateEventDto {
  @ApiProperty({ description: 'Event code (unique per organization)', example: 'CONF2024' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Event name', example: 'Tech Conference 2024' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Event start date and time', example: '2024-12-01T09:00:00Z' })
  @IsDateString()
  start_at: string;

  @ApiProperty({ description: 'Event end date and time', example: '2024-12-01T18:00:00Z' })
  @IsDateString()
  end_at: string;

  @ApiPropertyOptional({ description: 'Timezone', example: 'Europe/Paris', default: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ enum: EventStatus, default: EventStatus.DRAFT })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'Event capacity (max attendees)', example: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity?: number;

  @ApiPropertyOptional({ enum: LocationType, default: LocationType.PHYSICAL })
  @IsOptional()
  @IsEnum(LocationType)
  location_type?: LocationType;

  @ApiPropertyOptional({ description: 'Activity sector ID' })
  @IsOptional()
  @IsUUID()
  org_activity_sector_id?: string;

  @ApiPropertyOptional({ description: 'Event type ID' })
  @IsOptional()
  @IsUUID()
  org_event_type_id?: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Formatted address' })
  @IsOptional()
  @IsString()
  address_formatted?: string;

  @ApiPropertyOptional({ description: 'Street address' })
  @IsOptional()
  @IsString()
  address_street?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  address_city?: string;

  @ApiPropertyOptional({ description: 'Region/State' })
  @IsOptional()
  @IsString()
  address_region?: string;

  @ApiPropertyOptional({ description: 'Postal code' })
  @IsOptional()
  @IsString()
  address_postal_code?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  address_country?: string;

  @ApiPropertyOptional({ description: 'Latitude', example: 48.856614 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 2.352222 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Google Place ID' })
  @IsOptional()
  @IsString()
  place_id?: string;

  // Event Settings (embedded in creation)
  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsString()
  website_url?: string;

  @ApiPropertyOptional({ enum: AttendanceMode, default: AttendanceMode.ONSITE })
  @IsOptional()
  @IsEnum(AttendanceMode)
  attendance_mode?: AttendanceMode;

  @ApiPropertyOptional({ description: 'Auto-approve registrations', default: false })
  @IsOptional()
  @IsBoolean()
  registration_auto_approve?: boolean;

  @ApiPropertyOptional({ description: 'Allow check-in/out', default: true })
  @IsOptional()
  @IsBoolean()
  allow_checkin_out?: boolean;

  @ApiPropertyOptional({ description: 'Enable event reminders', default: false })
  @IsOptional()
  @IsBoolean()
  has_event_reminder?: boolean;

  @ApiPropertyOptional({ description: 'Registration form fields (JSON)' })
  @IsOptional()
  registration_fields?: any;

  @ApiPropertyOptional({ description: 'Submit button text', example: "S'inscrire" })
  @IsOptional()
  @IsString()
  submit_button_text?: string;

  @ApiPropertyOptional({ description: 'Submit button color (hex)', example: '#4F46E5' })
  @IsOptional()
  @IsString()
  submit_button_color?: string;

  @ApiPropertyOptional({ description: 'Show event title in public form', default: true })
  @IsOptional()
  @IsBoolean()
  show_title?: boolean;

  @ApiPropertyOptional({ description: 'Show event description in public form', default: true })
  @IsOptional()
  @IsBoolean()
  show_description?: boolean;

  @ApiPropertyOptional({ description: 'Auto transition to active', default: true })
  @IsOptional()
  @IsBoolean()
  auto_transition_to_active?: boolean;

  @ApiPropertyOptional({ description: 'Auto transition to completed', default: true })
  @IsOptional()
  @IsBoolean()
  auto_transition_to_completed?: boolean;

  @ApiPropertyOptional({ description: 'Array of user IDs to assign to this event', type: [String] })
  @IsOptional()
  @IsUUID('4', { each: true })
  assigned_user_ids?: string[];
}
