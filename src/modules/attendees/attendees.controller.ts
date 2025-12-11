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
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { AttendeesService } from './attendees.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';
import { UpdateAttendeeDto } from './dto/update-attendee.dto';
import { ListAttendeesDto } from './dto/list-attendees.dto';
import {
  AttendeeResponseDto,
  AttendeeListResponseDto,
} from './dto/attendee-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/tenant-context.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ParseBooleanPipe } from './pipes/parse-boolean.pipe';
import { resolveEffectiveOrgId } from '../../common/utils/org-scope.util';
import { resolveAttendeeReadScope } from '../../common/utils/resolve-attendee-scope.util';

@ApiTags('attendees')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
export class AttendeesController {
  constructor(private readonly attendeesService: AttendeesService) {}

  @Post()
  @Permissions('attendees.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or upsert an attendee',
    description:
      'Creates a new attendee or updates an existing one if the email already exists in the organization. Always creates a revision.',
  })
  @ApiBody({ type: CreateAttendeeDto })
  @ApiResponse({
    status: 201,
    description: 'Attendee created or updated successfully',
    type: AttendeeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or cross-organization access denied',
  })
  async create(@Body() createAttendeeDto: CreateAttendeeDto, @Request() req) {
    const canAny = req.authz?.canAttendeesAny === true;
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: createAttendeeDto.orgId,
      allowAny: canAny,
    });
    const userId = req.user.id;
    return this.attendeesService.create(createAttendeeDto, orgId, userId);
  }

  @Get()
  @Permissions('attendees.read')
  @ApiOperation({
    summary: 'List attendees',
    description:
      'Retrieves a paginated list of attendees with optional filters and sorting',
  })
  @ApiQuery({
    name: 'orgId',
    required: false,
    description: 'Organization ID (Super admin only)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'List of attendees retrieved successfully',
    type: AttendeeListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or cross-organization access denied',
  })
  async findAll(@Query() query: ListAttendeesDto, @Request() req) {
    const scope = resolveAttendeeReadScope(req.user);
    
    return this.attendeesService.findAll(query, {
      scope,
      orgId: req.user.org_id,
    });
  }

  @Get(':id')
  @Permissions('attendees.read')
  @ApiOperation({
    summary: 'Get an attendee by ID',
    description: 'Retrieves a single attendee by their ID within the organization',
  })
  @ApiParam({
    name: 'id',
    description: 'Attendee ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendee retrieved successfully',
    type: AttendeeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Attendee not found or not in your organization',
  })
  async findOne(@Param('id') id: string, @Request() req) {
    const scope = resolveAttendeeReadScope(req.user);
    
    return this.attendeesService.findOne(id, {
      scope,
      orgId: req.user.org_id,
    });
  }

  @Get(':id/history')
  @Permissions('attendees.read')
  @ApiOperation({
    summary: 'Get attendee participation history',
    description: 'Retrieves all event participations for an attendee, filtered by email across events. SUPER_ADMIN sees all organizations, others see own organization only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Attendee ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'email',
    description: 'Email to filter cross-event history',
    required: true,
    example: 'user@example.com',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page',
    required: false,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Attendee history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              attendeeId: { type: 'string' },
              eventId: { type: 'string' },
              status: { type: 'string' },
              displayName: { type: 'string' },
              email: { type: 'string' },
              registrationDate: { type: 'string', format: 'date-time' },
              checkedInAt: { type: 'string', format: 'date-time', nullable: true },
              customData: { type: 'object', nullable: true },
              event: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  startDate: { type: 'string', format: 'date-time' },
                  endDate: { type: 'string', format: 'date-time' },
                  location: { type: 'string', nullable: true },
                  status: { type: 'string' },
                  organizationId: { type: 'string' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            pageSize: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Attendee not found or not in your organization',
  })
  async findAttendeeHistory(
    @Param('id') id: string,
    @Query('email') email: string,
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = resolveAttendeeReadScope(req.user);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    
    return this.attendeesService.findAttendeeHistory(id, email, {
      scope,
      orgId: req.user.org_id,
      isSuperAdmin: req.user.roles && Array.isArray(req.user.roles) 
        ? req.user.roles.some(role => role.code === 'SUPER_ADMIN')
        : req.user.role === 'SUPER_ADMIN' || req.user.roleCode === 'SUPER_ADMIN',
    }, pageNum, limitNum);
  }

  // IMPORTANT: Routes spécifiques AVANT routes avec paramètres génériques
  @Delete('bulk-delete')
  @Permissions('attendees.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer plusieurs attendees',
    description: 'Supprime plusieurs attendees par leurs IDs'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des IDs des attendees à supprimer'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Attendees supprimés avec succès',
    schema: {
      type: 'object',
      properties: {
        deletedCount: { type: 'number' }
      }
    }
  })
  async bulkDelete(@Body() body: { ids: string[] }, @Request() req) {
    const canAny = req.authz?.canAttendeesAny === true;
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      allowAny: canAny,
    });
    
    const deletedCount = await this.attendeesService.bulkDelete(body.ids, orgId);
    return { deletedCount };
  }

  @Post('bulk-restore')
  @Permissions('attendees.restore')
  @ApiOperation({ summary: 'Bulk restore soft-deleted attendees' })
  @ApiResponse({ status: 200, description: 'Attendees restored successfully' })
  async bulkRestore(@Body() body: { ids: string[] }, @Request() req) {
    const canAny = req.authz?.canAttendeesAny === true;
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      allowAny: canAny,
    });
    
    const restoredCount = await this.attendeesService.bulkRestore(body.ids, orgId);
    return { restoredCount };
  }

  @Delete('bulk-permanent-delete')
  @Permissions('attendees.permanent-delete')
  @ApiOperation({ summary: 'Permanently delete attendees and all relations' })
  @ApiResponse({ status: 200, description: 'Attendees permanently deleted successfully' })
  async bulkPermanentDelete(@Body() body: { ids: string[] }, @Request() req) {
    const canAny = req.authz?.canAttendeesAny === true;
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      allowAny: canAny,
    });
    
    const deletedCount = await this.attendeesService.bulkPermanentDelete(body.ids, orgId);
    return { deletedCount };
  }

  @Post('bulk-export')
  @Permissions('attendees.read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exporter plusieurs attendees',
    description: 'Exporte plusieurs attendees au format CSV ou Excel'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des IDs des attendees à exporter'
        },
        format: {
          type: 'string',
          enum: ['csv', 'xlsx'],
          default: 'csv',
          description: 'Format d\'export'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Export généré avec succès'
  })
  async bulkExport(
    @Body() body: { ids: string[]; format?: 'csv' | 'xlsx' },
    @Request() req,
    @Res() res: Response
  ) {
    const { ids, format = 'csv' } = body;
    const canAny = req.authz?.canAttendeesAny === true;
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      allowAny: canAny,
    });
    
    const { buffer, filename, mimeType } = await this.attendeesService.bulkExport(ids, format, orgId);
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    
    res.send(buffer);
  }

  // Routes avec paramètres génériques (:id) à la fin
  @Put(':id')
  @Permissions('attendees.update')
  @ApiOperation({
    summary: 'Update an attendee',
    description:
      'Updates an attendee with the provided fields. Creates a revision in the same transaction.',
  })
  @ApiParam({
    name: 'id',
    description: 'Attendee ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateAttendeeDto })
  @ApiResponse({
    status: 200,
    description: 'Attendee updated successfully',
    type: AttendeeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or cross-organization access denied',
  })
  @ApiResponse({
    status: 404,
    description: 'Attendee not found or not in your organization',
  })
  @ApiResponse({
    status: 409,
    description: 'Email conflict with another attendee',
  })
  async update(
    @Param('id') id: string,
    @Body() updateAttendeeDto: UpdateAttendeeDto,
    @Request() req,
  ) {
    const canAny = req.authz?.canAttendeesAny === true;
    // For SUPER_ADMIN, pass undefined to let service find the actual org
    const orgId = canAny ? undefined : resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: updateAttendeeDto.orgId,
      allowAny: canAny,
    });
    const userId = req.user.id;
    return this.attendeesService.update(id, updateAttendeeDto, orgId, userId);
  }

  @Delete(':id')
  @Permissions('attendees.delete')
  @ApiOperation({
    summary: 'Delete an attendee',
    description:
      'Soft deletes an attendee by default (sets is_active=false). With force=true, performs a hard delete if no dependencies exist.',
  })
  @ApiParam({
    name: 'id',
    description: 'Attendee ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'force',
    required: false,
    description: 'Force hard delete (only if no dependencies)',
    example: false,
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Attendee deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Attendee deactivated' },
        deleted: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or cross-organization access denied',
  })
  @ApiResponse({
    status: 404,
    description: 'Attendee not found or not in your organization',
  })
  @ApiResponse({
    status: 409,
    description: 'Cannot hard delete: attendee has dependencies',
  })
  async remove(
    @Param('id') id: string,
    @Query('force', new ParseBooleanPipe()) force: boolean = false,
    @Request() req,
  ) {
    const canAny = req.authz?.canAttendeesAny === true;
    // For SUPER_ADMIN, pass undefined to let service find the actual org
    const orgId = canAny ? undefined : resolveEffectiveOrgId({
      reqUser: req.user,
      allowAny: canAny,
    });
    const userId = req.user.id;
    return this.attendeesService.remove(id, orgId, userId, force);
  }

  @Post(':id/restore')
  @Permissions('attendees.restore')
  @ApiOperation({ summary: 'Restore a soft-deleted attendee' })
  @ApiResponse({ status: 200, description: 'Attendee restored successfully' })
  async restore(@Param('id') id: string, @Request() req) {
    const canAny = req.authz?.canAttendeesAny === true;
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      allowAny: canAny,
    });
    
    return this.attendeesService.restore(id, orgId);
  }

  @Delete(':id/permanent-delete')
  @Permissions('attendees.permanent-delete')
  @ApiOperation({ summary: 'Permanently delete attendee and all relations' })
  @ApiResponse({ status: 200, description: 'Attendee permanently deleted successfully' })
  async permanentDelete(@Param('id') id: string, @Request() req) {
    const canAny = req.authz?.canAttendeesAny === true;
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      allowAny: canAny,
    });
    
    return this.attendeesService.permanentDelete(id, orgId);
  }
}
