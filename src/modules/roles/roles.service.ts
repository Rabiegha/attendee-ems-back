import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId: string): Promise<Role[]> {
    return this.prisma.role.findMany({
      where: { org_id: orgId },
    });
  }

  async findById(id: string, orgId: string): Promise<Role | null> {
    return this.prisma.role.findFirst({
      where: { 
        id, 
        org_id: orgId 
      },
    });
  }

  async findByCode(code: string, orgId: string): Promise<Role | null> {
    return this.prisma.role.findFirst({
      where: { 
        code, 
        org_id: orgId 
      },
    });
  }
}
