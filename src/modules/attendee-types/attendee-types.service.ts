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
    // Check if name exists
    const existingName = await this.prisma.attendeeType.findFirst({
      where: {
        org_id: orgId,
        name: dto.name,
      },
    });

    if (existingName) {
      throw new ConflictException('Un type de participant avec ce nom existe déjà');
    }

    let code = dto.code;

    if (!code) {
      // Generate code from name
      const baseCode = this.slugify(dto.name);
      code = baseCode;
      let counter = 1;

      while (true) {
        const existing = await this.prisma.attendeeType.findUnique({
          where: {
            org_id_code: {
              org_id: orgId,
              code: code,
            },
          },
        });

        if (!existing) {
          break;
        }

        code = `${baseCode}_${counter}`;
        counter++;
      }
    } else {
      // Check if provided code exists
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
    }

    return this.prisma.attendeeType.create({
      data: {
        ...dto,
        code,
        org_id: orgId,
      },
    });
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/\s+/g, '_')     // Replace spaces with _
      .replace(/[^\w_]+/g, '')  // Remove all non-word chars (except _)
      .replace(/__+/g, '_');    // Replace multiple _ with single _
  }

  async checkNameAvailability(orgId: string, name: string, excludeId?: string): Promise<boolean> {
    const where: any = {
      org_id: orgId,
      name: name,
    };

    if (excludeId) {
      where.NOT = {
        id: excludeId,
      };
    }

    const existing = await this.prisma.attendeeType.findFirst({
      where,
    });

    return !existing;
  }

  async update(orgId: string, id: string, dto: UpdateAttendeeTypeDto) {
    await this.findOne(orgId, id); // Ensure exists

    if (dto.name) {
      const existingName = await this.prisma.attendeeType.findFirst({
        where: {
          org_id: orgId,
          name: dto.name,
          NOT: {
            id: id,
          },
        },
      });

      if (existingName) {
        throw new ConflictException('Un type de participant avec ce nom existe déjà');
      }
    }

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
