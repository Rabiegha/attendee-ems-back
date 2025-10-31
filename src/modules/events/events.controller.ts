import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { ChangeEventStatusDto } from './dto/change-event-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { resolveEffectiveOrgId } from '../../common/utils/org-scope.util';
import { resolveEventReadScope } from '../../common/utils/resolve-event-scope.util';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Permissions('events.create')
  @ApiOperation({ summary: 'Create a new event with settings' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 409, description: 'Event code already exists' })
  async create(@Body() createEventDto: CreateEventDto, @Request() req) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: undefined,
      allowAny,
    });

    return this.eventsService.create(createEventDto, orgId, req.user.sub);
  }

  @Get()
  @Permissions('events.read')
  @ApiOperation({ summary: 'List all events' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  async findAll(@Query() listEventsDto: ListEventsDto, @Request() req) {
    const scope = resolveEventReadScope(req.user);
    
    return this.eventsService.findAll(listEventsDto, {
      scope,
      orgId: req.user.org_id,
      userId: req.user.sub,
    });
  }

  @Get(':id')
  @Permissions('events.read')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    const scope = resolveEventReadScope(req.user);
    
    return this.eventsService.findOne(id, {
      scope,
      orgId: req.user.org_id,
      userId: req.user.sub,
    });
  }

  @Get(':id/stats')
  @Permissions('events.read')
  @ApiOperation({ summary: 'Get event statistics' })
  @ApiResponse({ status: 200, description: 'Event stats retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getStats(@Param('id') id: string, @Request() req) {
    const scope = resolveEventReadScope(req.user);
    
    return this.eventsService.getEventStats(id, {
      scope,
      orgId: req.user.org_id,
      userId: req.user.sub,
    });
  }

  @Put(':id')
  @Permissions('events.update')
  @ApiOperation({ summary: 'Update an event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: undefined,
      allowAny,
    });

    return this.eventsService.update(id, updateEventDto, orgId);
  }

  @Delete(':id')
  @Permissions('events.delete')
  @ApiOperation({ summary: 'Delete an event' })
  @ApiResponse({ status: 200, description: 'Event deleted successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete event with registrations' })
  async remove(@Param('id') id: string, @Request() req) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: undefined,
      allowAny,
    });

    return this.eventsService.remove(id, orgId);
  }

  @Put(':id/status')
  @Permissions('events.update')
  @ApiOperation({ summary: 'Change event status' })
  @ApiResponse({ status: 200, description: 'Event status updated successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async changeStatus(
    @Param('id') id: string,
    @Body() changeStatusDto: ChangeEventStatusDto,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: undefined,
      allowAny,
    });

    return this.eventsService.changeStatus(id, changeStatusDto, orgId);
  }
}
