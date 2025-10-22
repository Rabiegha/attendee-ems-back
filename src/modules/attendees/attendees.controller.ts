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
} from '@nestjs/common';
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
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ParseBooleanPipe } from './pipes/parse-boolean.pipe';

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
    description: 'Insufficient permissions',
  })
  async create(@Body() createAttendeeDto: CreateAttendeeDto, @Request() req) {
    const orgId = req.user.org_id;
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
    description: 'Insufficient permissions',
  })
  async findAll(@Query() query: ListAttendeesDto, @Request() req) {
    const orgId = req.user.org_id;
    return this.attendeesService.findAll(query, orgId);
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
    description: 'Attendee not found',
  })
  async findOne(@Param('id') id: string, @Request() req) {
    const orgId = req.user.org_id;
    return this.attendeesService.findOne(id, orgId);
  }

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
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Attendee not found',
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
    const orgId = req.user.org_id;
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
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Attendee not found',
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
    const orgId = req.user.org_id;
    const userId = req.user.id;
    return this.attendeesService.remove(id, orgId, userId, force);
  }
}
