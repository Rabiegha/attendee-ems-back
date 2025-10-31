import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
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

  async findSystemTemplates() {
    // Récupère uniquement les templates système (org_id = null, is_system_role = true)
    return this.prisma.role.findMany({
      where: {
        is_system_role: true
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

  async updateRolePermissions(roleId: string, permissionIds: string[], updaterUserId?: string) {
    // 🔒 Vérification hiérarchique : un utilisateur ne peut pas modifier les permissions de son propre rôle
    if (updaterUserId) {
      const updaterUser = await this.prisma.user.findUnique({
        where: { id: updaterUserId },
        include: { role: true }
      });

      if (updaterUser && updaterUser.role_id === roleId) {
        throw new ForbiddenException('You cannot modify the permissions of your own role');
      }

      // Vérifier la hiérarchie : un utilisateur peut modifier uniquement les rôles de niveau INFÉRIEUR
      const targetRole = await this.prisma.role.findUnique({
        where: { id: roleId },
        select: { level: true, name: true, code: true }
      });

      if (targetRole && updaterUser?.role) {
        // ATTENTION : Niveau plus BAS dans la DB = plus de pouvoir
        // SUPER_ADMIN = 1, ADMIN = 2, MANAGER = 3, VIEWER = 4, PARTNER = 5, HOSTESS = 6
        // Un MANAGER (level 3) peut modifier : VIEWER (4), PARTNER (5), HOSTESS (6)
        // Un MANAGER ne peut PAS modifier : SUPER_ADMIN (1), ADMIN (2), ou autre MANAGER (3)
        if (targetRole.level <= updaterUser.role.level) {
          throw new ForbiddenException(
            `You cannot modify permissions for role '${targetRole.name}' (level ${targetRole.level}). ` +
            `Your role level is ${updaterUser.role.level}. You can only modify roles of strictly higher level (number).`
          );
        }
      }
    }

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
