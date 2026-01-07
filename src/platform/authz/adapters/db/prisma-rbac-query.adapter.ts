import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RbacQueryPort } from '../../ports/rbac-query.port';
import { Grant, ScopeLimit, TenantAccessScope } from '../../core/types';

@Injectable()
export class PrismaRbacQueryAdapter implements RbacQueryPort {
  constructor(private prisma: PrismaService) {}

  async getGrantsForRole(userId: string, orgId: string): Promise<Grant[]> {
    // 1. Récupérer le rôle tenant
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (tenantRole) {
      return tenantRole.role.rolePermissions.map((rp) => ({
        key: rp.permission.key,
        scopeLimit: rp.scope_limit as ScopeLimit,
        moduleKey: rp.permission.module_key || undefined,
      }));
    }

    // 2. Fallback sur platform role (si pas de tenant role)
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (platformRole) {
      return platformRole.role.rolePermissions.map((rp) => ({
        key: rp.permission.key,
        scopeLimit: rp.scope_limit as ScopeLimit,
        moduleKey: rp.permission.module_key || undefined,
      }));
    }

    return [];
  }

  async getPlatformTenantAccessScope(userId: string): Promise<TenantAccessScope | null> {
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
      select: { scope: true },
    });

    if (!platformRole) {
      return null;
    }

    // ✅ Mapping direct (valeurs identiques)
    return platformRole.scope === 'tenant_any'
      ? TenantAccessScope.TENANT_ANY
      : TenantAccessScope.TENANT_ASSIGNED;
  }

  async getRoleLevel(userId: string, orgId: string): Promise<number | null> {
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
      include: {
        role: {
          select: { level: true },
        },
      },
    });

    return tenantRole?.role.level ?? null;
  }
}