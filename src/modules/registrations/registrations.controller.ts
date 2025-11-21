import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { ListRegistrationsDto } from './dto/list-registrations.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
import { CheckinRegistrationDto } from './dto/checkin-registration.dto';
import { BulkUpdateStatusDto } from './dto/bulk-update-status.dto';
import { BulkCheckInDto } from './dto/bulk-checkin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { resolveEffectiveOrgId } from '../../common/utils/org-scope.util';
import { resolveRegistrationReadScope } from '../../common/utils/resolve-registration-scope.util';

@ApiTags('Registrations')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get('events/:eventId/registrations')
  @Permissions('registrations.read')
  @ApiOperation({ summary: 'List registrations for an event' })
  @ApiResponse({ status: 200, description: 'Registrations retrieved successfully' })
  async findAll(
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

  @Put(':id/status')
  @Permissions('registrations.update')
  @ApiOperation({ summary: 'Update registration status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 403, description: 'HOSTESS role cannot update status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateRegistrationStatusDto,
    @Request() req,
  ) {
    // Check if user is HOSTESS (forbidden to update status)
    const userRole = req.user.role;
    if (userRole === 'HOSTESS') {
      throw new ForbiddenException('HOSTESS role cannot update registration status');
    }

    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    
    // Pour les SUPER_ADMIN avec scope :any, passer null pour permettre l'accès cross-org
    const orgId = allowAny ? null : req.user.org_id;

    return this.registrationsService.updateStatus(id, orgId, updateStatusDto);
  }

  @Post('events/:eventId/registrations')
  @Permissions('registrations.create')
  @ApiOperation({ summary: 'Create a registration with attendee upsert' })
  @ApiResponse({ status: 201, description: 'Registration created successfully' })
  @ApiResponse({ status: 409, description: 'Event full or duplicate registration' })
  @ApiResponse({ status: 403, description: 'Previously declined' })
  async create(
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

  // CRITICAL: bulk-update-status MUST be BEFORE :id route
  @Patch('bulk-update-status')
  @Permissions('registrations.update')
  @ApiOperation({ summary: 'Bulk update registration status' })
  @ApiResponse({ status: 200, description: 'Registrations status updated successfully' })
  @ApiResponse({ status: 403, description: 'HOSTESS role cannot update status' })
  async bulkUpdateStatus(
    @Body() dto: BulkUpdateStatusDto,
    @Request() req,
  ) {
    // Check if user is HOSTESS (forbidden to update status)
    const userRole = req.user.role;
    if (userRole === 'HOSTESS') {
      throw new ForbiddenException('HOSTESS role cannot update registration status');
    }

    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    
    // Pour les SUPER_ADMIN avec scope :any, passer null pour permettre l'accès cross-org
    const orgId = allowAny ? null : req.user.org_id;

    return this.registrationsService.bulkUpdateStatus(dto.ids, orgId, dto.status);
  }

  // CRITICAL: bulk-checkin MUST be BEFORE :id route
  @Post('bulk-checkin')
  @Permissions('registrations.update')
  @ApiOperation({ summary: 'Bulk check-in registrations' })
  @ApiResponse({ status: 200, description: 'Registrations checked-in successfully' })
  async bulkCheckIn(
    @Body() dto: BulkCheckInDto,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    
    // Pour les SUPER_ADMIN avec scope :any, passer null pour permettre l'accès cross-org
    const orgId = allowAny ? null : req.user.org_id;
    const userId = req.user.id;

    return this.registrationsService.bulkCheckIn(dto.ids, orgId, userId);
  }

  @Patch(':id')
  @Permissions('registrations.update')
  @ApiOperation({ summary: 'Update a registration' })
  @ApiResponse({ status: 200, description: 'Registration updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateRegistrationDto>,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    
    // Pour les SUPER_ADMIN avec scope :any, passer null pour permettre l'accès cross-org
    const orgId = allowAny ? null : req.user.org_id;

    return this.registrationsService.update(id, orgId, updateDto);
  }

  // CRITICAL: bulk-delete MUST be BEFORE :id route to avoid NestJS matching ':id' with 'bulk-delete' string
  @Delete('bulk-delete')
  @Permissions('registrations.delete')
  @ApiOperation({ summary: 'Bulk delete registrations' })
  @ApiResponse({ status: 200, description: 'Registrations deleted successfully' })
  async bulkDelete(
    @Body() body: { ids: string[] },
    @Request() req,
  ) {
    const canAny = req.authz?.canRegistrationsAny === true;
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      allowAny: canAny,
    });

    return this.registrationsService.bulkDelete(body.ids, orgId);
  }

  @Delete(':id')
  @Permissions('registrations.delete')
  @ApiOperation({ summary: 'Soft delete a registration' })
  @ApiResponse({ status: 200, description: 'Registration deleted successfully' })
  async remove(
    @Param('id') id: string,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    
    // Pour les SUPER_ADMIN avec scope :any, passer null pour permettre l'accès cross-org
    const orgId = allowAny ? null : req.user.org_id;

    return this.registrationsService.remove(id, orgId);
  }

  @Post(':id/restore')
  @Permissions('registrations.delete')
  @ApiOperation({ summary: 'Restore a soft-deleted registration' })
  @ApiResponse({ status: 200, description: 'Registration restored successfully' })
  async restore(
    @Param('id') id: string,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    
    const orgId = allowAny ? null : req.user.org_id;

    return this.registrationsService.restore(id, orgId);
  }

  @Delete(':id/permanent')
  @Permissions('registrations.delete')
  @ApiOperation({ summary: 'Permanently delete a registration' })
  @ApiResponse({ status: 200, description: 'Registration permanently deleted' })
  async permanentDelete(
    @Param('id') id: string,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    
    const orgId = allowAny ? null : req.user.org_id;

    return this.registrationsService.permanentDelete(id, orgId);
  }

  @Post('bulk-export')
  @Permissions('registrations.read') 
  @ApiOperation({ summary: 'Bulk export registrations' })
  @ApiResponse({ status: 200, description: 'Registrations exported successfully' })
  async bulkExport(
    @Body() body: { ids: string[]; format?: string },
    @Request() req,
    @Res() res: Response,
  ) {
    const canAny = req.authz?.canRegistrationsAny === true;
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      allowAny: canAny,
    });

    const { buffer, filename } = await this.registrationsService.bulkExport(
      body.ids,
      orgId,
      body.format || 'csv'
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':id/qr-code')
  @Permissions('registrations.read')
  @ApiOperation({ summary: 'Generate QR code for a registration (on-the-fly)' })
  @ApiQuery({ name: 'format', required: false, enum: ['png', 'svg', 'base64'], description: 'QR code format' })
  @ApiResponse({ status: 200, description: 'QR code generated successfully' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async getQrCode(
    @Param('id') id: string,
    @Query('format') format: 'png' | 'svg' | 'base64' = 'png',
    @Request() req,
    @Res() res: Response,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('registrations.') && p.endsWith(':any'),
    );
    const orgId = allowAny ? null : req.user.org_id;

    const qrCode = await this.registrationsService.generateQrCode(id, orgId, format);

    if (format === 'base64') {
      return res.json({ qrCode });
    }

    if (format === 'svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(qrCode);
    }

    // PNG by default
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache 1 hour
    return res.send(qrCode);
  }

  @Post(':id/check-in')
  @Permissions('registrations.checkin')
  @ApiOperation({ summary: 'Check-in a registration (scan QR code with event validation)' })
  @ApiResponse({ status: 200, description: 'Registration checked-in successfully' })
  @ApiResponse({ status: 400, description: 'Already checked-in, invalid status, or event mismatch' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async checkIn(
    @Param('id') id: string,
    @Body() checkinDto: CheckinRegistrationDto,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('registrations.') && p.endsWith(':any'),
    );
    const orgId = allowAny ? null : req.user.org_id;

    return this.registrationsService.checkIn(id, orgId, req.user.id, checkinDto);
  }

  @Post(':id/undo-check-in')
  @Permissions('registrations.checkin')
  @ApiOperation({ summary: 'Undo check-in of a registration' })
  @ApiResponse({ status: 200, description: 'Registration check-in undone successfully' })
  @ApiResponse({ status: 400, description: 'Not checked-in or invalid status' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async undoCheckIn(
    @Param('id') id: string,
    @Body() checkinDto: CheckinRegistrationDto,
    @Request() req,
  ) {
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('registrations.') && p.endsWith(':any'),
    );
    const orgId = allowAny ? null : req.user.org_id;

    return this.registrationsService.undoCheckIn(id, orgId, req.user.id, checkinDto);
  }
}

// Routes pour la génération de badges (doivent être dans le EventsController ou un module dédié)
// Temporairement commentées - à déplacer
/*
  @Post('events/:eventId/registrations/generate-badges')
  @Permissions('badges.create')
  @ApiOperation({ summary: 'Generate badges for all registrations in an event' })
  @ApiResponse({ status: 200, description: 'Badges generated successfully' })
  async generateBadgesForEvent(
    @Param('eventId') eventId: string,
    @Request() req,
  ) {
    return this.registrationsService.generateBadgesForEvent(eventId, req.user.org_id);
  }

  @Post('events/:eventId/registrations/generate-badges-bulk')
  @Permissions('badges.create')
  @ApiOperation({ summary: 'Generate badges for selected registrations' })
  @ApiResponse({ status: 200, description: 'Badges generated successfully' })
  async generateBadgesBulk(
    @Param('eventId') eventId: string,
    @Body() body: { registrationIds: string[] },
    @Request() req,
  ) {
    return this.registrationsService.generateBadgesBulk(
      eventId,
      body.registrationIds,
      req.user.org_id,
    );
  }

  @Post('events/:eventId/registrations/:id/generate-badge')
  @Permissions('badges.create')
  @ApiOperation({ summary: 'Generate badge for a single registration' })
  @ApiResponse({ status: 200, description: 'Badge generated successfully' })
  async generateBadge(
    @Param('eventId') eventId: string,
    @Param('id') registrationId: string,
    @Request() req,
  ) {
    return this.registrationsService.generateBadge(eventId, registrationId, req.user.org_id);
  }


}
*/
