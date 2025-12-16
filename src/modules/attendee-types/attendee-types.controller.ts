import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { AttendeeTypesService } from './attendee-types.service';
import { CreateAttendeeTypeDto } from './dto/create-attendee-type.dto';
import { UpdateAttendeeTypeDto } from './dto/update-attendee-type.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Attendee Types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('orgs/:orgId/attendee-types')
export class AttendeeTypesController {
  constructor(private readonly attendeeTypesService: AttendeeTypesService) {}

  @Post()
  @Permissions('organizations.update')
  @ApiOperation({ summary: 'Create a new attendee type' })
  create(@Param('orgId') orgId: string, @Body() createAttendeeTypeDto: CreateAttendeeTypeDto) {
    return this.attendeeTypesService.create(orgId, createAttendeeTypeDto);
  }

  @Get()
  @Permissions('organizations.read')
  @ApiOperation({ summary: 'List all attendee types for an organization' })
  findAll(@Param('orgId') orgId: string) {
    return this.attendeeTypesService.findAll(orgId);
  }

  @Get(':id')
  @Permissions('organizations.read')
  @ApiOperation({ summary: 'Get an attendee type by ID' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.attendeeTypesService.findOne(orgId, id);
  }

  @Patch(':id')
  @Permissions('organizations.update')
  @ApiOperation({ summary: 'Update an attendee type' })
  update(@Param('orgId') orgId: string, @Param('id') id: string, @Body() updateAttendeeTypeDto: UpdateAttendeeTypeDto) {
    return this.attendeeTypesService.update(orgId, id, updateAttendeeTypeDto);
  }

  @Delete(':id')
  @Permissions('organizations.update')
  @ApiOperation({ summary: 'Delete an attendee type' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.attendeeTypesService.remove(orgId, id);
  }
}
