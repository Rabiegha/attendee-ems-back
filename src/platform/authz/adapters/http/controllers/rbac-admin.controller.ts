/**
 * RBAC Admin Controller
 * Endpoints d'administration du RBAC (CRUD roles, assignations, etc.)
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { RequirePermissionGuard } from '../guards/require-permission.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PrismaService } from '@/prisma/prisma.service';

@Controller('rbac')
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
export class RbacAdminController {
  constructor(private prisma: PrismaService) {}

  /**
   * GET /rbac/roles
   * Liste tous les rôles d'une organisation
   */
  @Get('roles/:orgId')
  @RequirePermission('org.manage')
  async listRoles(@Param('orgId') orgId: string) {
    return this.prisma.role.findMany({
      where: { org_id: orgId },
      orderBy: { rank: 'asc' },
    });
  }

  /**
   * POST /rbac/roles
   * Créer un nouveau rôle tenant
   */
  @Post('roles')
  @RequirePermission('org.manage')
  async createRole(
    @Body()
    body: {
      orgId: string;
      code: string;
      name: string;
      level: number;
      rank: number;
    },
  ) {
    return this.prisma.role.create({
      data: {
        code: body.code,
        name: body.name,
        org_id: body.orgId,
        level: body.level,
        rank: body.rank,
        role_type: 'tenant',
        is_platform: false,
        is_root: false,
        is_locked: false,
        managed_by_template: false,
      },
    });
  }

  /**
   * PUT /rbac/roles/:roleId/assign
   * Assigner un rôle tenant à un user
   */
  @Put('roles/:roleId/assign')
  @RequirePermission('user.manage')
  async assignRole(
    @Param('roleId') roleId: string,
    @Body() body: { userId: string; orgId: string },
  ) {
    // Vérifier que le user est membre de l'org
    const membership = await this.prisma.orgUser.findUnique({
      where: {
        user_id_org_id: {
          user_id: body.userId,
          org_id: body.orgId,
        },
      },
    });

    if (!membership) {
      throw new Error('User is not a member of this organization');
    }

    // Assigner le rôle (upsert pour remplacer si existant)
    return this.prisma.tenantUserRole.upsert({
      where: {
        user_id_org_id: {
          user_id: body.userId,
          org_id: body.orgId,
        },
      },
      create: {
        user_id: body.userId,
        org_id: body.orgId,
        role_id: roleId,
      },
      update: {
        role_id: roleId,
      },
    });
  }

  /**
   * DELETE /rbac/roles/:roleId/assign/:userId
   * Retirer un rôle tenant d'un user
   */
  @Delete('roles/:roleId/assign/:userId/:orgId')
  @RequirePermission('user.manage')
  async unassignRole(
    @Param('roleId') roleId: string,
    @Param('userId') userId: string,
    @Param('orgId') orgId: string,
  ) {
    return this.prisma.tenantUserRole.delete({
      where: {
        user_id_org_id: {
          user_id: userId,
          org_id: orgId,
        },
      },
    });
  }

  /**
   * GET /rbac/users/:userId/roles
   * Liste tous les rôles d'un user (toutes orgs)
   */
  @Get('users/:userId/roles')
  @RequirePermission('user.read')
  async getUserRoles(@Param('userId') userId: string) {
    const tenantRoles = await this.prisma.tenantUserRole.findMany({
      where: { user_id: userId },
      include: {
        role: true,
        organization: true,
      },
    });

    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
      include: {
        role: true,
      },
    });

    return {
      tenant: tenantRoles.map((tr) => ({
        role: tr.role,
        org: tr.organization,
      })),
      platform: platformRole ? platformRole.role : null,
    };
  }
}
