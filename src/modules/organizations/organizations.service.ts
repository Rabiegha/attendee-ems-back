import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { Organization } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
    return this.prisma.organization.create({
      data: createOrganizationDto,
    });
  }

  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { slug },
    });
  }

  async findAll(): Promise<Organization[]> {
    return this.prisma.organization.findMany();
  }
}
