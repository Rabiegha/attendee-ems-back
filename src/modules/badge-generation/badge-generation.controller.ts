import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BadgeGenerationService } from './badge-generation.service';
import { TestBadgeDto } from './dto/test-badge.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Badge Generation')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BadgeGenerationController {
  constructor(
    private readonly badgeGenerationService: BadgeGenerationService,
  ) {}

  /**
   * POST /events/:eventId/registrations/:id/generate-badge
   * Génère un badge pour une inscription spécifique
   */
  @Post('events/:eventId/registrations/:id/generate-badge')
  @Permissions('badges.create:org')
  async generateBadge(
    @Param('eventId') eventId: string,
    @Param('id') registrationId: string,
    @Req() req: any,
  ) {
    // Pour SUPER_ADMIN, permettre l'accès à toutes les organisations
    const allowAny = req.user.role === 'SUPER_ADMIN' || req.user.permissions?.some((p: string) =>
      p.endsWith(':any')
    );
    const orgId = allowAny ? null : req.user.org_id;
    const userId = req.user.sub;

    console.log('🔍 BADGE GENERATION DEBUG:', {
      eventId,
      registrationId,
      userRole: req.user.role,
      userOrgId: req.user.org_id,
      allowAny,
      finalOrgId: orgId,
      permissions: req.user.permissions?.filter((p: string) => p.includes('badges'))
    });

    const badge = await this.badgeGenerationService.generateBadge(
      registrationId,
      orgId,
      userId,
    );

    return {
      message: 'Badge generated successfully',
      data: badge,
    };
  }

  /**
   * POST /events/:eventId/generate-badges
   * Génère des badges en masse pour toutes les inscriptions d'un événement
   */
  @Post('events/:eventId/generate-badges')
  @Permissions('badges.create:org')
  async generateBulk(
    @Param('eventId') eventId: string,
    @Query('attendeeTypeId') attendeeTypeId?: string,
    @Query('status') status?: string,
    @Req() req?: any,
  ) {
    // Pour SUPER_ADMIN, permettre l'accès à toutes les organisations
    const allowAny = req.user.role === 'SUPER_ADMIN' || req.user.permissions?.some((p: string) =>
      p.endsWith(':any')
    );
    const orgId = allowAny ? null : req.user.org_id;
    const userId = req.user.sub;

    const result = await this.badgeGenerationService.generateBulk(
      eventId,
      orgId,
      userId,
      {
        attendeeTypeId,
        status,
      },
    );

    return {
      message: `Bulk generation completed: ${result.generated}/${result.total} badges generated`,
      data: result,
    };
  }

  /**
   * POST /badge/:id/regenerate
   * Régénère un badge existant
   */
  @Post('badge/:id/regenerate')
  @Permissions('badges.update:org')
  async regenerateBadge(
    @Param('id') badgeId: string,
    @Req() req: any,
  ) {
    const orgId = req.user.org_id;
    const userId = req.user.sub;

    const badge = await this.badgeGenerationService.regenerateBadge(
      badgeId,
      orgId,
      userId,
    );

    return {
      message: 'Badge regenerated successfully',
      data: badge,
    };
  }

  /**
   * GET /badge/:id
   * Récupère les infos d'un badge
   */
  @Get('badge/:id')
  @Permissions('badges.read:org')
  async getBadge(
    @Param('id') badgeId: string,
    @Req() req: any,
  ) {
    const orgId = req.user.org_id;

    const badge = await this.badgeGenerationService.getBadge(badgeId, orgId);

    return {
      data: badge,
    };
  }

  /**
   * GET /events/:eventId/registrations/:id/badge
   * Récupère le badge d'une inscription
   */
  @Get('events/:eventId/registrations/:id/badge')
  @Permissions('badges.read:org')
  async getBadgeByRegistration(
    @Param('eventId') eventId: string,
    @Param('id') registrationId: string,
    @Req() req: any,
  ) {
    const orgId = req.user.org_id;

    const badge = await this.badgeGenerationService.getBadgeByRegistration(
      registrationId,
      orgId,
    );

    return {
      data: badge,
    };
  }

  /**
   * GET /events/:eventId/registrations/:id/badge-preview
   * Génère une image PNG de preview (avec qualité basse/haute)
   */
  @Get('events/:eventId/registrations/:id/badge-preview')
  @Permissions('badges.read:org')
  async getBadgePreview(
    @Param('eventId') eventId: string,
    @Param('id') registrationId: string,
    @Query('quality') quality: string = 'low', // 'low' ou 'high'
    @Query('templateId') templateId?: string, // Template spécifique à utiliser
    @Query('force') forceRegenerate?: string, // 'true' pour forcer la régénération
    @Req() req?: any,
  ) {
    const allowAny = req.user.role === 'SUPER_ADMIN' || req.user.permissions?.some((p: string) =>
      p.endsWith(':any')
    );
    const orgId = allowAny ? null : req.user.org_id;

    const previewUrl = await this.badgeGenerationService.generateBadgePreview(
      registrationId,
      orgId,
      quality as 'low' | 'high',
      templateId,
      forceRegenerate === 'true',
    );

    return {
      data: {
        previewUrl,
        quality,
      },
    };
  }

  /**
   * POST /badge-templates/:id/test-generate
   * Génère un badge de test avec un template spécifique
   */
  @Post('badge-templates/:id/test-generate')
  @Permissions('badges.create:org')
  @ApiOperation({ summary: 'Générer un badge de test avec un template spécifique' })
  @ApiResponse({ status: 201, description: 'Badge de test généré avec succès' })
  @ApiResponse({ status: 404, description: 'Template non trouvé' })
  async generateTestBadge(
    @Param('id') templateId: string,
    @Body() testDto: TestBadgeDto,
    @Req() req: any,
  ) {
    const orgId = req.user.org_id;
    const userId = req.user.sub;

    const result = await this.badgeGenerationService.generateTestBadge(
      templateId,
      testDto.testData,
      orgId,
      userId,
    );

    return {
      message: 'Test badge generated successfully',
      data: result,
    };
  }

  /**
   * DELETE /badge/:id
   * Supprime un badge
   */
  @Delete('badge/:id')
  @Permissions('badges.delete:org')
  async deleteBadge(
    @Param('id') badgeId: string,
    @Req() req: any,
  ) {
    const orgId = req.user.org_id;

    await this.badgeGenerationService.deleteBadge(badgeId, orgId);

    return {
      message: 'Badge deleted successfully',
    };
  }

  /**
   * GET /events/:eventId/badges/pdf
   * Génère un PDF avec tous les badges de l'événement
   */
  @Get('events/:eventId/badges/pdf')
  @Permissions('badges.read:org')
  @ApiOperation({ summary: 'Générer un PDF avec tous les badges de l\'événement' })
  @ApiResponse({ 
    status: 200, 
    description: 'PDF généré avec succès',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async generateEventBadgesPDF(
    @Param('eventId') eventId: string,
    @Query('attendeeTypeId') attendeeTypeId?: string,
    @Query('status') status?: string,
    @Req() req?: any,
    @Res() res?: any,
  ) {
    // Pour SUPER_ADMIN, permettre l'accès à toutes les organisations
    const allowAny = req.user.role === 'SUPER_ADMIN' || req.user.permissions?.some((p: string) =>
      p.endsWith(':any')
    );
    const orgId = allowAny ? null : req.user.org_id;

    const pdfBuffer = await this.badgeGenerationService.generateEventBadgesPDF(
      eventId,
      orgId,
      {
        attendeeTypeId,
        status,
      },
    );

    // Retourner le PDF directement
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="badges-${eventId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  }
}
