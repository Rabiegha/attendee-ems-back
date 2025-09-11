import { IsEmail, IsString, IsNotEmpty, IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsUUID()
  role_id: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;
}
