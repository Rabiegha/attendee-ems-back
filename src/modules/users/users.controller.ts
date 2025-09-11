import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('users.create')
  async create(@Body() createUserDto: CreateUserDto, @Request() req) {
    const orgId = req.user.org_id;
    return this.usersService.create(createUserDto, orgId);
  }

  @Get()
  @Permissions('users.read')
  async findAll(
    @Request() req,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('q') search?: string,
  ) {
    const orgId = req.user.org_id;
    return this.usersService.findAll(orgId, page, limit, search);
  }
}
