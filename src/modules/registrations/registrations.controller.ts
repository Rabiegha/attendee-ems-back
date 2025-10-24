import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { ListRegistrationsDto } from './dto/list-registrations.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { resolveEffectiveOrgId } from '../../common/utils/org-scope.util';

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
    const allowAny = req.user.permissions?.some((p: string) =>
      p.startsWith('events.') && p.endsWith(':any'),
    );
    const orgId = resolveEffectiveOrgId({
      reqUser: req.user,
      explicitOrgId: undefined,
      allowAny,
    });

    // TODO: Check event_access for PARTNER/HOSTESS roles
    return this.registrationsService.findAll(eventId, orgId, listDto);
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

  // TODO: Bulk import endpoint
  // @Post('events/:eventId/registrations/bulk-import')
  // @Permissions(['registrations.import'])
  // async bulkImport(@Param('eventId') eventId: string, @UploadedFile() file: Express.Multer.File, @Request() req) {
  //   // Implementation for Excel import
  // }
}
