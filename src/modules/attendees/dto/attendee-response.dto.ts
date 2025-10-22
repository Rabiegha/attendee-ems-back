import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttendeeResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  org_id: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  default_type_id?: string;

  @ApiProperty({ example: 'alice@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 'Alice' })
  first_name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  last_name?: string;

  @ApiPropertyOptional({ example: '+33612345678' })
  phone?: string;

  @ApiPropertyOptional({ example: 'ACME Corp' })
  company?: string;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  job_title?: string;

  @ApiPropertyOptional({ example: 'FR' })
  country?: string;

  @ApiPropertyOptional({ example: { preferences: { diet: 'vegetarian' } } })
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: ['vip', 'speaker'], type: [String] })
  labels?: string[];

  @ApiPropertyOptional({ example: 'VIP guest' })
  notes?: string;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  updated_at: Date;
}

export class AttendeeListMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

export class AttendeeListResponseDto {
  @ApiProperty({ type: [AttendeeResponseDto] })
  data: AttendeeResponseDto[];

  @ApiProperty({ type: AttendeeListMetaDto })
  meta: AttendeeListMetaDto;
}
