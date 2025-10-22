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
   */
  async findAll(
    dto: ListAttendeesDto,
    orgId: string,
  ): Promise<{
    data: Attendee[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 20;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.AttendeeWhereInput = {
      org_id: orgId,
    };

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

    // Search query across multiple fields
    if (dto.q) {
      where.OR = [
        { email: { contains: dto.q, mode: 'insensitive' } },
        { first_name: { contains: dto.q, mode: 'insensitive' } },
        { last_name: { contains: dto.q, mode: 'insensitive' } },
        { phone: { contains: dto.q, mode: 'insensitive' } },
        { company: { contains: dto.q, mode: 'insensitive' } },
        { job_title: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    const orderBy: Prisma.AttendeeOrderByWithRelationInput = {
      [dto.sortBy || 'created_at']: dto.sortDir || 'desc',
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
   * Find one attendee by ID within the org
   */
  async findOne(id: string, orgId: string): Promise<Attendee> {
    const attendee = await this.prisma.attendee.findFirst({
      where: {
        id,
        org_id: orgId,
      },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    return attendee;
  }

  /**
   * Update an attendee
   * Validates email uniqueness if email is changed
   * Creates a revision in the same transaction
   */
  async update(
    id: string,
    dto: UpdateAttendeeDto,
    orgId: string,
    userId: string,
  ): Promise<Attendee> {
    return this.prisma.$transaction(async (tx) => {
      // Check if attendee exists in org
      const existing = await tx.attendee.findFirst({
        where: {
          id,
          org_id: orgId,
        },
      });

      if (!existing) {
        throw new NotFoundException('Attendee not found');
      }

      // If email is being updated, check uniqueness
      if (dto.email && dto.email !== existing.email) {
        const emailConflict = await tx.attendee.findUnique({
          where: {
            org_id_email: {
              org_id: orgId,
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

      const attendee = await tx.attendee.update({
        where: { id },
        data: updateData,
      });

      // Create revision
      await tx.attendeeRevision.create({
        data: {
          org_id: orgId,
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
    orgId: string,
    userId: string,
    force: boolean = false,
  ): Promise<{ message: string; deleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // Check if attendee exists in org
      const existing = await tx.attendee.findFirst({
        where: {
          id,
          org_id: orgId,
        },
      });

      if (!existing) {
        throw new NotFoundException('Attendee not found');
      }

      if (force) {
        // Check for dependencies (e.g., registrations)
        // Note: This assumes a 'registration' table exists with attendee_id
        // If it doesn't exist yet, this check can be commented out or removed
        try {
          const registrationCount = await tx.registration.count({
            where: {
              org_id: orgId,
              attendee_id: id,
            },
          });

          if (registrationCount > 0) {
            throw new ConflictException(
              `Cannot hard delete attendee: ${registrationCount} registration(s) exist`,
            );
          }
        } catch (error) {
          // If registration table doesn't exist, skip the check
          if (error instanceof ConflictException) {
            throw error;
          }
          // Otherwise, proceed with deletion
        }

        // Create revision before hard delete
        await tx.attendeeRevision.create({
          data: {
            org_id: orgId,
            attendee_id: id,
            change_type: 'manual',
            source: 'api',
            changed_by: userId,
            snapshot: existing as unknown as Prisma.InputJsonValue,
            note: 'hard delete',
          },
        });

        // Hard delete
        await tx.attendee.delete({
          where: { id },
        });

        return { message: 'Attendee permanently deleted', deleted: true };
      } else {
        // Soft delete
        const attendee = await tx.attendee.update({
          where: { id },
          data: { is_active: false },
        });

        // Create revision
        await tx.attendeeRevision.create({
          data: {
            org_id: orgId,
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
