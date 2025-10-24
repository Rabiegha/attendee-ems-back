import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum RegistrationStatus {
  AWAITING = 'awaiting',
  APPROVED = 'approved',
  REFUSED = 'refused',
  CANCELLED = 'cancelled',
}

export class UpdateRegistrationStatusDto {
  @ApiProperty({ enum: RegistrationStatus, description: 'New registration status' })
  @IsEnum(RegistrationStatus)
  @IsNotEmpty()
  status: RegistrationStatus;
}
