import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../infra/db/prisma.service';
import { ConfigService } from '../config/config.service';
import { TenantAccessScope } from '@prisma/client'; // ✅ Import enum Prisma
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload, UserAbility, Grant, AvailableOrg } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ⚠️ LEGACY: Méthode à refactorer (STEP 4)
  async validateUser(email: string, password: string): Promise<any> {
    throw new Error('Method deprecated - use login() instead');
    // const user = await this.prisma.user.findFirst(...);
  }

  // ⚠️ LEGACY: Méthode à refactorer (STEP 4)
  async validateUserById(userId: string): Promise<any> {
    throw new Error('Method deprecated');
  }

  /**
   * Login avec logique multi-org (STEP 2)
   * Décide automatiquement du type de JWT à générer
   */
  async login(user: any) {
    // Charger contexte utilisateur complet
    const userWithContext = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        platformRole: true,
        orgMemberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!userWithContext) {
      throw new UnauthorizedException('User not found');
    }

    // DÉCISION : quel type de token ?
    let tokenResult: { token: string; mode: 'tenant' | 'platform'; hasOrgContext?: boolean };

    // Cas A : Platform user → mode platform
    if (userWithContext.platformRole) {
      tokenResult = { ...(await this.generateJwtForOrg(user.id, null)), hasOrgContext: false };
    }
    // Cas B : Aucune org → erreur
    else if (userWithContext.orgMemberships.length === 0) {
      throw new BadRequestException('User has no organization. Onboarding required.');
    }
    // Cas C : 1 seule org → tenant-mode direct
    else if (userWithContext.orgMemberships.length === 1) {
      const orgId = userWithContext.orgMemberships[0].org_id;
      tokenResult = { ...(await this.generateJwtForOrg(user.id, orgId)), hasOrgContext: true };
    }
    // Cas D : Multi-org → PAS d'org par défaut, user doit choisir
    else {
      // Générer JWT tenant-mode SANS currentOrgId
      // Le front devra appeler /switch-org pour sélectionner une org
      tokenResult = { ...(await this.generateJwtForOrg(user.id, null)), hasOrgContext: false };
    }

    return {
      access_token: tokenResult.token,
      mode: tokenResult.mode,
      // Si tenant-mode sans org, le front affichera le sélecteur
      requiresOrgSelection: tokenResult.mode === 'tenant' && !tokenResult.hasOrgContext,
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  // Utility methods for refresh tokens
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private secondsFromTtl(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 minutes
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }

  async signAccessToken(user: any): Promise<{ token: string; expiresIn: number }> {
    const permissions = user.role?.rolePermissions?.map(
      (rp: any) => `${rp.permission.code}:${rp.permission.scope}`,
    ) || [];

    const payload = {
      sub: user.id,
      org_id: user.org_id,
      role: user.role?.code,
      permissions,
    };

    const token = this.jwtService.sign(payload, {
      secret: this.configService.jwtAccessSecret,
      expiresIn: this.configService.jwtAccessTtl,
    });

    const expiresIn = this.secondsFromTtl(this.configService.jwtAccessTtl);

    return { token, expiresIn };
  }

  async issueRefreshToken(
    user: any, 
    ctx: { ip?: string; userAgent?: string }
  ): Promise<{ token: string; jti: string; expiresAt: Date }> {
    const jti = uuidv4();
    const expiresIn = this.secondsFromTtl(this.configService.jwtRefreshTtl);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const payload = {
      sub: user.id,
      jti,
    };

    const token = this.jwtService.sign(payload, {
      secret: this.configService.jwtRefreshSecret,
      expiresIn: this.configService.jwtRefreshTtl,
    });

    const tokenHash = this.hashToken(token);

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        tokenHash,
        userAgent: ctx.userAgent,
        ip: ctx.ip,
        expiresAt,
      },
    });

    return { token, jti, expiresAt };
  }

  // ⚠️ LEGACY: Méthode à refactorer (STEP 4)
  async rotateRefreshToken(
    oldTokenRaw: string,
    ctx: { ip?: string; userAgent?: string }
  ): Promise<{ access: { token: string; expiresIn: number }; newRefreshTokenRaw: string }> {
    throw new Error('Method deprecated - needs refactoring for multi-tenant');
    /*
    try {
      // Verify the refresh token signature and extract payload
      const payload = this.jwtService.verify(oldTokenRaw, {
        secret: this.configService.jwtRefreshSecret,
      });

      const { sub: userId, jti } = payload;

      // Find the refresh token in database
      // Reste du code commenté pour compilation
      return null;
    } catch (error) {
      throw new Error('Method deprecated - needs refactoring for multi-tenant');
    }
    */
  }

  async revokeRefreshToken(rawOrJti: string): Promise<void> {
    let jti = rawOrJti;

    // If it looks like a JWT, extract the jti
    if (rawOrJti.includes('.')) {
      try {
        const payload = this.jwtService.verify(rawOrJti, {
          secret: this.configService.jwtRefreshSecret,
        });
        jti = payload.jti;
      } catch {
        // If verification fails, treat as jti directly
      }
    }

    await this.prisma.refreshToken.updateMany({
      where: { jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ⚠️ LEGACY: Méthode à refactorer (STEP 4)
  async loginWithRefreshToken(
    user: any,
    ctx: { ip?: string; userAgent?: string }
  ): Promise<{
    access_token: string;
    expires_in: number;
    refresh_token: string;
    user: any;
    organization?: any;
  }> {
    throw new Error('Method deprecated - use login() instead');
  }

  // ⚠️ LEGACY: Méthode à refactorer (STEP 4)
  async getPolicyRules(user: any) {
    throw new Error('Method deprecated - use getUserAbility() instead');
  }

  // ⚠️ LEGACY: Méthode à refactorer (STEP 4)
  private mapPermissionsToCASlRules(
    permissions: string[],
    orgId: string,
    userId: string,
    roleCode: string,
  ): any[] {
    throw new Error('Method deprecated');
  }

  // ============================================
  // STEP 2: JWT Multi-org + Switch Context
  // ============================================

  /**
   * Vérifie que le user a accès à une organisation
   * (membership tenant OU accès platform)
   */
  private async verifyOrgAccess(userId: string, orgId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orgMemberships: true,
        platformRole: true,
        platformOrgAccess: true,
      },
    });

    if (!user) return false;

    // 1. Membership tenant direct
    if (user.orgMemberships.some((m) => m.org_id === orgId)) {
      return true;
    }

    // 2. Platform user avec scope approprié
    if (user.platformRole) {
      const scope = user.platformRole.scope;
      // Scope tenant_any = accès à toutes les orgs (ROOT)
      if (scope === TenantAccessScope.tenant_any) return true;
      // Scope tenant_assigned = vérifier accès spécifique (SUPPORT)
      if (scope === TenantAccessScope.tenant_assigned) {
        return user.platformOrgAccess.some((a) => a.org_id === orgId);
      }
    }

    return false;
  }

  /**
   * Génère un JWT minimal (pas de permissions, pas de liste d'orgs)
   * Le client appellera GET /me/ability pour obtenir les permissions
   */
  async generateJwtForOrg(
    userId: string,
    orgId: string | null,
  ): Promise<{ token: string; mode: 'tenant' | 'platform' }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        platformRole: true,
        orgMemberships: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Déterminer le mode
    const isPlatformUser = !!user.platformRole;

    // Si platform user ET pas d'org spécifiée → mode platform
    if (isPlatformUser && !orgId) {
      const payload: JwtPayload = {
        sub: user.id,
        mode: 'platform',
      };
      return {
        token: this.jwtService.sign(payload),
        mode: 'platform',
      };
    }

    // Mode tenant : vérifier accès à l'org
    if (orgId) {
      const hasAccess = await this.verifyOrgAccess(userId, orgId);
      if (!hasAccess) {
        throw new ForbiddenException('Access to this organization denied');
      }
    }

    // Générer token tenant-mode
    const payload: JwtPayload = {
      sub: user.id,
      mode: 'tenant',
      ...(orgId && { currentOrgId: orgId }), // Seulement si org active
    };

    return {
      token: this.jwtService.sign(payload),
      mode: 'tenant',
    };
  }

  /**
   * Retourne la liste des organisations accessibles par l'utilisateur
   * (Pour l'UI uniquement, ne charge PAS les permissions)
   */
  async getAvailableOrgs(userId: string): Promise<AvailableOrg[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        // Orgs tenant
        orgMemberships: {
          include: {
            organization: true,
          },
        },
        // Rôles tenant par org
        tenantRoles: {
          include: {
            role: true,
            organization: true,
          },
        },
        // Rôle platform
        platformRole: {
          include: {
            role: true,
          },
        },
        // Accès platform assigned
        platformOrgAccess: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const availableOrgs: AvailableOrg[] = [];

    // 1. Orgs tenant (via membership)
    for (const membership of user.orgMemberships) {
      const tenantRole = user.tenantRoles.find(
        (tr) => tr.org_id === membership.org_id,
      );

      if (tenantRole) {
        availableOrgs.push({
          orgId: membership.org_id,
          orgSlug: membership.organization.slug,
          orgName: membership.organization.name,
          role: tenantRole.role.name,
          roleLevel: tenantRole.role.level,
          isPlatform: false,
        });
      }
    }

    // 2. Orgs platform (si rôle platform)
    if (user.platformRole) {
      const platformRole = user.platformRole.role;

      // Scope tenant_any → accès à toutes les orgs (ROOT)
      if (user.platformRole.scope === TenantAccessScope.tenant_any) {
        const allOrgs = await this.prisma.organization.findMany({
          select: { id: true, slug: true, name: true },
        });

        for (const org of allOrgs) {
          // Éviter doublons avec orgs tenant
          if (!availableOrgs.some((o) => o.orgId === org.id)) {
            availableOrgs.push({
              orgId: org.id,
              orgSlug: org.slug,
              orgName: org.name,
              role: platformRole.name,
              roleLevel: platformRole.level,
              isPlatform: true,
            });
          }
        }
      }
      // Scope tenant_assigned → accès aux orgs assignées (SUPPORT)
      else if (user.platformRole.scope === TenantAccessScope.tenant_assigned) {
        for (const access of user.platformOrgAccess) {
          if (!availableOrgs.some((o) => o.orgId === access.org_id)) {
            availableOrgs.push({
              orgId: access.org_id,
              orgSlug: access.organization.slug,
              orgName: access.organization.name,
              role: platformRole.name,
              roleLevel: platformRole.level,
              isPlatform: true,
            });
          }
        }
      }
    }

    // Tri par nom d'org
    return availableOrgs.sort((a, b) => a.orgName.localeCompare(b.orgName));
  }

  /**
   * Switch vers une autre organisation
   * Génère un nouveau JWT tenant-mode avec la nouvelle org
   */
  async switchOrg(
    userId: string,
    orgId: string,
  ): Promise<{ accessToken: string; mode: 'tenant' | 'platform' }> {
    // Vérifier accès
    const hasAccess = await this.verifyOrgAccess(userId, orgId);
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    // Générer nouveau JWT tenant-mode
    const result = await this.generateJwtForOrg(userId, orgId);
    
    return {
      accessToken: result.token,
      mode: result.mode,
    };
  }

  /**
   * Retourne les permissions de l'utilisateur pour une org donnée
   * Appelé par GET /auth/me/ability
   */
  async getUserAbility(userId: string, orgId: string): Promise<UserAbility> {
    // 1. Trouver le rôle de l'user dans cette org
    const tenantRole = await this.prisma.tenantUserRole.findFirst({
      where: {
        user_id: userId,
        org_id: orgId,
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

    if (!tenantRole) {
      throw new NotFoundException('User has no role in this organization');
    }

    // 2. Extraire les permissions avec leurs scopes
    const grants: Grant[] = tenantRole.role.rolePermissions.map((rp) => ({
      key: rp.permission.code, // TODO: Ajouter 'key' dans la migration
      scope: rp.permission.scope as any, // TODO: Ajuster avec scope_limit
    }));

    // 3. Déterminer les modules accessibles
    const modules = await this.getEnabledModules(orgId);

    return {
      orgId,
      modules,
      grants,
    };
  }

  /**
   * Retourne les modules activés pour une org (basé sur le plan)
   */
  private async getEnabledModules(orgId: string): Promise<string[]> {
    // TODO: Implémenter avec subscriptions + plans
    // Pour l'instant retourner des modules par défaut
    return ['events', 'attendees', 'badges'];
  }
}
