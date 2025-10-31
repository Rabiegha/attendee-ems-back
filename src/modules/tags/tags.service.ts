import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateTagDto } from './dto/tag.dto';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Recherche de tags avec autocomplétion
   */
  async searchTags(orgId: string, search?: string) {
    const where: any = {
      org_id: orgId,
    };

    if (search && search.trim()) {
      where.name = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    const result = await this.prisma.tag.findMany({
      where,
      orderBy: [
        { usage_count: 'desc' }, // Tags les plus utilisés en premier
        { name: 'asc' },
      ],
      take: 20,
      select: {
        id: true,
        org_id: true,
        name: true,
        color: true,
        usage_count: true,
        created_at: true,
        updated_at: true,
      },
    });

    console.log('🔍 [TagsService] searchTags result:', JSON.stringify(result));
    return result;
  }

  /**
   * Récupérer les tags d'un événement
   */
  async getEventTags(eventId: string, orgId: string) {
    const eventTags = await this.prisma.eventTag.findMany({
      where: {
        event_id: eventId,
      },
      include: {
        tag: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    return eventTags.map((et) => et.tag);
  }

  /**
   * Met à jour les tags d'un événement
   * Crée les nouveaux tags si nécessaire et met à jour usage_count
   */
  async updateEventTags(eventId: string, orgId: string, tagNames: string[]) {
    // Normaliser les noms de tags (trim, lowercase pour éviter les doublons)
    const normalizedNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];

    // Transaction pour garantir la cohérence
    return this.prisma.$transaction(async (tx) => {
      // 1. Récupérer les tags actuels de l'événement
      const currentEventTags = await tx.eventTag.findMany({
        where: { event_id: eventId, org_id: orgId },
        include: { tag: true },
      });

      const currentTagIds = currentEventTags.map((et) => et.tag_id);
      const currentTagNames = currentEventTags.map((et) => et.tag.name);

      // 2. Déterminer les tags à ajouter et à supprimer
      const tagsToAdd = normalizedNames.filter((name) => !currentTagNames.includes(name));
      const tagsToRemove = currentEventTags.filter((et) => !normalizedNames.includes(et.tag.name));

      // 3. Supprimer les anciens tags
      if (tagsToRemove.length > 0) {
        await tx.eventTag.deleteMany({
          where: {
            event_id: eventId,
            tag_id: { in: tagsToRemove.map((et) => et.tag_id) },
          },
        });

        // Décrémenter usage_count
        for (const eventTag of tagsToRemove) {
          await tx.tag.update({
            where: { id: eventTag.tag_id },
            data: { usage_count: { decrement: 1 } },
          });
        }
      }

      // 4. Ajouter les nouveaux tags
      if (tagsToAdd.length > 0) {
        for (const tagName of tagsToAdd) {
          // Upsert: créer le tag s'il n'existe pas, sinon récupérer l'existant
          const tag = await tx.tag.upsert({
            where: {
              org_id_name: {
                org_id: orgId,
                name: tagName,
              },
            },
            create: {
              org_id: orgId,
              name: tagName,
              usage_count: 1,
            },
            update: {
              usage_count: { increment: 1 },
            },
          });

          // Créer la relation EventTag
          await tx.eventTag.create({
            data: {
              event_id: eventId,
              org_id: orgId,
              tag_id: tag.id,
            },
          });
        }
      }

      // 5. Retourner les tags mis à jour
      return this.getEventTags(eventId, orgId);
    });
  }

  /**
   * Créer un tag manuellement (optionnel, si besoin d'une gestion dédiée)
   */
  async createTag(orgId: string, dto: CreateTagDto) {
    const normalizedName = dto.name.trim();

    return this.prisma.tag.upsert({
      where: {
        org_id_name: {
          org_id: orgId,
          name: normalizedName,
        },
      },
      create: {
        org_id: orgId,
        name: normalizedName,
        color: dto.color,
      },
      update: {
        color: dto.color,
      },
    });
  }

  /**
   * Statistiques des tags (pour analytics)
   */
  async getTagStatistics(orgId: string) {
    return this.prisma.tag.findMany({
      where: { org_id: orgId },
      orderBy: { usage_count: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        color: true,
        usage_count: true,
        _count: {
          select: {
            eventTags: true,
          },
        },
      },
    });
  }
}
