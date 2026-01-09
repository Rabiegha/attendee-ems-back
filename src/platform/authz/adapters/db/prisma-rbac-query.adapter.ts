/**
 * Prisma RBAC Query Adapter
 * Implémentation du port RbacQueryPort avec Prisma
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infra/db/prisma.service';
import { RbacQueryPort } from '../../ports/rbac-query.port';
import { Grant, TenantRole, PlatformRole } from '../../core/types';

@Injectable()
export class PrismaRbacQueryAdapter implements RbacQueryPort {
  constructor(private prisma: PrismaService) {}

  async getTenantRoleForUserInOrg(userId: string, orgId: string): Promise<TenantRole | null> {
    const tenantUserRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
      include: {
        role: true,
      },
    });

    if (!tenantUserRole) {
      return null;
    }

    const { role } = tenantUserRole;

    // Récupérer les grants pour ce rôle
    const grants = await this.getGrantsForTenantRole(role.id);

    return {
      id: role.id,
      orgId: role.org_id!,
      code: role.code,
      name: role.name,
      level: role.level || 0,
      rank: role.rank || 0,
      grants,
    };
  }

  async getPlatformRoleForUser(userId: string): Promise<PlatformRole | null> {
    const platformUserRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
      include: {
        role: true,
      },
    });

    if (!platformUserRole) {
      return null;
    }

    const { role } = platformUserRole;

    // Récupérer les grants pour ce rôle
    const grants = await this.getGrantsForPlatformRole(role.id);

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      isRoot: role.is_root || false,
      orgAccessLevel: platformUserRole.access_level, // Direct, pas de conversion
      grants,
    };
  }

  async getGrantsForTenantRole(roleId: string): Promise<Grant[]> {
    // MVP: Retourne les grants depuis role_permissions
    // TODO: Implémenter avec la vraie table role_permissions quand créée
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return [];
    }

    // MVP: Mapper les permissions basiques selon le code du rôle
    return this.getMockGrantsForRoleCode(role.code);
  }

  async getGrantsForPlatformRole(roleId: string): Promise<Grant[]> {
    // MVP: Retourne les grants depuis role_permissions
    // TODO: Implémenter avec la vraie table role_permissions quand créée
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return [];
    }

    if (role.is_root) {
      // Root a toutes les permissions avec scope 'any'
      return this.getAllPermissionsWithAnyScope();
    }

    // Support a un sous-ensemble de permissions
    return this.getMockGrantsForRoleCode(role.code);
  }

  /**
   * MVP: Mock grants basé sur le code du rôle
   * TODO: Remplacer par vraie table role_permissions
   */
  private getMockGrantsForRoleCode(roleCode: string): Grant[] {
    const grantsMap: Record<string, Grant[]> = {
      ADMIN: [
        { key: 'event.create', scope: 'org' },
        { key: 'event.read', scope: 'org' },
        { key: 'event.update', scope: 'org' },
        { key: 'event.delete', scope: 'org' },
        { key: 'attendee.create', scope: 'org' },
        { key: 'attendee.read', scope: 'org' },
        { key: 'attendee.update', scope: 'org' },
        { key: 'attendee.delete', scope: 'org' },
        { key: 'attendee.checkin', scope: 'org' },
        { key: 'badge.create', scope: 'org' },
        { key: 'badge.read', scope: 'org' },
        { key: 'badge.print', scope: 'org' },
        { key: 'user.invite', scope: 'org' },
        { key: 'user.manage', scope: 'org' },
      ],
      MANAGER: [
        { key: 'event.create', scope: 'org' },
        { key: 'event.read', scope: 'org' },
        { key: 'event.update', scope: 'assigned' },
        { key: 'attendee.create', scope: 'org' },
        { key: 'attendee.read', scope: 'org' },
        { key: 'attendee.update', scope: 'assigned' },
        { key: 'attendee.checkin', scope: 'org' },
        { key: 'badge.read', scope: 'org' },
        { key: 'badge.print', scope: 'org' },
      ],
      STAFF: [
        { key: 'event.read', scope: 'org' },
        { key: 'attendee.read', scope: 'org' },
        { key: 'attendee.checkin', scope: 'org' },
        { key: 'badge.read', scope: 'assigned' },
      ],
      VIEWER: [
        { key: 'event.read', scope: 'org' },
        { key: 'attendee.read', scope: 'org' },
      ],
      SUPPORT: [
        { key: 'event.read', scope: 'any' },
        { key: 'attendee.read', scope: 'any' },
        { key: 'user.read', scope: 'any' },
      ],
    };

    return grantsMap[roleCode] || [];
  }

  /**
   * Retourne toutes les permissions avec scope 'any' (pour root)
   */
  private getAllPermissionsWithAnyScope(): Grant[] {
    return [
      // Events
      { key: 'event.create', scope: 'any' },
      { key: 'event.read', scope: 'any' },
      { key: 'event.update', scope: 'any' },
      { key: 'event.delete', scope: 'any' },
      // Attendees
      { key: 'attendee.create', scope: 'any' },
      { key: 'attendee.read', scope: 'any' },
      { key: 'attendee.update', scope: 'any' },
      { key: 'attendee.delete', scope: 'any' },
      { key: 'attendee.checkin', scope: 'any' },
      // Badges
      { key: 'badge.create', scope: 'any' },
      { key: 'badge.read', scope: 'any' },
      { key: 'badge.print', scope: 'any' },
      // Users
      { key: 'user.invite', scope: 'any' },
      { key: 'user.manage', scope: 'any' },
      { key: 'user.read', scope: 'any' },
      // Organizations
      { key: 'org.manage', scope: 'any' },
      // Platform
      { key: 'platform.admin', scope: 'any' },
    ];
  }
}