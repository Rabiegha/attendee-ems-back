import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { Organization } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
    try {
      return await this.prisma.organization.create({
        data: createOrganizationDto,
      });
    } catch (error) {
      // Gestion spécifique des erreurs de contrainte unique
      if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
        throw new ConflictException(
          `Une organisation avec le nom "${createOrganizationDto.name}" existe déjà. Veuillez choisir un nom différent.`
        );
      }
      // Re-lancer l'erreur si ce n'est pas une erreur de slug dupliqué
      throw error;
    }
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

  async getOrganizationUsers(orgId: string) {
    const users = await this.prisma.user.findMany({
      where: { org_id: orgId },
      include: {
        role: true,
      },
    });
    
    return { users };
  }
}
