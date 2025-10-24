import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EventStatus } from './create-event.dto';

export class ChangeEventStatusDto {
  @ApiProperty({ enum: EventStatus, description: 'New event status' })
  @IsEnum(EventStatus)
  @IsNotEmpty()
  status: EventStatus;
}
