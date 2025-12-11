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

    // Si template_data est fourni, vider html/css pour forcer la régénération depuis template_data
    const shouldClearHtmlCss = dto.template_data !== undefined;

    return this.prisma.badgeTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        html: shouldClearHtmlCss ? '' : dto.html,
        css: shouldClearHtmlCss ? '' : dto.css,
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

    // Vérifier si le template est utilisé dans EventSettings
    const usedInSettings = await this.prisma.eventSetting.count({
      where: {
        badge_template_id: id,
        org_id: orgId,
      },
    });

    if (usedInSettings > 0) {
      throw new BadRequestException(
        `Ce template est assigné à ${usedInSettings} événement(s). Veuillez d'abord le retirer de ces événements.`,
      );
    }

    // Vérifier si le template est utilisé dans des badges générés
    const usedInBadges = await this.prisma.badge.count({
      where: {
        badge_template_id: id,
        org_id: orgId,
      },
    });

    if (usedInBadges > 0) {
      this.logger.warn(`Template ${id} has ${usedInBadges} generated badges but will be deleted`);
      // On permet la suppression même si des badges existent, car ils gardent le PDF/Image
    }

    await this.prisma.badgeTemplate.delete({
      where: { id },
    });

    this.logger.log(`Template ${id} deleted successfully`);
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

    let renderedHtml = template.html || '';
    let renderedCss = template.css || '';

    // Si html/css sont vides, générer depuis template_data
    if (!renderedHtml || !renderedCss) {
      const generated = this.generateHTMLFromTemplateData(template);
      if (!renderedHtml) renderedHtml = generated.html;
      if (!renderedCss) renderedCss = generated.css;
    }

    if (!renderedHtml) {
      throw new BadRequestException('Ce template n\'a pas de contenu HTML et ne peut pas être généré');
    }

    // Remplacer les variables dans le HTML et CSS
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
   * Génère le HTML et CSS depuis template_data si html/css sont vides
   * (Dupliqué depuis BadgeGenerationService pour éviter dépendance circulaire)
   */
  private generateHTMLFromTemplateData(badgeTemplate: any): { html: string; css: string } {
    try {
      const templateData = badgeTemplate.template_data as any;
      
      if (!templateData || !templateData.elements) {
        return { html: '', css: '' };
      }

      const elements = templateData.elements;
      const background = templateData.background;
      
      // Generate HTML
      let html = '<div class="badge-container">\n';
      
      elements.forEach((el: any) => {
        if (el.type === 'text') {
          const content = el.content || '';
          html += `  <div class="element element-${el.id}">${content}</div>\n`;
        } else if (el.type === 'image') {
          html += `  <div class="element element-${el.id}"><img src="{{photo_url}}" alt="Photo" /></div>\n`;
        } else if (el.type === 'qrcode' || el.type === 'qr') {
          html += `  <div class="element element-${el.id}"><img src="{{qr_code_url}}" alt="QR Code" style="width: 100%; height: 100%; object-fit: contain;" /></div>\n`;
        }
      });
      
      html += '</div>';
      
      // Generate CSS
      const badgeWidth = badgeTemplate.width;
      const badgeHeight = badgeTemplate.height;
      
      let css = `.badge-container {
  position: relative;
  width: ${badgeWidth}px;
  height: ${badgeHeight}px;
  ${background ? `background: ${background.startsWith('http') || background.startsWith('data:') ? `url(${background})` : background};` : 'background: #ffffff;'}
  background-size: cover;
  background-position: center;
  overflow: hidden;
}\n\n`;

      css += `.element {
  position: absolute;
  box-sizing: border-box;
}\n\n`;

      css += `.element img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}\n\n`;

      elements.forEach((el: any) => {
        const style = el.style || {};
        
        css += `.element-${el.id} {
  left: ${el.x}px;
  top: ${el.y}px;
  width: ${el.width || 'auto'}px;
  height: ${el.height || 'auto'}px;`;
        
        if (el.type === 'text') {
          css += `\n  font-size: ${style.fontSize || el.fontSize || 16}px;
  font-weight: ${style.fontWeight || el.fontWeight || 'normal'};
  font-style: ${style.fontStyle || el.fontStyle || 'normal'};
  text-align: ${style.textAlign || el.textAlign || 'left'};
  color: ${style.color || el.color || '#000000'};
  white-space: pre-wrap;
  line-height: 1.2;`;
          
          if (style.fontFamily || el.fontFamily) {
            css += `\n  font-family: ${style.fontFamily || el.fontFamily};`;
          }
          if (style.textTransform) css += `\n  text-transform: ${style.textTransform};`;
          
          // Robust check for text-decoration with !important to ensure it applies
          const textDecoration = style.textDecoration || style.text_decoration || el.textDecoration || el.text_decoration || 'none';
          css += `\n  text-decoration: ${textDecoration} !important;`;
        }
        
        if (el.borderRadius) css += `\n  border-radius: ${el.borderRadius};`;
        if (style.rotation) css += `\n  transform: rotate(${style.rotation}deg);`;
        if (style.opacity !== undefined) css += `\n  opacity: ${style.opacity};`;
        if (style.zIndex !== undefined) css += `\n  z-index: ${style.zIndex};`;
        
        css += '\n}\n\n';
      });
      
      return { html, css };
    } catch (error) {
      this.logger.error('Error generating HTML/CSS from template_data:', error);
      return { html: '', css: '' };
    }
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
   * Récupérer le template de badge approprié pour un événement
   * Ordre de priorité:
   * 1. Template assigné à l'événement (via EventSettings.badge_template_id)
   * 2. Template par défaut de l'organisation (is_default = true)
   * 3. Premier template actif de l'organisation
   */
  async getTemplateForEvent(eventId: string, orgId: string) {
    // 1. Vérifier si un template est assigné à l'événement
    const eventSettings = await this.prisma.eventSetting.findFirst({
      where: {
        event_id: eventId,
        org_id: orgId,
      },
      include: {
        badgeTemplate: true,
      },
    });

    if (eventSettings?.badgeTemplate && eventSettings.badgeTemplate.is_active) {
      this.logger.log(`Using event-specific template: ${eventSettings.badgeTemplate.name}`);
      return eventSettings.badgeTemplate;
    }

    // 2. Chercher le template par défaut de l'organisation
    const defaultTemplate = await this.prisma.badgeTemplate.findFirst({
      where: {
        org_id: orgId,
        is_default: true,
        is_active: true,
      },
    });

    if (defaultTemplate) {
      this.logger.log(`Using default template: ${defaultTemplate.name}`);
      return defaultTemplate;
    }

    // 3. Prendre le premier template actif
    const firstTemplate = await this.prisma.badgeTemplate.findFirst({
      where: {
        org_id: orgId,
        is_active: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    if (firstTemplate) {
      this.logger.log(`Using first active template: ${firstTemplate.name}`);
      return firstTemplate;
    }

    return null;
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
