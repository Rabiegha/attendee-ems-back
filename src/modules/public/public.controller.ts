import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PublicService } from './public.service';
import { PublicRegisterDto } from './dto/public-register.dto';

@ApiTags('Public')
@Controller('public/events')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':publicToken')
  @ApiOperation({ summary: 'Get event information by public token (no auth required)' })
  @ApiResponse({ status: 200, description: 'Event information retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEvent(@Param('publicToken') publicToken: string) {
    return this.publicService.getEventByPublicToken(publicToken);
  }

  @Get(':publicToken/attendee-types')
  @ApiOperation({ summary: 'Get event attendee types by public token (no auth required)' })
  @ApiResponse({ status: 200, description: 'Event attendee types retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventAttendeeTypes(@Param('publicToken') publicToken: string) {
    return this.publicService.getEventAttendeeTypesByPublicToken(publicToken);
  }

  @Post(':publicToken/register')
  @ApiOperation({ summary: 'Register to an event (no auth required)' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 409, description: 'Event is full or already registered' })
  @ApiResponse({ status: 403, description: 'Registration declined or event not open' })
  async register(
    @Param('publicToken') publicToken: string,
    @Body() registerDto: PublicRegisterDto,
  ) {
    return this.publicService.registerToEvent(publicToken, registerDto);
  }
}
