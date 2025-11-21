import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkCheckInDto {
  @ApiProperty({
    description: 'Array of registration IDs to check-in',
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];
}
