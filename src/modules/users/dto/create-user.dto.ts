import { IsEmail, IsString, IsNotEmpty, IsUUID, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email de l\'utilisateur',
    example: 'user@example.com',
    format: 'email'
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Mot de passe de l\'utilisateur',
    example: 'password123',
    minLength: 6
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'ID du rôle assigné à l\'utilisateur',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid'
  })
  @IsUUID()
  role_id: string;

  @ApiPropertyOptional({
    description: 'Prénom de l\'utilisateur',
    example: 'Jean'
  })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Nom de famille de l\'utilisateur',
    example: 'Dupont'
  })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Numéro de téléphone',
    example: '+33123456789'
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Entreprise de l\'utilisateur',
    example: 'ACME Corp'
  })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiPropertyOptional({
    description: 'Poste occupé',
    example: 'Développeur Senior'
  })
  @IsString()
  @IsOptional()
  job_title?: string;

  @ApiPropertyOptional({
    description: 'Pays de résidence',
    example: 'France'
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    description: 'Métadonnées additionnelles',
    example: { preferences: { theme: 'dark' } }
  })
  @IsObject()
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({
    description: 'Statut actif de l\'utilisateur',
    example: true,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;
}
