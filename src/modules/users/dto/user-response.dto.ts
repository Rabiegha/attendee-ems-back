import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'ID unique de l\'utilisateur',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  id: string;

  @ApiProperty({
    description: 'Email de l\'utilisateur',
    example: 'user@example.com'
  })
  email: string;

  @ApiPropertyOptional({
    description: 'Prénom de l\'utilisateur',
    example: 'Jean'
  })
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Nom de famille de l\'utilisateur',
    example: 'Dupont'
  })
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Numéro de téléphone',
    example: '+33123456789'
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Entreprise de l\'utilisateur',
    example: 'ACME Corp'
  })
  company?: string;

  @ApiPropertyOptional({
    description: 'Poste occupé',
    example: 'Développeur Senior'
  })
  job_title?: string;

  @ApiPropertyOptional({
    description: 'Pays de résidence',
    example: 'France'
  })
  country?: string;

  @ApiProperty({
    description: 'Statut actif de l\'utilisateur',
    example: true
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Date de création',
    example: '2023-10-08T15:30:00.000Z'
  })
  created_at: Date;

  @ApiProperty({
    description: 'Date de dernière mise à jour',
    example: '2023-10-08T15:30:00.000Z'
  })
  updated_at: Date;

  @ApiProperty({
    description: 'ID de l\'organisation',
    example: '550e8400-e29b-41d4-a716-446655440001'
  })
  org_id: string;

  @ApiProperty({
    description: 'ID du rôle',
    example: '550e8400-e29b-41d4-a716-446655440002'
  })
  role_id: string;
}

export class UsersListResponseDto {
  @ApiProperty({
    description: 'Liste des utilisateurs',
    type: [UserResponseDto]
  })
  users: UserResponseDto[];

  @ApiProperty({
    description: 'Nombre total d\'utilisateurs',
    example: 25
  })
  total: number;

  @ApiProperty({
    description: 'Page actuelle',
    example: 1
  })
  page: number;

  @ApiProperty({
    description: 'Nombre d\'éléments par page',
    example: 10
  })
  limit: number;

  @ApiProperty({
    description: 'Nombre total de pages',
    example: 3
  })
  totalPages: number;
}
