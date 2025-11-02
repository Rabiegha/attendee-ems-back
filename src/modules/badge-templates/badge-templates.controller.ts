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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BadgeTemplatesService } from './badge-templates.service';
import { CreateBadgeTemplateDto, UpdateBadgeTemplateDto, PreviewBadgeTemplateDto } from './dto/badge-template.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Badge Templates')
@ApiBearerAuth()
@Controller('badge-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BadgeTemplatesController {
  constructor(private readonly badgeTemplatesService: BadgeTemplatesService) {}

  @Post()
  @Permissions('badge-templates.create')
  @ApiOperation({ summary: 'Créer un template de badge (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Template créé avec succès' })
  @ApiResponse({ status: 409, description: 'Un template avec ce nom existe déjà' })
  create(
    @Body() createDto: CreateBadgeTemplateDto,
    @Request() req,
  ) {
    const orgId = req.user.org_id;
    const userId = req.user.sub;
    return this.badgeTemplatesService.create(createDto, orgId, userId);
  }

  @Get()
  @Permissions('badge-templates.read')
  @ApiOperation({ summary: 'Liste des templates de badges (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Liste des templates' })
  findAll(
    @Request() req,
    @Query('eventId') eventId?: string,
    @Query('isActive') isActive?: string,
    @Query('isDefault') isDefault?: string,
    @Query('search') search?: string,
  ) {
    const orgId = req.user.org_id;
    const filters = {
      eventId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isDefault: isDefault === 'true' ? true : isDefault === 'false' ? false : undefined,
      search,
    };

    return this.badgeTemplatesService.findAll(orgId, filters);
  }

  @Get(':id')
  @Permissions('badge-templates.read')
  @ApiOperation({ summary: 'Détails d\'un template (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Détails du template' })
  @ApiResponse({ status: 404, description: 'Template non trouvé' })
  findOne(@Param('id') id: string, @Request() req) {
    const orgId = req.user.org_id;
    return this.badgeTemplatesService.findOne(id, orgId);
  }

  @Put(':id')
  @Permissions('badge-templates.update')
  @ApiOperation({ summary: 'Mettre à jour un template (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Template mis à jour' })
  @ApiResponse({ status: 404, description: 'Template non trouvé' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateBadgeTemplateDto,
    @Request() req,
  ) {
    const orgId = req.user.org_id;
    return this.badgeTemplatesService.update(id, updateDto, orgId);
  }

  @Delete(':id')
  @Permissions('badge-templates.delete')
  @ApiOperation({ summary: 'Supprimer un template (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Template supprimé' })
  @ApiResponse({ status: 400, description: 'Template utilisé, impossible de supprimer' })
  @ApiResponse({ status: 404, description: 'Template non trouvé' })
  remove(@Param('id') id: string, @Request() req) {
    const orgId = req.user.org_id;
    return this.badgeTemplatesService.remove(id, orgId);
  }

  @Post('preview')
  @Permissions('badge-templates.read')
  @ApiOperation({ summary: 'Preview d\'un template avec données de test (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Preview générée' })
  preview(@Body() previewDto: PreviewBadgeTemplateDto) {
    return this.badgeTemplatesService.preview(previewDto);
  }
}
