import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BadgeGenerationService } from './badge-generation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

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
    const orgId = req.user.org_id;
    const userId = req.user.sub;

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
    const orgId = req.user.org_id;
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
   * POST /badges/:id/regenerate
   * Régénère un badge existant
   */
  @Post('badges/:id/regenerate')
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
   * GET /badges/:id
   * Récupère les infos d'un badge
   */
  @Get('badges/:id')
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
   * DELETE /badges/:id
   * Supprime un badge
   */
  @Delete('badges/:id')
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
}
