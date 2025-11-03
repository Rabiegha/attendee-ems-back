import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUUID,
  IsObject,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateBadgeTemplateDto {
  @ApiProperty({ example: 'Badge VIP', description: 'Nom du template' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Template pour les participants VIP' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ 
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID de l\'événement (optionnel pour template global)' 
  })
  @IsUUID()
  @IsOptional()
  event_id?: string;

  @ApiPropertyOptional({ 
    example: '<div class="badge">...</div>',
    description: 'Code HTML du template' 
  })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({ 
    example: '.badge { background: #FF5733; }',
    description: 'CSS du template' 
  })
  @IsString()
  @IsOptional()
  css?: string;

  @ApiPropertyOptional({ example: 400, description: 'Largeur en pixels' })
  @IsInt()
  @Min(100)
  @Max(5000)
  @IsOptional()
  width?: number = 400;

  @ApiPropertyOptional({ example: 600, description: 'Hauteur en pixels' })
  @IsInt()
  @Min(100)
  @Max(5000)
  @IsOptional()
  height?: number = 600;

  @ApiPropertyOptional({ 
    example: { blocks: [], styles: [] },
    description: 'Données GrapesJS complètes pour ré-édition' 
  })
  @IsOptional()
  template_data?: any;

  @ApiPropertyOptional({ 
    example: ['attendee_name', 'company', 'qrcode'],
    description: 'Liste des variables utilisées dans le template' 
  })
  @IsOptional()
  variables?: string[];

  @ApiPropertyOptional({ example: false, description: 'Template par défaut de l\'organisation' })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean = false;

  @ApiPropertyOptional({ example: true, description: 'Template actif/inactif' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;
}

export class UpdateBadgeTemplateDto {
  @ApiPropertyOptional({ example: 'Badge VIP Updated' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Description mise à jour' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '<div>Updated HTML</div>' })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({ example: '.badge { color: blue; }' })
  @IsString()
  @IsOptional()
  css?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsInt()
  @Min(100)
  @Max(5000)
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({ example: 700 })
  @IsInt()
  @Min(100)
  @Max(5000)
  @IsOptional()
  height?: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  template_data?: any;

  @ApiPropertyOptional()
  @IsOptional()
  variables?: string[];

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class PreviewBadgeTemplateDto {
  @ApiProperty({ example: '<div>{{attendee_name}}</div>' })
  @IsString()
  html: string;

  @ApiPropertyOptional({ example: '.badge { color: red; }' })
  @IsString()
  @IsOptional()
  css?: string;

  @ApiProperty({ 
    example: { attendee_name: 'John Doe', company: 'Acme Corp' },
    description: 'Données de test pour remplacer les variables' 
  })
  @IsObject()
  testData: Record<string, any>;
}
