import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateBadgeTemplateDto, UpdateBadgeTemplateDto, PreviewBadgeTemplateDto } from './dto/badge-template.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BadgeTemplatesService {
  private readonly logger = new Logger(BadgeTemplatesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Créer un nouveau template de badge
   */
  async create(dto: CreateBadgeTemplateDto, orgId: string, userId: string) {
    // Générer un code unique basé sur le nom
    const code = this.generateCode(dto.name);

    // Vérifier si un template avec ce code existe déjà
    const existing = await this.prisma.badgeTemplate.findUnique({
      where: {
        org_id_code: {
          org_id: orgId,
          code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Un template avec ce nom existe déjà`);
    }

    // Si is_default = true, désactiver les autres templates par défaut
    if (dto.is_default) {
      await this.unsetDefaultTemplates(orgId, dto.event_id);
    }

    // Créer le template
    return this.prisma.badgeTemplate.create({
      data: {
        org_id: orgId,
        event_id: dto.event_id || null,
        code,
        name: dto.name,
        description: dto.description,
        html: dto.html,
        css: dto.css,
        width: dto.width || 400,
        height: dto.height || 600,
        template_data: dto.template_data || Prisma.JsonNull,
        variables: dto.variables || Prisma.JsonNull,
        is_default: dto.is_default || false,
        is_active: dto.is_active !== undefined ? dto.is_active : true,
        created_by: userId,
        usage_count: 0,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  /**
   * Liste des templates avec filtres
   */
  async findAll(
    orgId: string,
    filters?: {
      eventId?: string;
      isActive?: boolean;
      isDefault?: boolean;
      search?: string;
    },
  ) {
    const where: Prisma.BadgeTemplateWhereInput = {
      org_id: orgId,
    };

    if (filters?.eventId) {
      where.event_id = filters.eventId;
    }

    if (filters?.isActive !== undefined) {
      where.is_active = filters.isActive;
    }

    if (filters?.isDefault !== undefined) {
      where.is_default = filters.isDefault;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.badgeTemplate.findMany({
      where,
      include: {
        event: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { is_default: 'desc' },
        { usage_count: 'desc' },
        { created_at: 'desc' },
      ],
    });
  }

  /**
   * Récupérer un template par ID
   */
  async findOne(id: string, orgId: string) {
    const template = await this.prisma.badgeTemplate.findFirst({
      where: {
        id,
        org_id: orgId,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template de badge non trouvé`);
    }

    return template;
  }

  /**
   * Mettre à jour un template
   */
  async update(id: string, dto: UpdateBadgeTemplateDto, orgId: string) {
    const template = await this.findOne(id, orgId);

    // Si on active is_default, désactiver les autres
    if (dto.is_default && !template.is_default) {
      await this.unsetDefaultTemplates(orgId, template.event_id);
    }

    return this.prisma.badgeTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        html: dto.html,
        css: dto.css,
        width: dto.width,
        height: dto.height,
        template_data: dto.template_data !== undefined ? dto.template_data : undefined,
        variables: dto.variables !== undefined ? dto.variables : undefined,
        is_default: dto.is_default,
        is_active: dto.is_active,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  /**
   * Supprimer un template
   */
  async remove(id: string, orgId: string) {
    const template = await this.findOne(id, orgId);

    // Vérifier si le template est utilisé
    if (template.usage_count > 0) {
      throw new BadRequestException(
        `Ce template est utilisé par ${template.usage_count} badge(s) et ne peut pas être supprimé`,
      );
    }

    await this.prisma.badgeTemplate.delete({
      where: { id },
    });

    return { message: 'Template supprimé avec succès' };
  }

  /**
   * Preview d'un template avec données de test
   */
  async preview(dto: PreviewBadgeTemplateDto) {
    let renderedHtml = dto.html;
    let renderedCss = dto.css || '';

    // Remplacer les variables par les données de test
    Object.entries(dto.testData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      renderedHtml = renderedHtml.replace(regex, String(value));
      renderedCss = renderedCss.replace(regex, String(value));
    });

    // Créer un HTML complet pour la preview
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            ${renderedCss}
          </style>
        </head>
        <body>
          ${renderedHtml}
        </body>
      </html>
    `;

    // Encoder en base64 pour data URL
    const base64Html = Buffer.from(fullHtml).toString('base64');

    return {
      renderedHtml,
      renderedCss,
      previewUrl: `data:text/html;base64,${base64Html}`,
      fullHtml,
    };
  }

  /**
   * Génère un PDF de test pour un template avec des données d'exemple
   */
  async generateTestBadge(id: string, orgId: string, testData: Record<string, any>) {
    const template = await this.findOne(id, orgId);

    if (!template.html) {
      throw new BadRequestException('Ce template n\'a pas de contenu HTML');
    }

    // Remplacer les variables dans le HTML et CSS
    let renderedHtml = template.html;
    let renderedCss = template.css || '';

    Object.entries(testData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      renderedHtml = renderedHtml.replace(regex, String(value));
      renderedCss = renderedCss.replace(regex, String(value));
    });

    // HTML complet pour Puppeteer
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              width: ${template.width}px; 
              height: ${template.height}px;
              overflow: hidden;
            }
            ${renderedCss}
          </style>
        </head>
        <body>
          ${renderedHtml}
        </body>
      </html>
    `;

    return {
      html: fullHtml,
      renderedHtml,
      renderedCss,
      width: template.width,
      height: template.height
    };
  }

  /**
   * Incrémenter le compteur d'utilisation
   */
  async incrementUsage(id: string) {
    await this.prisma.badgeTemplate.update({
      where: { id },
      data: {
        usage_count: { increment: 1 },
      },
    });
  }

  /**
   * Désactiver tous les templates par défaut (sauf celui en cours)
   */
  private async unsetDefaultTemplates(orgId: string, eventId?: string) {
    await this.prisma.badgeTemplate.updateMany({
      where: {
        org_id: orgId,
        event_id: eventId || null,
        is_default: true,
      },
      data: {
        is_default: false,
      },
    });
  }

  /**
   * Générer un code unique à partir du nom
   */
  private generateCode(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
      .replace(/[^a-z0-9]+/g, '-') // Remplacer caractères spéciaux par -
      .replace(/^-+|-+$/g, '') // Enlever - au début/fin
      .substring(0, 50); // Limiter la longueur
  }
}
