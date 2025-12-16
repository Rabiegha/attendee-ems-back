import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateAttendeeTypeDto } from './dto/create-attendee-type.dto';
import { UpdateAttendeeTypeDto } from './dto/update-attendee-type.dto';

@Injectable()
export class AttendeeTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    const types = await this.prisma.attendeeType.findMany({
      where: { org_id: orgId },
      include: {
        eventAttendeeTypes: {
          select: {
            _count: {
              select: { registrations: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return types.map((type) => {
      const usage_count = type.eventAttendeeTypes.length;
      const registration_count = type.eventAttendeeTypes.reduce(
        (acc, curr) => acc + curr._count.registrations,
        0,
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { eventAttendeeTypes, ...rest } = type;
      return {
        ...rest,
        usage_count,
        registration_count,
      };
    });
  }

  async findOne(orgId: string, id: string) {
    const attendeeType = await this.prisma.attendeeType.findFirst({
      where: { id, org_id: orgId },
    });

    if (!attendeeType) {
      throw new NotFoundException('Attendee type not found');
    }

    return attendeeType;
  }

  async create(orgId: string, dto: CreateAttendeeTypeDto) {
    // Check if code exists
    const existing = await this.prisma.attendeeType.findUnique({
      where: {
        org_id_code: {
          org_id: orgId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Attendee type with this code already exists');
    }

    return this.prisma.attendeeType.create({
      data: {
        ...dto,
        org_id: orgId,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateAttendeeTypeDto) {
    await this.findOne(orgId, id); // Ensure exists

    if (dto.code) {
      const existing = await this.prisma.attendeeType.findUnique({
        where: {
          org_id_code: {
            org_id: orgId,
            code: dto.code,
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Attendee type with this code already exists');
      }
    }

    return this.prisma.attendeeType.update({
      where: { id },
      data: dto,
    });
  }

  async remove(orgId: string, id: string) {
    await this.findOne(orgId, id); // Ensure exists

    return this.prisma.attendeeType.delete({
      where: { id },
    });
  }
}
