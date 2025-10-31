import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';
import { UpdateAttendeeDto } from './dto/update-attendee.dto';
import { ListAttendeesDto } from './dto/list-attendees.dto';
import { Attendee, Prisma } from '@prisma/client';
import { AttendeeScope } from '../../common/utils/resolve-attendee-scope.util';

interface AttendeeQueryContext {
  scope: AttendeeScope;
  orgId?: string;
}

@Injectable()
export class AttendeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create or upsert an attendee by (org_id, email)
   * If exists: partial update of provided fields
   * If not: create new attendee
   * Always creates a revision in the same transaction
   */
  async create(
    dto: CreateAttendeeDto,
    orgId: string,
    userId: string,
  ): Promise<Attendee> {
    return this.prisma.$transaction(async (tx) => {
      // Check if attendee exists with this email in the org
      const existing = await tx.attendee.findUnique({
        where: {
          org_id_email: {
            org_id: orgId,
            email: dto.email,
          },
        },
      });

      let attendee: Attendee;
      let isUpdate = false;

      if (existing) {
        // Update existing attendee with provided fields only
        const updateData = this.pickDefinedFields(dto, [
          'first_name',
          'last_name',
          'phone',
          'company',
          'job_title',
          'country',
          'labels',
          'notes',
          'metadata',
          'default_type_id',
          'is_active',
        ]);

        attendee = await tx.attendee.update({
          where: { id: existing.id },
          data: updateData,
        });
        isUpdate = true;
      } else {
        // Create new attendee
        attendee = await tx.attendee.create({
          data: {
            org_id: orgId,
            email: dto.email,
            ...this.pickDefinedFields(dto, [
              'first_name',
              'last_name',
              'phone',
              'company',
              'job_title',
              'country',
              'labels',
              'notes',
              'metadata',
              'default_type_id',
              'is_active',
            ]),
          },
        });
      }

      // Create revision
      await tx.attendeeRevision.create({
        data: {
          org_id: orgId,
          attendee_id: attendee.id,
          change_type: 'upsert',
          source: 'api',
          changed_by: userId,
          snapshot: attendee as unknown as Prisma.InputJsonValue,
          note: isUpdate ? 'upsert-update' : 'upsert-create',
        },
      });

      return attendee;
    });
  }

  /**
   * List attendees with filters, pagination, and sorting
   * Applique le scope au niveau Prisma:
   * - 'any': cross-tenant (pas de filtre org)
   * - 'org': filtré par org_id
   */
  async findAll(
    dto: ListAttendeesDto,
    ctx: AttendeeQueryContext,
  ): Promise<{
    data: Attendee[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 20;
    const skip = (page - 1) * pageSize;

    // Build where clause avec scope
    const where: Prisma.AttendeeWhereInput = {};

    // Par défaut, ne récupérer que les attendees actifs (soft delete)
    where.is_active = dto.isActive !== undefined ? dto.isActive : true;

    // Appliquer le scope
    if (ctx.scope !== 'any') {
      where.org_id = ctx.orgId!;
    }

    // Apply filters
    if (dto.email) {
      where.email = dto.email;
    }

    if (dto.typeId) {
      where.default_type_id = dto.typeId;
    }

    if (dto.isActive !== undefined) {
      where.is_active = dto.isActive;
    }

    if (dto.createdFrom || dto.createdTo) {
      where.created_at = {};
      if (dto.createdFrom) {
        where.created_at.gte = new Date(dto.createdFrom);
      }
      if (dto.createdTo) {
        where.created_at.lte = new Date(dto.createdTo);
      }
    }

    // Search query across multiple fields (support both 'q' and 'search' parameters)
    const searchQuery = dto.q || dto.search;
    if (searchQuery) {
      where.OR = [
        { email: { contains: searchQuery, mode: 'insensitive' } },
        { first_name: { contains: searchQuery, mode: 'insensitive' } },
        { last_name: { contains: searchQuery, mode: 'insensitive' } },
        { phone: { contains: searchQuery, mode: 'insensitive' } },
        { company: { contains: searchQuery, mode: 'insensitive' } },
        { job_title: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    // Map frontend sortBy fields to Prisma column names
    const sortByMapping: Record<string, string> = {
      registrationDate: 'created_at',
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      company: 'company',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const mappedSortBy = dto.sortBy 
      ? (sortByMapping[dto.sortBy] || dto.sortBy)
      : 'created_at';

    // Build orderBy
    const orderBy: Prisma.AttendeeOrderByWithRelationInput = {
      [mappedSortBy]: dto.sortDir || 'desc',
    };

    // Execute queries in parallel
    const [data, total] = await Promise.all([
      this.prisma.attendee.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.attendee.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  /**
   * Find one attendee by ID
   * Applique le scope au niveau Prisma:
   * - 'any': cross-tenant (pas de filtre org)
   * - 'org': filtré par org_id
   */
  async findOne(id: string, ctx: AttendeeQueryContext): Promise<Attendee> {
    const where: Prisma.AttendeeWhereInput = {
      id,
    };

    // Appliquer le scope
    if (ctx.scope !== 'any') {
      where.org_id = ctx.orgId!;
    }

    const attendee = await this.prisma.attendee.findFirst({
      where,
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    return attendee;
  }

  /**
   * Get attendee participation history across all events
   * Filters by email to show all participations with the same email
   * SUPER_ADMIN sees all organizations, others see own organization only
   */
  async findAttendeeHistory(
    id: string,
    email: string,
    ctx: AttendeeQueryContext & { isSuperAdmin: boolean },
  ) {
    // First verify the attendee exists and is accessible
    await this.findOne(id, ctx);

    // Build where clause for registrations based on scope
    const registrationWhere: Prisma.RegistrationWhereInput = {
      attendee: {
        email: email,
      },
    };
    
    if (!ctx.isSuperAdmin) {
      // Non-super admins can only see registrations from their organization
      registrationWhere.org_id = ctx.orgId!;
    }

    // Find all registrations for attendees with the same email
    const history = await this.prisma.registration.findMany({
      where: registrationWhere,
      include: {
        attendee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            company: true,
            phone: true,
            created_at: true,
            metadata: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            description: true,
            start_at: true,
            end_at: true,
            status: true,
            org_id: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { event: { start_at: 'desc' } },
        { created_at: 'desc' },
      ],
    });

    // Transform to match API response format
    return history.map((registration: any) => ({
      id: registration.id,
      attendeeId: registration.attendee_id,
      eventId: registration.event_id,
      status: registration.status,
      displayName: `${registration.attendee.first_name} ${registration.attendee.last_name}`.trim() || registration.attendee.email,
      email: registration.attendee.email,
      registrationDate: registration.created_at.toISOString(),
      checkedInAt: registration.confirmed_at?.toISOString() || null,
      customData: registration.answers || null,
      event: {
        id: registration.event.id,
        name: registration.event.name,
        description: registration.event.description,
        startDate: registration.event.start_at.toISOString(),
        endDate: registration.event.end_at.toISOString(),
        location: null,
        status: registration.event.status,
        organizationId: registration.event.org_id,
        organizationName: registration.event.organization?.name || null,
      },
    }));
  }

  /**
   * Update an attendee
   * Validates email uniqueness if email is changed
   * Creates a revision in the same transaction
   */
  async update(
    id: string,
    dto: UpdateAttendeeDto,
    orgId: string | undefined,
    userId: string,
  ): Promise<Attendee> {
    return this.prisma.$transaction(async (tx) => {
      // For SUPER_ADMIN (orgId undefined), find attendee in any org
      // For regular users, restrict to their org
      const whereClause = orgId 
        ? { id, org_id: orgId }
        : { id };

      const existing = await tx.attendee.findFirst({
        where: whereClause,
      });

      if (!existing) {
        throw new NotFoundException('Attendee not found');
      }

      // Use the attendee's actual org_id for the update
      const actualOrgId = existing.org_id;

      // If email is being updated, check uniqueness
      if (dto.email && dto.email !== existing.email) {
        const emailConflict = await tx.attendee.findUnique({
          where: {
            org_id_email: {
              org_id: actualOrgId,
              email: dto.email,
            },
          },
        });

        if (emailConflict && emailConflict.id !== id) {
          throw new ConflictException(
            'Another attendee with this email already exists in the organization',
          );
        }
      }

      // Update with provided fields only
      const updateData = this.pickDefinedFields(dto, [
        'email',
        'first_name',
        'last_name',
        'phone',
        'company',
        'job_title',
        'country',
        'labels',
        'notes',
        'metadata',
        'default_type_id',
        'is_active',
      ]);

      // Use composite key to ensure org_id is enforced at DB level
      const attendee = await tx.attendee.update({
        where: {
          id_org_id: {
            id,
            org_id: actualOrgId,
          },
        },
        data: updateData,
      });

      // Create revision
      await tx.attendeeRevision.create({
        data: {
          org_id: actualOrgId,
          attendee_id: attendee.id,
          change_type: 'manual',
          source: 'api',
          changed_by: userId,
          snapshot: attendee as unknown as Prisma.InputJsonValue,
          note: 'manual update',
        },
      });

      return attendee;
    });
  }

  /**
   * Delete an attendee
   * Soft delete by default (is_active = false)
   * Hard delete if force=true and no dependencies exist
   */
  async remove(
    id: string,
    orgId: string | undefined,
    userId: string,
    force: boolean = false,
  ): Promise<{ message: string; deleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // For SUPER_ADMIN (orgId undefined), find attendee in any org
      // For regular users, restrict to their org
      const whereClause = orgId 
        ? { id, org_id: orgId }
        : { id };

      const existing = await tx.attendee.findFirst({
        where: whereClause,
      });

      if (!existing) {
        throw new NotFoundException('Attendee not found');
      }

      // Use the attendee's actual org_id for the operations
      const actualOrgId = existing.org_id;

      if (force) {
        // TODO: Add registration dependency check when Registration model is implemented
        // const registrationCount = await tx.registration.count({
        //   where: { org_id: orgId, attendee_id: id },
        // });
        // if (registrationCount > 0) {
        //   throw new ConflictException(
        //     `Cannot hard delete attendee: ${registrationCount} registration(s) exist`,
        //   );
        // }

        // Create revision before hard delete
        await tx.attendeeRevision.create({
          data: {
            org_id: actualOrgId,
            attendee_id: id,
            change_type: 'manual',
            source: 'api',
            changed_by: userId,
            snapshot: existing as unknown as Prisma.InputJsonValue,
            note: 'hard delete',
          },
        });

        // Hard delete using composite key
        await tx.attendee.delete({
          where: {
            id_org_id: {
              id,
              org_id: actualOrgId,
            },
          },
        });

        return { message: 'Attendee permanently deleted', deleted: true };
      } else {
        // Soft delete using composite key
        const attendee = await tx.attendee.update({
          where: {
            id_org_id: {
              id,
              org_id: actualOrgId,
            },
          },
          data: { is_active: false },
        });

        // Create revision
        await tx.attendeeRevision.create({
          data: {
            org_id: actualOrgId,
            attendee_id: id,
            change_type: 'manual',
            source: 'api',
            changed_by: userId,
            snapshot: attendee as unknown as Prisma.InputJsonValue,
            note: 'soft delete',
          },
        });

        return { message: 'Attendee deactivated', deleted: false };
      }
    });
  }

  async bulkDelete(ids: string[], orgId?: string): Promise<number> {
    const whereClause: Prisma.AttendeeWhereInput = {
      id: { in: ids },
      is_active: true, // Ne "supprimer" que les attendees actifs
    };

    // Ajouter le filtre d'organisation si spécifié
    if (orgId) {
      whereClause.org_id = orgId;
    }

    // SOFT DELETE : marquer comme inactif au lieu de supprimer
    const result = await this.prisma.attendee.updateMany({
      where: whereClause,
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Restore soft-deleted attendees (set is_active = true)
   */
  async restore(id: string, orgId?: string): Promise<any> {
    const whereClause: Prisma.AttendeeWhereInput = {
      id,
      is_active: false, // Only restore inactive attendees
    };

    // Add org filter if specified
    if (orgId) {
      whereClause.org_id = orgId;
    }

    // Check if attendee exists and is inactive
    const attendee = await this.prisma.attendee.findFirst({
      where: whereClause,
    });

    if (!attendee) {
      throw new NotFoundException('Inactive attendee not found');
    }

    // Restore attendee
    return this.prisma.attendee.update({
      where: { id },
      data: {
        is_active: true,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Bulk restore soft-deleted attendees
   */
  async bulkRestore(ids: string[], orgId?: string): Promise<number> {
    const whereClause: Prisma.AttendeeWhereInput = {
      id: { in: ids },
      is_active: false, // Only restore inactive attendees
    };

    // Add org filter if specified
    if (orgId) {
      whereClause.org_id = orgId;
    }

    // Restore attendees
    const result = await this.prisma.attendee.updateMany({
      where: whereClause,
      data: {
        is_active: true,
        updated_at: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Permanently delete an attendee and all its relations
   */
  async permanentDelete(id: string, orgId?: string): Promise<any> {
    const whereClause: Prisma.AttendeeWhereInput = { id };

    // Add org filter if specified
    if (orgId) {
      whereClause.org_id = orgId;
    }

    // Check if attendee exists
    const attendee = await this.prisma.attendee.findFirst({
      where: whereClause,
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    // Use transaction to delete all relations and the attendee
    return this.prisma.$transaction(async (tx) => {
      // Delete all registrations for this attendee
      await tx.registration.deleteMany({
        where: { attendee_id: id },
      });

      // Delete the attendee
      return tx.attendee.delete({
        where: { id },
      });
    });
  }

  /**
   * Bulk permanently delete attendees and all their relations
   */
  async bulkPermanentDelete(ids: string[], orgId?: string): Promise<number> {
    const whereClause: Prisma.AttendeeWhereInput = {
      id: { in: ids },
    };

    // Add org filter if specified
    if (orgId) {
      whereClause.org_id = orgId;
    }

    // Get all attendees that match the criteria
    const attendees = await this.prisma.attendee.findMany({
      where: whereClause,
      select: { id: true },
    });

    const attendeeIds = attendees.map(a => a.id);

    if (attendeeIds.length === 0) {
      return 0;
    }

    // Use transaction to delete all relations and attendees
    return this.prisma.$transaction(async (tx) => {
      // Delete all registrations for these attendees
      await tx.registration.deleteMany({
        where: { attendee_id: { in: attendeeIds } },
      });

      // Delete all attendees
      const result = await tx.attendee.deleteMany({
        where: { id: { in: attendeeIds } },
      });

      return result.count;
    });
  }

  async bulkExport(ids: string[], format: 'csv' | 'xlsx', orgId?: string): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    const whereClause: Prisma.AttendeeWhereInput = {
      id: { in: ids },
    };

    // Ajouter le filtre d'organisation si spécifié
    if (orgId) {
      whereClause.org_id = orgId;
    }

    const attendees = await this.prisma.attendee.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
    });

    if (format === 'csv') {
      const csvHeader = 'ID,Email,Prénom,Nom,Téléphone,Entreprise,Poste,Pays,Statut,Date de création\n';
      const csvRows = attendees.map(attendee => 
        [
          attendee.id,
          attendee.email,
          attendee.first_name || '',
          attendee.last_name || '',
          attendee.phone || '',
          attendee.company || '',
          attendee.job_title || '',
          attendee.country || '',
          attendee.is_active ? 'Actif' : 'Inactif',
          attendee.created_at.toISOString().split('T')[0]
        ].map(field => `"${field}"`).join(',')
      ).join('\n');

      const csvContent = csvHeader + csvRows;
      const buffer = Buffer.from(csvContent, 'utf-8');

      return {
        buffer,
        filename: `attendees_export_${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv',
      };
    }

    // TODO: Implémenter l'export Excel si nécessaire
    throw new BadRequestException('Format Excel non encore supporté');
  }



  /**
   * Helper to pick only defined (non-undefined) fields from an object
   */
  private pickDefinedFields<T extends Record<string, any>>(
    obj: T,
    fields: (keyof T)[],
  ): Partial<T> {
    const result: Partial<T> = {};
    for (const field of fields) {
      if (obj[field] !== undefined) {
        result[field] = obj[field];
      }
    }
    return result;
  }
}
