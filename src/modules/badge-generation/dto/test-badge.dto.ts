import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class TestBadgeDto {
  @ApiProperty({
    example: {
      attendee_name: 'John Doe',
      company: 'Acme Corp',
      job_title: 'Developer',
      email: 'john@acme.com',
      event_name: 'Tech Conference 2024',
      qr_code: 'https://example.com/check-in/12345'
    },
    description: 'Données de test pour remplacer les variables du template'
  })
  @IsObject()
  testData: Record<string, any>;
}