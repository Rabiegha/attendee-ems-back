import { IsEmail, IsNotEmpty, IsString, IsUUID, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetDto {
  @ApiProperty({
    description: 'Email de l\'utilisateur',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'ID de l\'organisation (optionnel, déprécié)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  org_id?: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token de réinitialisation',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Nouveau mot de passe (minimum 8 caractères)',
    example: 'NewSecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @IsNotEmpty()
  newPassword: string;
}

export class ValidateResetTokenDto {
  @ApiProperty({
    description: 'Token de réinitialisation à valider',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
