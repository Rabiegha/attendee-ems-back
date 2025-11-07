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

// Aligné avec le enum Prisma RegistrationSource
export enum RegistrationSourceDto {
  public_form = 'public_form',
  test_form = 'test_form',
  manual = 'manual',
  import = 'import',
  mobile_app = 'mobile_app',
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
