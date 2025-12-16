import { IsOptional, IsInt, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEventAttendeeTypeDto {
  @ApiPropertyOptional({ description: 'Capacity for this type in this event' })
  @IsOptional()
  @IsInt()
  capacity?: number;

  @ApiPropertyOptional({ description: 'Override color (hex)' })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Invalid hex color' })
  color_hex?: string;

  @ApiPropertyOptional({ description: 'Override text color (hex)' })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Invalid hex color' })
  text_color_hex?: string;
}
