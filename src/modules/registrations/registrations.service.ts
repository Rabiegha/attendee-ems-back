import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { ListRegistrationsDto } from './dto/list-registrations.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List registrations for an event with filters and pagination
   * No PII masking - all fields visible to authorized users (including HOSTESS)
   */
  async findAll(
    eventId: string,
    orgId: string,
    dto: ListRegistrationsDto,
  ) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.RegistrationWhereInput = {
      event_id: eventId,
      org_id: orgId,
    };

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.attendanceType) {
      where.attendance_type = dto.attendanceType;
    }

    if (dto.attendeeTypeId) {
      where.event_attendee_type_id = dto.attendeeTypeId;
    }

    if (dto.company) {
      where.attendee = {
        company: { contains: dto.company, mode: 'insensitive' },
      };
    }

    if (dto.search) {
      where.attendee = {
        OR: [
          { email: { contains: dto.search, mode: 'insensitive' } },
          { first_name: { contains: dto.search, mode: 'insensitive' } },
          { last_name: { contains: dto.search, mode: 'insensitive' } },
          { company: { contains: dto.search, mode: 'insensitive' } },
        ],
      };
    }

    // Build orderBy
    const sortBy = dto.sortBy || 'created_at';
    let orderBy: Prisma.RegistrationOrderByWithRelationInput;

    if (['company', 'last_name', 'first_name', 'email'].includes(sortBy)) {
      orderBy = {
        attendee: {
          [sortBy]: dto.sortOrder || 'desc',
        },
      };
    } else {
      orderBy = {
        [sortBy]: dto.sortOrder || 'desc',
      };
    }

    // Execute queries in parallel
    const [data, total] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          attendee: true,
          eventAttendeeType: {
            include: {
              attendeeType: true,
            },
          },
        },
      }),
      this.prisma.registration.count({ where }),
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
   * Update registration status
   * Sets confirmed_at when status changes to 'approved'
   */
  async updateStatus(
    id: string,
    orgId: string,
    dto: UpdateRegistrationStatusDto,
  ) {
    const registration = await this.prisma.registration.findFirst({
      where: {
        id,
        org_id: orgId,
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    const updateData: Prisma.RegistrationUpdateInput = {
      status: dto.status,
    };

    // Set confirmed_at when approving
    if (dto.status === 'approved' && !registration.confirmed_at) {
      updateData.confirmed_at = new Date();
    }

    return this.prisma.registration.update({
      where: { id },
      data: updateData,
      include: {
        attendee: true,
      },
    });
  }

  /**
   * Create a registration with attendee upsert
   * Checks capacity and duplicate registrations
   */
  async create(
    eventId: string,
    orgId: string,
    dto: CreateRegistrationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Get event and settings
      const event = await tx.event.findFirst({
        where: {
          id: eventId,
          org_id: orgId,
        },
        include: {
          settings: true,
        },
      });

      if (!event) {
        throw new NotFoundException('Event not found');
      }

      // Check capacity
      if (event.capacity) {
        const currentCount = await tx.registration.count({
          where: {
            event_id: eventId,
            org_id: orgId,
            status: { in: ['awaiting', 'approved'] },
          },
        });

        if (currentCount >= event.capacity) {
          throw new ConflictException('Event is full');
        }
      }

      // Upsert attendee
      const attendee = await tx.attendee.upsert({
        where: {
          org_id_email: {
            org_id: orgId,
            email: dto.attendee.email,
          },
        },
        update: {
          first_name: dto.attendee.first_name || undefined,
          last_name: dto.attendee.last_name || undefined,
          phone: dto.attendee.phone || undefined,
          company: dto.attendee.company || undefined,
          job_title: dto.attendee.job_title || undefined,
          country: dto.attendee.country || undefined,
        },
        create: {
          org_id: orgId,
          email: dto.attendee.email,
          first_name: dto.attendee.first_name,
          last_name: dto.attendee.last_name,
          phone: dto.attendee.phone,
          company: dto.attendee.company,
          job_title: dto.attendee.job_title,
          country: dto.attendee.country,
        },
      });

      // Check for duplicate registration
      const existingRegistration = await tx.registration.findUnique({
        where: {
          event_id_attendee_id: {
            event_id: eventId,
            attendee_id: attendee.id,
          },
        },
      });

      if (existingRegistration) {
        if (existingRegistration.status === 'refused') {
          throw new ForbiddenException('This attendee was previously declined for this event');
        }
        if (['awaiting', 'approved'].includes(existingRegistration.status)) {
          throw new ConflictException('This attendee is already registered for this event');
        }
      }

      // Determine status based on auto-approve setting
      const status = event.settings?.registration_auto_approve ? 'approved' : 'awaiting';
      const confirmedAt = status === 'approved' ? new Date() : null;

      // Create registration
      const registration = await tx.registration.create({
        data: {
          org_id: orgId,
          event_id: eventId,
          attendee_id: attendee.id,
          status,
          attendance_type: dto.attendance_type,
          event_attendee_type_id: dto.event_attendee_type_id,
          answers: dto.answers ? (dto.answers as Prisma.InputJsonValue) : null,
          invited_at: new Date(),
          confirmed_at: confirmedAt,
        },
        include: {
          attendee: true,
        },
      });

      return registration;
    });
  }
}
