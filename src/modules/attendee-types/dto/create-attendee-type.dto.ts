import { IsNotEmpty, IsString, IsOptional, IsBoolean, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAttendeeTypeDto {
  @ApiProperty({ description: 'Unique code for the attendee type' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z0-9_]+$/, { message: 'Code must contain only lowercase letters, numbers and underscores' })
  code: string;

  @ApiProperty({ description: 'Display name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Background color (hex)' })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Invalid hex color' })
  color_hex?: string;

  @ApiPropertyOptional({ description: 'Text color (hex)' })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Invalid hex color' })
  text_color_hex?: string;

  @ApiPropertyOptional({ description: 'Icon name' })
  @IsOptional()
  @IsString()
  icon?: string;
}
