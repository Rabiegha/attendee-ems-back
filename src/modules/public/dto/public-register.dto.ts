import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum AttendanceType {
  ONSITE = 'onsite',
  ONLINE = 'online',
  HYBRID = 'hybrid',
}

export class AttendeeDataDto {
  @ApiProperty({ description: 'Email address', example: 'corentin@example.com' })
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiPropertyOptional({ description: 'First name', example: 'Corentin' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Kistler' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+33601020304' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Company name', example: 'MyCompany' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ description: 'Job title', example: 'CTO' })
  @IsOptional()
  @IsString()
  job_title?: string;

  @ApiPropertyOptional({ description: 'Country code', example: 'FR' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class PublicRegisterDto {
  @ApiProperty({ description: 'Attendee information', type: AttendeeDataDto })
  @IsNotEmpty()
  attendee: AttendeeDataDto;

  @ApiProperty({ enum: AttendanceType, description: 'Attendance type', default: AttendanceType.ONSITE })
  @IsEnum(AttendanceType)
  attendance_type: AttendanceType;

  @ApiPropertyOptional({ description: 'Event attendee type ID' })
  @IsOptional()
  @IsUUID()
  event_attendee_type_id?: string;

  @ApiPropertyOptional({ description: 'Registration form answers (JSON)' })
  @IsOptional()
  answers?: any;
}
