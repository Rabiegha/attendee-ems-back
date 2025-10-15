import { IsEmail, IsString, IsUUID, IsNotEmpty, MinLength, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export class SendInvitationDto {
  @ApiProperty({
    description: 'Email de la personne à inviter',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'ID du rôle à assigner',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  roleId: string;

  @ApiProperty({
    description: 'ID de l\'organisation',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  orgId: string;

  @ApiProperty({
    description: 'Nom de l\'organisation à créer (optionnel, Super Admin uniquement)',
    example: 'Nouvelle Organisation',
    required: false,
  })
  @IsOptional()
  @IsString()
  organizationName?: string;
}

export class CompleteInvitationDto {
  @ApiProperty({
    description: 'Prénom de l\'utilisateur',
    example: 'Jean',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'Nom de famille de l\'utilisateur',
    example: 'Dupont',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Mot de passe pour le compte',
    example: 'MySecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;
}

export class InvitationResponseDto {
  @ApiProperty({
    description: 'ID unique de l\'invitation',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Email de la personne invitée',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Token d\'invitation',
    example: 'abcd1234567890efgh',
  })
  token: string;

  @ApiProperty({
    description: 'Date d\'expiration de l\'invitation',
    example: '2025-10-16T14:30:00.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'ID de l\'organisation',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  orgId: string;

  @ApiProperty({
    description: 'Nom de l\'organisation',
    example: 'Acme Corp',
  })
  organizationName: string;

  @ApiProperty({
    description: 'ID du rôle assigné',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  roleId: string;

  @ApiProperty({
    description: 'Nom du rôle assigné',
    example: 'Utilisateur',
  })
  roleName: string;

  @ApiProperty({
    description: 'ID de l\'utilisateur qui a envoyé l\'invitation',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  invitedByUserId: string;

  @ApiProperty({
    description: 'Nom complet de l\'utilisateur qui a envoyé l\'invitation',
    example: 'Admin User',
  })
  invitedByUserName: string;

  @ApiProperty({
    description: 'Statut de l\'invitation',
    enum: InvitationStatus,
    example: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @ApiProperty({
    description: 'Date de création de l\'invitation',
    example: '2025-10-14T14:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date de dernière mise à jour',
    example: '2025-10-14T14:30:00.000Z',
  })
  updatedAt: Date;
}

export class GetInvitationsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrer par statut d\'invitation',
    enum: InvitationStatus,
    example: InvitationStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;

  @ApiPropertyOptional({
    description: 'Nombre d\'invitations par page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Nombre d\'invitations à ignorer (pour la pagination)',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class GetInvitationsResponseDto {
  @ApiProperty({
    description: 'Liste des invitations',
    type: [InvitationResponseDto],
  })
  invitations: InvitationResponseDto[];

  @ApiProperty({
    description: 'Nombre total d\'invitations',
    example: 50,
  })
  total: number;

  @ApiProperty({
    description: 'Nombre d\'invitations en attente',
    example: 15,
  })
  pending: number;
}