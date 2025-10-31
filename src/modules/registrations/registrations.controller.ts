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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { ListRegistrationsDto } from './dto/list-registrations.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
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
  @ApiOperation({ summary: 'Delete a registration' })
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
}
