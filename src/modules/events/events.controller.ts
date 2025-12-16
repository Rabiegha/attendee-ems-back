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
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventAttendeeTypeDto } from './dto/update-event-attendee-type.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { ChangeEventStatusDto } from './dto/change-event-status.dto';
import { RegistrationsService } from '../registrations/registrations.service';
import { ListRegistrationsDto } from '../registrations/dto/list-registrations.dto';
import { CreateRegistrationDto } from '../registrations/dto/create-registration.dto';
import { resolveRegistrationReadScope, RegistrationScope } from '../../common/utils/resolve-registration-scope.util';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { resolveEffectiveOrgId } from '../../common/utils/org-scope.util';
import { resolveEventReadScope } from '../../common/utils/resolve-event-scope.util';
import { PrismaService } from '../../infra/db/prisma.service';

@ApiTags('Events')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly registrationsService: RegistrationsService,
    private readonly prisma: PrismaService,
  ) {}

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

  @Get('check-name')
  @Permissions('events.read')
  @ApiOperation({ summary: 'Check if event name is available' })
  @ApiResponse({ status: 200, description: 'Name availability checked' })
  @ApiQuery({ name: 'name', required: true, type: String })
  async checkNameAvailability(@Query('name') name: string, @Request() req) {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Name parameter is required');
    }

    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    
    // Pour les super admins, utiliser leur org_id ou null
    const orgId = allowAny 
      ? req.user.org_id || null
      : resolveEffectiveOrgId({
          reqUser: req.user,
          explicitOrgId: undefined,
          allowAny,
        });

    const isAvailable = await this.eventsService.checkNameAvailability(name, orgId);
    return { available: isAvailable, name };
  }

  @Get()
  @Permissions('events.read')
  @ApiOperation({ summary: 'List all events' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  async findAll(@Query() listEventsDto: ListEventsDto, @Request() req) {
    console.log('GET /events called'); // Debug log
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
    console.log('🔍 UPDATE EVENT DEBUG:', {
      eventId: id,
      userOrgId: req.user.org_id,
      userId: req.user.sub,
      permissions: req.user.permissions?.slice(0, 3),
    });

    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    const orgId = allowAny ? null : resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: undefined,
      allowAny,
    });

    console.log('🔍 RESOLVED ORG ID:', orgId);

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

  @Delete('bulk-delete')
  @Permissions('events.delete')
  @ApiOperation({
    summary: 'Supprimer plusieurs événements',
    description: 'Supprime plusieurs événements par leurs IDs'
  })
  @ApiResponse({
    status: 200,
    description: 'Événements supprimés avec succès',
    schema: {
      type: 'object',
      properties: {
        deletedCount: { type: 'number' }
      }
    }
  })
  async bulkDelete(@Body('ids') ids: string[], @Request() req) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    const orgId = allowAny ? null : req.user.org_id;
    
    const deletedCount = await this.eventsService.bulkDelete(ids, orgId);
    return { deletedCount };
  }

  @Post('bulk-export')
  @Permissions('events.read')
  @ApiOperation({
    summary: 'Exporter plusieurs événements',
    description: 'Exporte plusieurs événements au format CSV ou Excel'
  })
  @ApiResponse({
    status: 200,
    description: 'Export généré avec succès'
  })
  async bulkExport(
    @Body('ids') ids: string[],
    @Body('format') format: 'csv' | 'xlsx' = 'csv',
    @Request() req,
    @Res() res: Response
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    const orgId = allowAny ? null : req.user.org_id;
    
    const { buffer, filename, mimeType } = await this.eventsService.bulkExport(ids, format, orgId);
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    
    res.send(buffer);
  }

  // ========================================
  // REGISTRATIONS ROUTES FOR EVENTS
  // ========================================

  @Post(':eventId/registrations/bulk-import')
  @Permissions('registrations.create')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk import registrations from Excel file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        autoApprove: {
          type: 'boolean',
          description: 'Auto-approve all imported registrations',
        },
        replaceExisting: {
          type: 'boolean',
          description: 'Replace existing registrations instead of skipping them',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Import summary with created, updated, and skipped counts',
  })
  @ApiResponse({ status: 400, description: 'Invalid file or data' })
  async bulkImportRegistrations(
    @Param('eventId') eventId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('autoApprove') autoApprove: string,
    @Body('replaceExisting') replaceExisting: string,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const autoApproveBoolean = autoApprove === 'true' || autoApprove === '1';
    const replaceExistingBoolean = replaceExisting === 'true' || replaceExisting === '1';

    return this.registrationsService.bulkImport(
      eventId,
      req.user.org_id,
      file.buffer,
      autoApproveBoolean,
      replaceExistingBoolean,
    );
  }

  @Get(':eventId/registrations')
  @Permissions('registrations.read')
  @ApiOperation({ summary: 'List registrations for an event' })
  @ApiResponse({ status: 200, description: 'Registrations retrieved successfully' })
  async getEventRegistrations(
    @Param('eventId') eventId: string,
    @Query() listDto: ListRegistrationsDto,
    @Request() req,
  ) {
    const scope = resolveRegistrationReadScope(req.user);
    
    return this.registrationsService.findAll(eventId, listDto, {
      scope,
      orgId: req.user.org_id,
    });
  }

  @Post(':eventId/registrations')
  @Permissions('registrations.create')
  @ApiOperation({ summary: 'Create a registration for an event' })
  @ApiResponse({ status: 201, description: 'Registration created successfully' })
  @ApiResponse({ status: 409, description: 'Event full or duplicate registration' })
  @ApiResponse({ status: 403, description: 'Previously declined' })
  async createEventRegistration(
    @Param('eventId') eventId: string,
    @Body() createDto: CreateRegistrationDto,
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

    return this.registrationsService.create(eventId, orgId, createDto);
  }

  @Get(':eventId/registrations/:id')
  @Permissions('registrations.read')
  @ApiOperation({ summary: 'Get a single registration by ID' })
  @ApiResponse({ status: 200, description: 'Registration retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async getEventRegistration(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    
    const orgId = allowAny ? null : req.user.org_id;

    return this.registrationsService.findOne(eventId, id, orgId);
  }

  @Get(':eventId/check-in-stats')
  // @Permissions('registrations.read') // Temporairement commenté pour test
  @ApiOperation({ summary: 'Get event check-in statistics (total registrations, checked-in count, etc.)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Event check-in statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Total approved registrations' },
        checkedIn: { type: 'number', description: 'Number of checked-in registrations' },
        percentage: { type: 'number', description: 'Check-in percentage' }
      }
    }
  })
  async getEventCheckinStats(
    @Param('eventId') eventId: string,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    
    const orgId = allowAny ? null : req.user.org_id;

    return this.registrationsService.getEventStats(eventId, orgId);
  }

  // Badge generation endpoints
  @Post(':eventId/registrations/generate-badges')
  @Permissions('registrations.read')
  @ApiOperation({ summary: 'Generate badges for all registrations in an event' })
  @ApiResponse({ status: 200, description: 'Badges generated successfully' })
  async generateBadgesForEvent(
    @Param('eventId') eventId: string,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('registrations.') && p.endsWith(':any'),
    );
    
    // Pour SUPER_ADMIN avec permission :any, on passe null pour ignorer la contrainte org_id
    const orgId = allowAny ? null : req.user.org_id;
    
    return this.registrationsService.generateBadgesForEvent(eventId, orgId);
  }

  @Post(':eventId/registrations/generate-badges-bulk')
  @Permissions('registrations.read')
  @ApiOperation({ summary: 'Generate badges for selected registrations' })
  @ApiResponse({ status: 200, description: 'Badges generated successfully' })
  async generateBadgesBulk(
    @Param('eventId') eventId: string,
    @Body() body: { registrationIds: string[] },
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('registrations.') && p.endsWith(':any'),
    );
    const orgId = allowAny ? null : req.user.org_id;
    
    return this.registrationsService.generateBadgesBulk(
      eventId,
      body.registrationIds,
      orgId,
    );
  }

  @Post(':eventId/registrations/:id/generate-badge')
  @Permissions('badges.create')
  @ApiOperation({ summary: 'Generate badge for a single registration' })
  @ApiResponse({ status: 200, description: 'Badge generated successfully' })
  async generateBadge(
    @Param('eventId') eventId: string,
    @Param('id') registrationId: string,
    @Request() req,
  ) {
    const allowAny = req.user.role === 'SUPER_ADMIN' || req.user.permissions?.some((p: string) =>
      p.endsWith(':any')
    );
    const orgId = allowAny ? null : req.user.org_id;
    
    return this.registrationsService.generateBadge(eventId, registrationId, orgId);
  }

  @Get(':eventId/registrations/:id/badge/download')
  @Permissions('registrations.read')
  @ApiOperation({ summary: 'Download badge in specified format' })
  @ApiQuery({ name: 'format', enum: ['pdf', 'image', 'html'], required: false, description: 'Badge format (default: pdf)' })
  @ApiResponse({ status: 200, description: 'Badge downloaded successfully' })
  async downloadBadge(
    @Param('eventId') eventId: string,
    @Param('id') registrationId: string,
    @Query('format') format: 'pdf' | 'image' | 'html' = 'pdf',
    @Request() req,
    @Res() res: Response,
  ) {
    const allowAny = req.user.role === 'SUPER_ADMIN' || req.user.permissions?.some((p: string) =>
      p.endsWith(':any')
    );
    const orgId = allowAny ? null : req.user.org_id;
    const scope = resolveRegistrationReadScope(req.user);
    
    return this.registrationsService.downloadBadge(
      eventId, 
      registrationId, 
      format,
      {
        scope,
        orgId,
      },
      res
    );
  }

  @Post(':eventId/registrations/:id/print-badge')
  @Permissions('registrations.update')
  @ApiOperation({ summary: 'Mark badge as printed for a registration' })
  @ApiResponse({ status: 200, description: 'Badge marked as printed successfully' })
  async markBadgePrinted(
    @Param('eventId') eventId: string,
    @Param('id') registrationId: string,
    @Request() req,
  ) {
    const allowAny = req.user.role === 'SUPER_ADMIN' || req.user.permissions?.some((p: string) =>
      p.endsWith(':any')
    );
    const orgId = allowAny ? null : req.user.org_id;
    
    return this.registrationsService.markBadgePrinted(eventId, registrationId, orgId);
  }

  // =================================================================================================
  // Event Attendee Types
  // =================================================================================================

  @Get(':id/attendee-types')
  @Permissions('events.read')
  @ApiOperation({ summary: 'List attendee types for an event' })
  async getAttendeeTypes(@Param('id') id: string, @Request() req) {
    const orgId = resolveEffectiveOrgId({ reqUser: req.user, explicitOrgId: undefined, allowAny: false });
    return this.eventsService.getAttendeeTypes(id, orgId);
  }

  @Post(':id/attendee-types')
  @Permissions('events.update')
  @ApiOperation({ summary: 'Add an attendee type to an event' })
  @ApiBody({ schema: { type: 'object', properties: { attendeeTypeId: { type: 'string' } } } })
  async addAttendeeType(@Param('id') id: string, @Body('attendeeTypeId') attendeeTypeId: string, @Request() req) {
    const orgId = resolveEffectiveOrgId({ reqUser: req.user, explicitOrgId: undefined, allowAny: false });
    return this.eventsService.addAttendeeType(id, orgId, attendeeTypeId);
  }

  @Put(':id/attendee-types/:typeId')
  @Permissions('events.update')
  @ApiOperation({ summary: 'Update an event attendee type' })
  async updateAttendeeType(
    @Param('id') id: string,
    @Param('typeId') typeId: string,
    @Body() dto: UpdateEventAttendeeTypeDto,
    @Request() req
  ) {
    const orgId = resolveEffectiveOrgId({ reqUser: req.user, explicitOrgId: undefined, allowAny: false });
    return this.eventsService.updateAttendeeType(id, orgId, typeId, dto);
  }

  @Delete(':id/attendee-types/:typeId')
  @Permissions('events.update')
  @ApiOperation({ summary: 'Remove an attendee type from an event' })
  async removeAttendeeType(@Param('id') id: string, @Param('typeId') typeId: string, @Request() req) {
    const orgId = resolveEffectiveOrgId({ reqUser: req.user, explicitOrgId: undefined, allowAny: false });
    return this.eventsService.removeAttendeeType(id, orgId, typeId);
  }
}
