import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateBadgeTemplateDto, UpdateBadgeTemplateDto, DuplicateBadgeTemplateDto } from './dto';

@Injectable()
export class BadgesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTemplates(
    organizationId: string,
    filters: {
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { search, page = 1, limit = 10 } = filters;
    const offset = (page - 1) * limit;

    const where = {
      org_id: organizationId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    };

    const [templates, total] = await Promise.all([
      this.prisma.badgeTemplate.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { updated_at: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          width: true,
          height: true,
          variables: true,
          template_data: true,
          is_default: true,
          is_active: true,
          usage_count: true,
          created_at: true,
          updated_at: true,
          created_by: true
        }
      }),
      this.prisma.badgeTemplate.count({ where })
    ]);

    return {
      data: templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getTemplate(id: string, organizationId: string) {
    const template = await this.prisma.badgeTemplate.findFirst({
      where: {
        id,
        org_id: organizationId
      }
    });

    if (!template) {
      throw new NotFoundException('Template de badge non trouvé');
    }

    return template;
  }

  async createTemplate(
    createDto: CreateBadgeTemplateDto,
    organizationId: string,
    userId: string
  ) {
    const template = await this.prisma.badgeTemplate.create({
      data: {
        code: createDto.code,
        name: createDto.name,
        description: createDto.description,
        event_id: createDto.event_id,
        html: createDto.html,
        css: createDto.css,
        width: createDto.width || 400,
        height: createDto.height || 600,
        template_data: createDto.template_data,
        variables: createDto.variables || [],
        is_default: createDto.is_default || false,
        is_active: createDto.is_active ?? true,
        org_id: organizationId,
        created_by: userId
      }
    });

    return template;
  }

  async updateTemplate(
    id: string,
    updateDto: UpdateBadgeTemplateDto,
    organizationId: string
  ) {
    const template = await this.prisma.badgeTemplate.findFirst({
      where: {
        id,
        org_id: organizationId
      }
    });

    if (!template) {
      throw new NotFoundException('Template de badge non trouvé');
    }

    const updatedTemplate = await this.prisma.badgeTemplate.update({
      where: { id },
      data: {
        ...(updateDto.code && { code: updateDto.code }),
        ...(updateDto.name && { name: updateDto.name }),
        ...(updateDto.description !== undefined && { description: updateDto.description }),
        ...(updateDto.html !== undefined && { html: updateDto.html }),
        ...(updateDto.css !== undefined && { css: updateDto.css }),
        ...(updateDto.width && { width: updateDto.width }),
        ...(updateDto.height && { height: updateDto.height }),
        ...(updateDto.template_data && { template_data: updateDto.template_data }),
        ...(updateDto.variables && { variables: updateDto.variables }),
        ...(updateDto.is_default !== undefined && { is_default: updateDto.is_default }),
        ...(updateDto.is_active !== undefined && { is_active: updateDto.is_active })
      }
    });

    return updatedTemplate;
  }

  async deleteTemplate(id: string, organizationId: string) {
    const template = await this.prisma.badgeTemplate.findFirst({
      where: {
        id,
        org_id: organizationId
      }
    });

    if (!template) {
      throw new NotFoundException('Template de badge non trouvé');
    }

    await this.prisma.badgeTemplate.delete({
      where: { id }
    });

    return { message: 'Template de badge supprimé avec succès' };
  }

  async duplicateTemplate(
    id: string,
    duplicateDto: DuplicateBadgeTemplateDto,
    organizationId: string,
    userId: string
  ) {
    const originalTemplate = await this.prisma.badgeTemplate.findFirst({
      where: {
        id,
        org_id: organizationId
      }
    });

    if (!originalTemplate) {
      throw new NotFoundException('Template de badge non trouvé');
    }

    const duplicatedTemplate = await this.prisma.badgeTemplate.create({
      data: {
        code: duplicateDto.code,
        name: duplicateDto.name,
        description: duplicateDto.description || originalTemplate.description,
        event_id: originalTemplate.event_id,
        html: originalTemplate.html,
        css: originalTemplate.css,
        width: originalTemplate.width,
        height: originalTemplate.height,
        template_data: originalTemplate.template_data,
        variables: originalTemplate.variables,
        is_default: false, // Duplicate is never default
        is_active: true,
        org_id: organizationId,
        created_by: userId
      }
    });

    return duplicatedTemplate;
  }

  async previewTemplate(
    id: string,
    organizationId: string,
    attendeeId?: string
  ) {
    const template = await this.prisma.badgeTemplate.findFirst({
      where: {
        id,
        org_id: organizationId
      }
    });

    if (!template) {
      throw new NotFoundException('Template de badge non trouvé');
    }

    // If attendee ID is provided, get attendee data for preview
    let attendeeData = null;
    if (attendeeId) {
      attendeeData = await this.prisma.attendee.findFirst({
        where: {
          id: attendeeId,
          org_id: organizationId
        },
        include: {
          registrations: {
            include: {
              event: {
                select: {
                  id: true,
                  name: true,
                  start_at: true,
                  end_at: true,
                  address_formatted: true
                }
              }
            }
          }
        }
      });
    }

    return {
      template,
      attendeeData,
      previewVariables: this.generatePreviewVariables(template.variables as string[], attendeeData)
    };
  }

  private generatePreviewVariables(variables: string[], attendeeData?: any) {
    if (!variables || variables.length === 0) {
      return {};
    }

    const previewVars: Record<string, string> = {};
    
    variables.forEach(variable => {
      switch (variable) {
        case 'firstName':
          previewVars[variable] = attendeeData?.first_name || 'John';
          break;
        case 'lastName':
          previewVars[variable] = attendeeData?.last_name || 'Doe';
          break;
        case 'email':
          previewVars[variable] = attendeeData?.email || 'john.doe@example.com';
          break;
        case 'company':
          previewVars[variable] = attendeeData?.company || 'Acme Corp';
          break;
        case 'jobTitle':
          previewVars[variable] = attendeeData?.job_title || 'Manager';
          break;
        case 'eventName':
          previewVars[variable] = attendeeData?.registrations?.[0]?.event?.name || 'Sample Event';
          break;
        case 'eventLocation':
          previewVars[variable] = attendeeData?.registrations?.[0]?.event?.address_formatted || 'Paris, France';
          break;
        case 'eventDate':
          previewVars[variable] = attendeeData?.registrations?.[0]?.event?.start_at 
            ? new Date(attendeeData.registrations[0].event.start_at).toLocaleDateString('fr-FR')
            : new Date().toLocaleDateString('fr-FR');
          break;
        default:
          previewVars[variable] = `[${variable}]`;
      }
    });

    return previewVars;
  }
}