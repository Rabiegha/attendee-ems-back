import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkUpdateStatusDto {
  @ApiProperty({
    description: 'Array of registration IDs to update',
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({
    description: 'New status for all registrations',
    example: 'approved',
    enum: ['awaiting', 'approved', 'refused', 'cancelled'],
  })
  @IsString()
  status: string;
}
