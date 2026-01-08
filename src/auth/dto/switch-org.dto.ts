import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchOrgDto {
  @ApiProperty({
    description: 'ID de l\'organisation vers laquelle switcher',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: 'string',
    format: 'uuid',
  })
  @IsUUID()
  orgId: string;
}
