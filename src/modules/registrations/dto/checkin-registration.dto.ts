import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsObject, IsNumber } from 'class-validator';

export class CheckinLocationDto {
  @ApiProperty({ description: 'Latitude', example: 48.8566 })
  @IsNumber()
  lat: number;

  @ApiProperty({ description: 'Longitude', example: 2.3522 })
  @IsNumber()
  lng: number;
}

export class CheckinRegistrationDto {
  @ApiProperty({ 
    description: 'Event ID for cross-validation (ensures QR code is scanned at correct event)',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  eventId: string;

  @ApiPropertyOptional({ 
    description: 'Check-in location (GPS coordinates)',
    type: CheckinLocationDto
  })
  @IsOptional()
  @IsObject()
  checkinLocation?: CheckinLocationDto;
}
