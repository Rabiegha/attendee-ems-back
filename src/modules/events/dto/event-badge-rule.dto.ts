import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventBadgeRuleDto {
  @IsUUID()
  @IsNotEmpty()
  badgeTemplateId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  attendeeTypeIds: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  priority?: number;
}

export class UpdateEventBadgeRuleDto {
  @IsUUID()
  @IsOptional()
  badgeTemplateId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  attendeeTypeIds?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  priority?: number;
}

export class EventBadgeRuleResponseDto {
  id: string;
  eventId: string;
  badgeTemplateId: string;
  priority: number;
  attendeeTypeIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
