import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { Permission } from '@prisma/client';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Permission[]> {
    return this.prisma.permission.findMany();
  }

  async findById(id: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string): Promise<Permission[]> {
    // Note: code n'est plus unique seul, il faut code + scope
    // Retourne toutes les permissions avec ce code (tous scopes)
    return this.prisma.permission.findMany({
      where: { code },
    });
  }
  
  async findByCodeAndScope(code: string, scope: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({
      where: { 
        code_scope: {
          code,
          scope: scope as any,
        }
      },
    });
  }
}
