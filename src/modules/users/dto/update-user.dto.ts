import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsBoolean, IsUUID, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Email de l\'utilisateur',
    example: 'john.doe@example.com'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Mot de passe (sera hashé automatiquement)',
    example: 'securePassword123',
    minLength: 8
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    description: 'ID du rôle à assigner',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  role_id?: string;

  @ApiPropertyOptional({
    description: 'Prénom',
    example: 'John'
  })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Nom de famille',
    example: 'Doe'
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Numéro de téléphone',
    example: '+33612345678'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Nom de l\'entreprise',
    example: 'Acme Corp'
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({
    description: 'Titre du poste',
    example: 'Software Engineer'
  })
  @IsOptional()
  @IsString()
  job_title?: string;

  @ApiPropertyOptional({
    description: 'Pays',
    example: 'France'
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Métadonnées additionnelles (JSON)',
    example: { preferences: { theme: 'dark' } }
  })
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({
    description: 'Statut d\'activation',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
