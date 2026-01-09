/**
 * Prisma Auth Context Adapter
 * Construit un AuthContext complet depuis un JWT minimal
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infra/db/prisma.service';
import { AuthContextPort, JwtPayload } from '../../ports/auth-context.port';
import { AuthContext } from '../../core/types';

@Injectable()
export class PrismaAuthContextAdapter implements AuthContextPort {
  constructor(private prisma: PrismaService) {}

  async buildAuthContext(jwtPayload: JwtPayload): Promise<AuthContext> {
    const { sub: userId, mode, currentOrgId } = jwtPayload;

    // Si mode platform, récupérer isPlatform et isRoot depuis la DB
    if (mode === 'platform') {
      const platformRole = await this.prisma.platformUserRole.findUnique({
        where: { user_id: userId },
        include: { role: true },
      });

      return {
        userId,
        mode: 'platform',
        isPlatform: true,
        isRoot: platformRole?.role.is_root || false,
        currentOrgId: null,
      };
    }

    // Mode tenant
    return {
      userId,
      mode: 'tenant',
      isPlatform: false,
      isRoot: false,
      currentOrgId: currentOrgId || null,
    };
  }
}
