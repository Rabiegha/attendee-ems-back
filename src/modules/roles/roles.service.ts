import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Role[]> {
    return this.prisma.role.findMany();
  }

  async findAllWithPermissions() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  async findByOrganizationWithPermissions(orgId: string) {
    return this.prisma.role.findMany({
      where: {
        org_id: orgId
      },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  async findById(id: string): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string, orgId?: string | null): Promise<Role | null> {
    // Si pas d'orgId spécifié, chercher le template système (org_id = null)
    return this.prisma.role.findFirst({
      where: { 
        code,
        org_id: orgId !== undefined ? orgId : null
      },
    });
  }

  async findUserRole(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    if (!user || !user.role) {
      return null;
    }

    return {
      id: user.role.id,
      code: user.role.code,
      name: user.role.name,
      description: user.role.description,
      created_at: user.role.created_at,
      updated_at: user.role.updated_at,
      permissions: user.role.rolePermissions.map(rp => ({
        id: rp.permission.id,
        code: rp.permission.code,
        name: rp.permission.name,
        description: rp.permission.description
      }))
    };
  }

  async updateRolePermissions(roleId: string, permissionIds: string[]) {
    // Supprimer toutes les anciennes permissions
    await this.prisma.rolePermission.deleteMany({
      where: { role_id: roleId }
    });

    // Ajouter les nouvelles permissions
    await this.prisma.rolePermission.createMany({
      data: permissionIds.map(permissionId => ({
        role_id: roleId,
        permission_id: permissionId
      }))
    });

    // Retourner le rôle avec les nouvelles permissions
    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }
}
