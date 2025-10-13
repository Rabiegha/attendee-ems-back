import { IsEmail, IsString, IsUUID, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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