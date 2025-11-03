import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto, SearchTagsDto } from './dto/tag.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PrismaService } from '../../infra/db/prisma.service';

@Controller('tags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TagsController {
  constructor(
    private readonly tagsService: TagsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /tags/search?search=tech
   * Recherche de tags avec autocomplétion
   */
  @Get('search')
  @Permissions('events.read')
  async searchTags(@Request() req, @Query() query: SearchTagsDto) {
    return this.tagsService.searchTags(req.user.org_id, query.search);
  }

  /**
   * GET /tags/statistics
   * Statistiques d'utilisation des tags
   */
  @Get('statistics')
  @Permissions('events.read')
  async getStatistics(@Request() req) {
    return this.tagsService.getTagStatistics(req.user.org_id);
  }

  /**
   * POST /tags
   * Créer un tag manuellement (optionnel)
   */
  @Post()
  @Permissions('events.create')
  async createTag(@Request() req, @Body() dto: CreateTagDto) {
    return this.tagsService.createTag(req.user.org_id, dto);
  }

  /**
   * GET /events/:eventId/tags
   * Récupérer les tags d'un événement
   */
  @Get('events/:eventId')
  @Permissions('events.read')
  async getEventTags(@Request() req, @Param('eventId') eventId: string) {
    return this.tagsService.getEventTags(eventId, req.user.org_id);
  }

  /**
   * PUT /events/:eventId/tags
   * Mettre à jour les tags d'un événement
   */
  @Put('events/:eventId')
  @Permissions('events.update')
  async updateEventTags(
    @Request() req,
    @Param('eventId') eventId: string,
    @Body('tags') tags: string[],
  ) {
    // Récupérer l'org_id de l'événement plutôt que celui de l'utilisateur
    // car un SUPER_ADMIN peut gérer des événements d'autres organisations
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { org_id: true },
    });
    
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    
    return this.tagsService.updateEventTags(eventId, event.org_id, tags);
  }
}
