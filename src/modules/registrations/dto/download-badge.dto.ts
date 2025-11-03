import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum BadgeFormat {
  PDF = 'pdf',
  IMAGE = 'image',
  HTML = 'html'
}

export class DownloadBadgeDto {
  @ApiProperty({ 
    enum: BadgeFormat, 
    description: 'Format de téléchargement du badge',
    example: BadgeFormat.PDF 
  })
  @IsEnum(BadgeFormat)
  format: BadgeFormat;
}

export class DownloadBadgeQueryDto {
  @ApiProperty({ 
    enum: BadgeFormat, 
    description: 'Format de téléchargement du badge',
    required: false,
    default: BadgeFormat.PDF
  })
  @IsEnum(BadgeFormat)
  format?: BadgeFormat = BadgeFormat.PDF;
}