import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(7) // Format #RRGGBB
  color?: string;
}

export class SearchTagsDto {
  @IsOptional()
  @IsString()
  search?: string;
}
