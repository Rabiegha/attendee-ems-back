import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { Permission } from '@prisma/client';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId: string): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      where: { org_id: orgId },
    });
  }

  async findById(id: string, orgId: string): Promise<Permission | null> {
    return this.prisma.permission.findFirst({
      where: { 
        id, 
        org_id: orgId 
      },
    });
  }

  async findByCode(code: string, orgId: string): Promise<Permission | null> {
    return this.prisma.permission.findFirst({
      where: { 
        code, 
        org_id: orgId 
      },
    });
  }
}
