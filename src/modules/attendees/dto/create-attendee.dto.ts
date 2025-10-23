import { IsEmail, IsOptional, IsString, IsBoolean, IsUUID, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAttendeeDto {
  @ApiPropertyOptional({
    description: 'Organization ID (Super admin only – ignored if user has :own permission)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  orgId?: string;

  @ApiProperty({
    description: 'Email address of the attendee (case-insensitive)',
    example: 'alice@example.com',
  })
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiPropertyOptional({
    description: 'Default type ID for the attendee',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  default_type_id?: string;

  @ApiPropertyOptional({
    description: 'First name of the attendee',
    example: 'Alice',
  })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Last name of the attendee',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the attendee',
    example: '+33612345678',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Company name',
    example: 'ACME Corp',
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({
    description: 'Job title',
    example: 'Software Engineer',
  })
  @IsOptional()
  @IsString()
  job_title?: string;

  @ApiPropertyOptional({
    description: 'Country code or name',
    example: 'FR',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Labels/tags for the attendee',
    example: ['vip', 'speaker'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'VIP guest, requires special access',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Whether the attendee is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: { preferences: { diet: 'vegetarian' } },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
