import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AttendeeDataDto } from '../../public/dto/public-register.dto';

export enum AttendanceType {
  ONSITE = 'onsite',
  ONLINE = 'online',
  HYBRID = 'hybrid',
}

export enum RegistrationSourceDto {
  PUBLIC_FORM = 'public_form',
  TEST_FORM = 'test_form',
  MANUAL = 'manual',
  IMPORT = 'import',
  MOBILE_APP = 'mobile_app',
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
}
