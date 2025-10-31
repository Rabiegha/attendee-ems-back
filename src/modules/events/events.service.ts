import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { ChangeEventStatusDto } from './dto/change-event-status.dto';
import { EventStatsDto } from './dto/event-stats.dto';
import { Event, EventSetting, Prisma } from '@prisma/client';
import { generatePublicToken } from '../../common/utils/token.util';
import { EventScope } from '../../common/utils/resolve-event-scope.util';

interface EventQueryContext {
  scope: EventScope;
  orgId?: string;
  userId: string;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an event with its settings (1:1 relation)
   * Generates a unique public_token for the event_settings
   */
  async create(
    dto: CreateEventDto,
    orgId: string,
    userId: string,
  ): Promise<Event & { settings: EventSetting }> {
    return this.prisma.$transaction(async (tx) => {
      // Check if event code already exists in org
      const existing = await tx.event.findUnique({
        where: {
          org_id_code: {
            org_id: orgId,
            code: dto.code,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Event with code '${dto.code}' already exists in this organization`,
        );
      }

      // Validate dates
      const startAt = new Date(dto.start_at);
      const endAt = new Date(dto.end_at);
      if (endAt <= startAt) {
        throw new BadRequestException('end_at must be after start_at');
      }

      // Create event
      const event = await tx.event.create({
        data: {
          org_id: orgId,
          code: dto.code,
          name: dto.name,
          start_at: startAt,
          end_at: endAt,
          timezone: dto.timezone || 'UTC',
          status: dto.status || 'draft',
          capacity: dto.capacity,
          location_type: dto.location_type || 'physical',
          org_activity_sector_id: dto.org_activity_sector_id,
          org_event_type_id: dto.org_event_type_id,
          description: dto.description,
          address_formatted: dto.address_formatted,
          address_street: dto.address_street,
          address_city: dto.address_city,
          address_region: dto.address_region,
          address_postal_code: dto.address_postal_code,
          address_country: dto.address_country,
          latitude: dto.latitude,
          longitude: dto.longitude,
          place_id: dto.place_id,
          created_by: userId,
        },
      });

      // Generate unique public token
      let publicToken: string;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        publicToken = generatePublicToken();
        const existingToken = await tx.eventSetting.findUnique({
          where: { public_token: publicToken },
        });
        if (!existingToken) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new Error('Failed to generate unique public token after multiple attempts');
      }

      // Create event settings
      const settings = await tx.eventSetting.create({
        data: {
          org_id: orgId,
          event_id: event.id,
          public_token: publicToken!,
          website_url: dto.website_url,
          attendance_mode: dto.attendance_mode || 'onsite',
          registration_auto_approve: dto.registration_auto_approve ?? false,
          allow_checkin_out: dto.allow_checkin_out ?? true,
          has_event_reminder: dto.has_event_reminder ?? false,
          registration_fields: dto.registration_fields
            ? (dto.registration_fields as Prisma.InputJsonValue)
            : null,
          auto_transition_to_active: dto.auto_transition_to_active ?? true,
          auto_transition_to_completed: dto.auto_transition_to_completed ?? true,
        },
      });

      // Create event access records for assigned users
      if (dto.assigned_user_ids && dto.assigned_user_ids.length > 0) {
        await tx.eventAccess.createMany({
          data: dto.assigned_user_ids.map(user_id => ({
            org_id: orgId,
            event_id: event.id,
            user_id: user_id,
            reason: 'Assigned during event creation',
            granted_by: userId,
          })),
          skipDuplicates: true,
        });
      }

      return { ...event, settings };
    });
  }

  /**
   * List events with filters, pagination, and sorting
   * Applique le scope au niveau Prisma:
   * - 'any': cross-tenant (pas de filtre org)
   * - 'org': filtré par org_id
   * - 'assigned': filtré par org_id + EventAccess.user_id
   */
  async findAll(
    dto: ListEventsDto,
    ctx: EventQueryContext,
  ): Promise<{
    data: Event[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause avec scope
    const where: Prisma.EventWhereInput = {};

    // Appliquer le scope
    if (ctx.scope !== 'any') {
      where.org_id = ctx.orgId!;
    }
    
    if (ctx.scope === 'assigned') {
      where.eventAccess = {
        some: {
          user_id: ctx.userId,
        },
      };
    }

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.startAfter || dto.startBefore) {
      where.start_at = {};
      if (dto.startAfter) {
        where.start_at.gte = new Date(dto.startAfter);
      }
      if (dto.startBefore) {
        where.start_at.lte = new Date(dto.startBefore);
      }
    }

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { code: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    // Map frontend sortBy fields to Prisma column names
    const sortByMapping: Record<string, string> = {
      startDate: 'start_at',
      endDate: 'end_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      name: 'name',
      code: 'code',
      status: 'status',
    };

    const mappedSortBy = dto.sortBy 
      ? (sortByMapping[dto.sortBy] || dto.sortBy)
      : 'start_at';

    // Build orderBy
    const orderBy: Prisma.EventOrderByWithRelationInput = {
      [mappedSortBy]: dto.sortOrder || 'desc',
    };

    // Execute queries in parallel
    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          settings: true,
          activitySector: true,
          eventType: true,
          _count: {
            select: {
              registrations: {
                where: {
                  status: { in: ['awaiting', 'approved'] }, // Compter uniquement les inscriptions valides
                },
              },
            },
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Find one event by ID
   * Applique le scope au niveau Prisma:
   * - 'any': cross-tenant (pas de filtre org)
   * - 'org': filtré par org_id
   * - 'assigned': filtré par org_id + EventAccess.user_id
   */
  async findOne(id: string, ctx: EventQueryContext): Promise<Event & { settings: EventSetting | null; stats?: EventStatsDto }> {
    const where: Prisma.EventWhereInput = {
      id,
    };

    // Appliquer le scope
    if (ctx.scope !== 'any') {
      where.org_id = ctx.orgId!;
    }
    
    if (ctx.scope === 'assigned') {
      where.eventAccess = {
        some: {
          user_id: ctx.userId,
        },
      };
    }

    const event = await this.prisma.event.findFirst({
      where,
      include: {
        settings: true,
        activitySector: true,
        eventType: true,
        _count: {
          select: {
            registrations: {
              where: {
                status: { in: ['awaiting', 'approved'] },
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    console.log('[findOne] Event found:', {
      eventId: id,
      eventOrgId: event.org_id,
      contextScope: ctx.scope,
      contextOrgId: ctx.orgId,
    });

    // Calculer les stats en utilisant l'org_id de l'événement, pas celui du user
    // Pour un super admin (scope any), on ne filtre pas par org
    const statsOrgId = ctx.scope === 'any' ? undefined : event.org_id;
    console.log('[findOne] Stats will use orgId:', statsOrgId);
    
    const stats = await this.calculateEventStats(id, statsOrgId);

    return {
      ...event,
      stats,
    };
  }

  /**
   * Calculate event statistics (extracted method for reuse)
   */
  private async calculateEventStats(
    eventId: string,
    orgId?: string,
  ): Promise<EventStatsDto> {
    console.log('[calculateEventStats] START', { eventId, orgId });

    // Base where clause
    const whereBase = {
      event_id: eventId,
      ...(orgId ? { org_id: orgId } : {}),
    };

    console.log('[calculateEventStats] whereBase:', JSON.stringify(whereBase));

    // Total without org filter (for debugging)
    const totalWithoutOrgFilter = await this.prisma.registration.count({
      where: { event_id: eventId },
    });
    console.log('[calculateEventStats] Total registrations without org filter:', totalWithoutOrgFilter);

    // Total des inscriptions
    const totalRegistrations = await this.prisma.registration.count({
      where: whereBase,
    });

    console.log('[calculateEventStats] Total registrations WITH org filter:', totalRegistrations);

    // Inscriptions check-in (ceux qui ont au moins une PresenceVisit)
    const checkedIn = await this.prisma.registration.count({
      where: {
        ...whereBase,
        presenceVisits: {
          some: {},
        },
      },
    });

    // Grouper par statut
    const registrationsByStatus = await this.prisma.registration.groupBy({
      by: ['status'],
      where: whereBase,
      _count: {
        status: true,
      },
    });

    console.log('[calculateEventStats] registrationsByStatus:', JSON.stringify(registrationsByStatus));

    // Extraire les compteurs par statut
    const approved =
      registrationsByStatus.find((r) => r.status === 'approved')?._count
        ?.status || 0;
    const pending =
      registrationsByStatus.find((r) => r.status === 'awaiting')?._count
        ?.status || 0;
    const cancelled =
      registrationsByStatus.find((r) => r.status === 'cancelled')?._count
        ?.status || 0;

    // Pourcentage de check-in
    const checkedInPercentage =
      totalRegistrations > 0
        ? Math.round((checkedIn / totalRegistrations) * 100)
        : 0;

    const finalStats = {
      totalRegistrations,
      checkedIn,
      approved,
      pending,
      cancelled,
      checkedInPercentage,
    };

    console.log('[calculateEventStats] Final stats:', JSON.stringify(finalStats));

    return finalStats;
  }

  /**
   * Update an event
   */
  async update(
    id: string,
    dto: UpdateEventDto,
    orgId: string,
  ): Promise<Event> {
    return this.prisma.$transaction(async (tx) => {
      // Check if event exists
      const existing = await tx.event.findFirst({
        where: {
          id,
          org_id: orgId,
        },
      });

      if (!existing) {
        throw new NotFoundException('Event not found');
      }

      // If code is being updated, check uniqueness
      if (dto.code && dto.code !== existing.code) {
        const codeConflict = await tx.event.findUnique({
          where: {
            org_id_code: {
              org_id: orgId,
              code: dto.code,
            },
          },
        });

        if (codeConflict && codeConflict.id !== id) {
          throw new ConflictException(
            `Another event with code '${dto.code}' already exists in this organization`,
          );
        }
      }

      // Validate dates if provided
      const startAt = dto.start_at ? new Date(dto.start_at) : existing.start_at;
      const endAt = dto.end_at ? new Date(dto.end_at) : existing.end_at;
      if (endAt <= startAt) {
        throw new BadRequestException('end_at must be after start_at');
      }

      // Update event
      const event = await tx.event.update({
        where: {
          id_org_id: {
            id,
            org_id: orgId,
          },
        },
        data: {
          code: dto.code,
          name: dto.name,
          start_at: dto.start_at ? new Date(dto.start_at) : undefined,
          end_at: dto.end_at ? new Date(dto.end_at) : undefined,
          timezone: dto.timezone,
          status: dto.status,
          capacity: dto.capacity,
          location_type: dto.location_type,
          org_activity_sector_id: dto.org_activity_sector_id,
          org_event_type_id: dto.org_event_type_id,
          description: dto.description,
          address_formatted: dto.address_formatted,
          address_street: dto.address_street,
          address_city: dto.address_city,
          address_region: dto.address_region,
          address_postal_code: dto.address_postal_code,
          address_country: dto.address_country,
          latitude: dto.latitude,
          longitude: dto.longitude,
          place_id: dto.place_id,
        },
      });

      // Update settings if provided
      if (
        dto.website_url !== undefined ||
        dto.attendance_mode !== undefined ||
        dto.registration_auto_approve !== undefined ||
        dto.allow_checkin_out !== undefined ||
        dto.has_event_reminder !== undefined ||
        dto.registration_fields !== undefined ||
        dto.submit_button_text !== undefined ||
        dto.submit_button_color !== undefined ||
        dto.show_title !== undefined ||
        dto.show_description !== undefined ||
        dto.auto_transition_to_active !== undefined ||
        dto.auto_transition_to_completed !== undefined
      ) {
        await tx.eventSetting.update({
          where: { event_id: id },
          data: {
            website_url: dto.website_url,
            attendance_mode: dto.attendance_mode,
            registration_auto_approve: dto.registration_auto_approve,
            allow_checkin_out: dto.allow_checkin_out,
            has_event_reminder: dto.has_event_reminder,
            registration_fields: dto.registration_fields
              ? (dto.registration_fields as any)
              : undefined,
            submit_button_text: dto.submit_button_text,
            submit_button_color: dto.submit_button_color,
            show_title: dto.show_title,
            show_description: dto.show_description,
            auto_transition_to_active: dto.auto_transition_to_active,
            auto_transition_to_completed: dto.auto_transition_to_completed,
          } as any, // Type cast pour nouveaux champs
        });
      }

      // Update event access (assigned users) if provided
      if (dto.assigned_user_ids !== undefined) {
        // Delete existing assignments
        await tx.eventAccess.deleteMany({
          where: {
            event_id: id,
            org_id: orgId,
          },
        });

        // Create new assignments if any
        if (dto.assigned_user_ids.length > 0) {
          await tx.eventAccess.createMany({
            data: dto.assigned_user_ids.map(user_id => ({
              org_id: orgId,
              event_id: id,
              user_id: user_id,
              reason: 'Assigned during event update',
            })),
            skipDuplicates: true,
          });
        }
      }

      return event;
    });
  }

  /**
   * Delete an event
   */
  async remove(id: string, orgId: string): Promise<{ message: string }> {
    return this.prisma.$transaction(async (tx) => {
      // Check if event exists
      const existing = await tx.event.findFirst({
        where: {
          id,
          org_id: orgId,
        },
      });

      if (!existing) {
        throw new NotFoundException('Event not found');
      }

      // Check for dependencies (registrations)
      const registrationCount = await tx.registration.count({
        where: { event_id: id, org_id: orgId },
      });

      if (registrationCount > 0) {
        throw new ConflictException(
          `Cannot delete event: ${registrationCount} registration(s) exist`,
        );
      }

      // Delete event (cascade will delete settings)
      await tx.event.delete({
        where: {
          id_org_id: {
            id,
            org_id: orgId,
          },
        },
      });

      return { message: 'Event deleted successfully' };
    });
  }

  /**
   * Change event status
   */
  async changeStatus(
    id: string,
    dto: ChangeEventStatusDto,
    orgId: string,
  ): Promise<Event> {
    const event = await this.prisma.event.findFirst({
      where: {
        id,
        org_id: orgId,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.event.update({
      where: {
        id_org_id: {
          id,
          org_id: orgId,
        },
      },
      data: {
        status: dto.status,
      },
    });
  }

  /**
   * Get event statistics (registrations count by status)
   */
  async getEventStats(
    id: string,
    context: EventQueryContext,
  ): Promise<EventStatsDto> {
    // Verify event exists and user has access
    const event = await this.findOne(id, context);

    // Use event's org_id for stats, or no filter for super admin
    const statsOrgId = context.scope === 'any' ? undefined : event.org_id;
    return this.calculateEventStats(id, statsOrgId);
  }

  async bulkDelete(ids: string[], orgId?: string): Promise<number> {
    const whereClause: Prisma.EventWhereInput = {
      id: { in: ids },
    };

    // Ajouter le filtre d'organisation si spécifié
    if (orgId) {
      whereClause.org_id = orgId;
    }

    const result = await this.prisma.event.deleteMany({
      where: whereClause,
    });

    return result.count;
  }

  async bulkExport(ids: string[], format: 'csv' | 'xlsx', orgId?: string): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    const whereClause: Prisma.EventWhereInput = {
      id: { in: ids },
    };

    // Ajouter le filtre d'organisation si spécifié
    if (orgId) {
      whereClause.org_id = orgId;
    }

    const events = await this.prisma.event.findMany({
      where: whereClause,
      include: {
        settings: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (format === 'csv') {
      const csvHeader = 'ID,Code,Nom,Description,Statut,Date de début,Date de fin,Lieu,Capacité,Date de création\n';
      const csvRows = events.map(event => 
        [
          event.id,
          event.code,
          event.name,
          event.description || '',
          event.status,
          event.start_at?.toISOString() || '',
          event.end_at?.toISOString() || '',
          event.address_formatted || '',
          event.capacity || '',
          event.created_at.toISOString().split('T')[0]
        ].map(field => `"${field}"`).join(',')
      ).join('\n');

      const csvContent = csvHeader + csvRows;
      const buffer = Buffer.from(csvContent, 'utf-8');

      return {
        buffer,
        filename: `events_export_${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv',
      };
    }

    // TODO: Implémenter l'export Excel si nécessaire
    throw new BadRequestException('Format Excel non encore supporté');
  }
}
