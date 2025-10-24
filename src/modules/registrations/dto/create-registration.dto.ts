import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AttendeeDataDto } from '../../public/dto/public-register.dto';

export enum AttendanceType {
  ONSITE = 'onsite',
  ONLINE = 'online',
  HYBRID = 'hybrid',
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
}
