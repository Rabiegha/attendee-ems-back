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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
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

  @Put('registrations/:id/status')
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
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: undefined,
      allowAny,
    });

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

  @Patch('registrations/:id')
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
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: undefined,
      allowAny,
    });

    return this.registrationsService.update(id, orgId, updateDto);
  }

  @Delete('registrations/:id')
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
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: undefined,
      allowAny,
    });

    return this.registrationsService.remove(id, orgId);
  }

  @Post('events/:eventId/registrations/bulk-import')
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
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Import summary with created, updated, and skipped counts',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        summary: {
          type: 'object',
          properties: {
            total_rows: { type: 'number' },
            created: { type: 'number' },
            updated: { type: 'number' },
            skipped: { type: 'number' },
            errors: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  row: { type: 'number' },
                  email: { type: 'string' },
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  async bulkImport(
    @Param('eventId') eventId: string, 
    @UploadedFile() file: Express.Multer.File, 
    @Body('autoApprove') autoApprove: string,
    @Request() req
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const canAny = req.authz?.canRegistrationsAny === true;
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      allowAny: canAny,
    });

    const autoApproveBoolean = autoApprove === 'true';

    return this.registrationsService.bulkImport(
      eventId,
      orgId,
      file.buffer,
      autoApproveBoolean,
    );
  }
}
