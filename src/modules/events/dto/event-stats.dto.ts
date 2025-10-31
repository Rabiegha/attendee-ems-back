import { ApiProperty } from '@nestjs/swagger';

export class EventStatsDto {
  @ApiProperty({ description: 'Total number of registrations', example: 150 })
  totalRegistrations: number;

  @ApiProperty({ description: 'Number of checked-in registrations', example: 120 })
  checkedIn: number;

  @ApiProperty({ description: 'Number of approved registrations', example: 140 })
  approved: number;

  @ApiProperty({ description: 'Number of pending registrations', example: 10 })
  pending: number;

  @ApiProperty({ description: 'Number of cancelled registrations', example: 5 })
  cancelled: number;

  @ApiProperty({ description: 'Percentage of checked-in attendees', example: 80 })
  checkedInPercentage: number;
}
