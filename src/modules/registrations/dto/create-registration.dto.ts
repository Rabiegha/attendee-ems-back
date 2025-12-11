import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsString,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AttendeeDataDto } from '../../public/dto/public-register.dto';

export enum AttendanceType {
  ONSITE = 'onsite',
  ONLINE = 'online',
  HYBRID = 'hybrid',
}

// Aligné avec le enum Prisma RegistrationSource
export enum RegistrationSourceDto {
  public_form = 'public_form',
  test_form = 'test_form',
  manual = 'manual',
  import = 'import',
  mobile_app = 'mobile_app',
}

// Enum pour le statut d'inscription
export enum RegistrationStatusDto {
  awaiting = 'awaiting',
  approved = 'approved',
  refused = 'refused',
  cancelled = 'cancelled',
}

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Attendee information', type: AttendeeDataDto })
  @ValidateNested()
  @Type(() => AttendeeDataDto)
  @IsNotEmpty()
  attendee: AttendeeDataDto;

  @ApiProperty({ enum: AttendanceType, description: 'Attendance type' })
  @IsEnum(AttendanceType)
  attendance_type: AttendanceType;

  @ApiPropertyOptional({ description: 'Event attendee type ID' })
  @IsOptional()
  @IsUUID()
  event_attendee_type_id?: string;

  @ApiPropertyOptional({ description: 'Registration form answers (JSON)' })
  @IsOptional()
  answers?: any;

  @ApiPropertyOptional({ 
    enum: RegistrationSourceDto, 
    description: 'Source of registration (public_form, test_form, manual, import)',
    default: 'public_form'
  })
  @IsOptional()
  @IsEnum(RegistrationSourceDto)
  source?: RegistrationSourceDto;

  @ApiPropertyOptional({ description: 'Optional comment from mobile app' })
  @IsOptional()
  @IsString()
  comment?: string;

  // Champs admin uniquement (pour ajout manuel par admin/manager)
  @ApiPropertyOptional({ 
    enum: RegistrationStatusDto,
    description: 'Initial status (admin only)',
    default: 'awaiting'
  })
  @IsOptional()
  @IsEnum(RegistrationStatusDto)
  admin_status?: RegistrationStatusDto;

  @ApiPropertyOptional({ description: 'Is checked in (admin only)', default: false })
  @IsOptional()
  @IsBoolean()
  admin_is_checked_in?: boolean;

  @ApiPropertyOptional({ description: 'Check-in datetime (admin only, ISO 8601)' })
  @IsOptional()
  @IsDateString()
  admin_checked_in_at?: string;

  @ApiPropertyOptional({ description: 'Registration datetime (admin only, ISO 8601)' })
  @IsOptional()
  @IsDateString()
  admin_registered_at?: string;
}
