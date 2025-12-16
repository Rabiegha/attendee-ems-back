import { PartialType } from '@nestjs/swagger';
import { CreateAttendeeTypeDto } from './create-attendee-type.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAttendeeTypeDto extends PartialType(CreateAttendeeTypeDto) {
  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
