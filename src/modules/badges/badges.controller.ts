import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Query, Request } from '@nestjs/common';
import { BadgesService } from './badges.service';
import { CreateBadgeTemplateDto, UpdateBadgeTemplateDto, DuplicateBadgeTemplateDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/tenant-context.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('badges')
@ApiBearerAuth()
@Controller('badges')
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get('templates')
  @Permissions('badges.read')
  async getTemplates(
    @Request() req,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ) {
    const orgId = req.user.org_id;
    return this.badgesService.getTemplates(orgId, {
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  }

  @Get('templates/:id')
  @Permissions('badges.read')
  async getTemplate(
    @Request() req,
    @Param('id') id: string
  ) {
    const orgId = req.user.org_id;
    return this.badgesService.getTemplate(id, orgId);
  }

  @Post('templates')
  @Permissions('badges.create')
  async createTemplate(
    @Request() req,
    @Body() createDto: CreateBadgeTemplateDto
  ) {
    const orgId = req.user.org_id;
    const userId = req.user.id || req.user.sub;
    return this.badgesService.createTemplate(createDto, orgId, userId);
  }

  @Put('templates/:id')
  @Permissions('badges.update')
  async updateTemplate(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateBadgeTemplateDto
  ) {
    const orgId = req.user.org_id;
    return this.badgesService.updateTemplate(id, updateDto, orgId);
  }

  @Delete('templates/:id')
  @Permissions('badges.delete')
  async deleteTemplate(
    @Request() req,
    @Param('id') id: string
  ) {
    const orgId = req.user.org_id;
    return this.badgesService.deleteTemplate(id, orgId);
  }

  @Post('templates/:id/duplicate')
  @Permissions('badges.create')
  async duplicateTemplate(
    @Request() req,
    @Param('id') id: string,
    @Body() duplicateDto: DuplicateBadgeTemplateDto
  ) {
    const orgId = req.user.org_id;
    const userId = req.user.id || req.user.sub;
    return this.badgesService.duplicateTemplate(id, duplicateDto, orgId, userId);
  }

  @Get('templates/:id/preview')
  @Permissions('badges.read')
  async previewTemplate(
    @Request() req,
    @Param('id') id: string,
    @Query('attendeeId') attendeeId?: string
  ) {
    const orgId = req.user.org_id;
    return this.badgesService.previewTemplate(id, orgId, attendeeId);
  }
}