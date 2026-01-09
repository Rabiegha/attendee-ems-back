/**
 * Prisma Membership Adapter
 * Implémentation du port MembershipPort avec Prisma
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infra/db/prisma.service';
import { MembershipPort } from '../../ports/membership.port';

@Injectable()
export class PrismaMembershipAdapter implements MembershipPort {
  constructor(private prisma: PrismaService) {}

  async isMemberOfOrg(userId: string, orgId: string): Promise<boolean> {
    const membership = await this.prisma.orgUser.findUnique({
      where: {
        user_id_org_id: {
          user_id: userId,
          org_id: orgId,
        },
      },
    });

    return membership !== null;
  }

  async getPlatformOrgAccess(userId: string): Promise<string[] | null> {
    // Récupérer le rôle platform
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
      include: {
        role: true,
      },
    });

    if (!platformRole) {
      return null; // Pas de rôle platform
    }

    // Si root OU access_level='GLOBAL', retourner null (accès à toutes les orgs)
    if (platformRole.role.is_root || platformRole.access_level === 'GLOBAL') {
      return null;
    }

    // Sinon, récupérer les orgs assignées
    const accessRecords = await this.prisma.platformUserOrgAccess.findMany({
      where: { user_id: userId },
      select: { org_id: true },
    });

    return accessRecords.map((record) => record.org_id);
  }
}
