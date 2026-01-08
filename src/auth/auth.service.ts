import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../infra/db/prisma.service';
import { ConfigService } from '../config/config.service';
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

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findFirst({
      where: { 
        email, 
        is_active: true 
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

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async validateUserById(userId: string): Promise<any> {
    const user = await this.prisma.user.findFirst({
      where: { 
        id: userId, 
        is_active: true 
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

    return user;
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
    let tokenResult: { token: string; mode: 'tenant' | 'platform' };

    // Cas A : Platform user → mode platform
    if (userWithContext.platformRole) {
      tokenResult = await this.generateJwtForOrg(user.id, null);
    }
    // Cas B : Aucune org → erreur
    else if (userWithContext.orgMemberships.length === 0) {
      throw new BadRequestException('User has no organization. Onboarding required.');
    }
    // Cas C : 1 seule org → tenant-mode direct
    else if (userWithContext.orgMemberships.length === 1) {
      const orgId = userWithContext.orgMemberships[0].org_id;
      tokenResult = await this.generateJwtForOrg(user.id, orgId);
    }
    // Cas D : Multi-org → chercher default ou renvoyer tenant-no-org
    else {
      const defaultMembership = userWithContext.orgMemberships.find(
        (m) => m.is_default,
      );
      const orgId = defaultMembership?.org_id || null;
      tokenResult = await this.generateJwtForOrg(user.id, orgId);
    }

    return {
      access_token: tokenResult.token,
      mode: tokenResult.mode,
      // Si tenant-no-org, le front affichera le sélecteur
      requiresOrgSelection: tokenResult.mode === 'tenant' && !tokenResult.token.includes('currentOrgId'),
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

  async rotateRefreshToken(
    oldTokenRaw: string,
    ctx: { ip?: string; userAgent?: string }
  ): Promise<{ access: { token: string; expiresIn: number }; newRefreshTokenRaw: string }> {
    try {
      // Verify the refresh token signature and extract payload
      const payload = this.jwtService.verify(oldTokenRaw, {
        secret: this.configService.jwtRefreshSecret,
      });

      const { sub: userId, jti } = payload;

      // Find the refresh token in database
      const refreshTokenRecord = await this.prisma.refreshToken.findUnique({
        where: { jti },
        include: { user: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
      });

      if (!refreshTokenRecord) {
        throw new UnauthorizedException('Refresh token not found');
      }

      // Check if token is revoked
      if (refreshTokenRecord.revokedAt) {
        // Tolérance de 30 secondes pour la réutilisation (race conditions, multi-onglets)
        const revokedRecently = refreshTokenRecord.revokedAt.getTime() > Date.now() - 30000;
        
        if (revokedRecently && refreshTokenRecord.replacedById) {
          // Token révoqué récemment et remplacé : retourner le nouveau token au lieu de révoquer tout
          console.log('[AUTH] Token recently revoked, returning replacement token');
          const replacementToken = await this.prisma.refreshToken.findUnique({
            where: { jti: refreshTokenRecord.replacedById },
            include: { user: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
          });
          
          if (replacementToken && !replacementToken.revokedAt && replacementToken.expiresAt > new Date()) {
            // Le token de remplacement est valide, générer un access token
            const user = replacementToken.user;
            const newAccessToken = await this.signAccessToken(user);
            
            return {
              access: {
                token: newAccessToken.token,
                expiresIn: newAccessToken.expiresIn,
              },
              newRefreshTokenRaw: oldTokenRaw, // Garder le même refresh token (déjà remplacé)
            };
          }
        }
        
        // Token révoqué depuis longtemps ou pas de remplacement valide : révoquer toutes les sessions
        await this.revokeAllUserSessions(userId);
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // Check if token is expired
      if (refreshTokenRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token has expired');
      }

      // Verify token hash matches
      const tokenHash = this.hashToken(oldTokenRaw);
      if (refreshTokenRecord.tokenHash !== tokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user data
      const user = refreshTokenRecord.user;
      if (!user || !user.is_active) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Issue new tokens
      const newAccessToken = await this.signAccessToken(user);
      const newRefreshToken = await this.issueRefreshToken(user, ctx);

      // Revoke old refresh token and link to new one
      await this.prisma.refreshToken.update({
        where: { jti },
        data: {
          revokedAt: new Date(),
          replacedById: newRefreshToken.jti,
        },
      });

      return {
        access: newAccessToken,
        newRefreshTokenRaw: newRefreshToken.token,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
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

  // Updated login method to include refresh token
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
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user, ctx);

    // Fetch organization data if not already included
    let organization = null;
    if (user.org_id) {
      organization = await this.prisma.organization.findUnique({
        where: { id: user.org_id },
        select: { id: true, name: true, slug: true },
      });
    }

    const userResponse = {
      id: user.id,
      email: user.email,
      org_id: user.org_id,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role?.code,
      permissions: user.role?.rolePermissions?.map((rp: any) => `${rp.permission.code}:${rp.permission.scope}`) || [],
    };

    const result: any = {
      access_token: accessToken.token,
      expires_in: accessToken.expiresIn,
      refresh_token: refreshToken.token,
      user: userResponse,
    };

    // Only include organization if it exists
    if (organization) {
      result.organization = organization;
    }

    return result;
  }

  /**
   * Génère les règles CASL basées sur les permissions actuelles de l'utilisateur
   * Permet la mise à jour en temps réel des permissions côté frontend
   */
  async getPolicyRules(user: any) {
    console.log('[Auth] getPolicyRules called with user:', user);
    
    // Le JWT guard injecte l'objet user avec { id, org_id, role, permissions }
    // Pas user.sub comme dans d'autres contextes
    const userId = user.id || user.sub;
    
    // Récupérer l'utilisateur avec ses permissions à jour
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
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

    if (!currentUser || !currentUser.is_active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    console.log('[Auth] Found user with role:', currentUser.role?.code);
    console.log('[Auth] Permissions count:', currentUser.role?.rolePermissions?.length);

    // SUPER_ADMIN bypass : accès total cross-tenant
    if (currentUser.role?.code === 'SUPER_ADMIN') {
      console.log('[Auth] SUPER_ADMIN detected - granting full access');
      return {
        rules: [
          {
            action: 'manage',
            subject: 'all',
          },
        ],
      };
    }

    // Extraire les permissions avec scopes
    const permissions = currentUser.role?.rolePermissions?.map(
      (rp: any) => `${rp.permission.code}:${rp.permission.scope}`,
    ) || [];

    // Mapper les permissions backend en règles CASL
    const rules = this.mapPermissionsToCASlRules(
      permissions,
      currentUser.org_id,
      currentUser.id,
      currentUser.role?.code,
    );

    return { rules };
  }

  /**
   * Mappe les permissions backend en règles CASL
   */
  private mapPermissionsToCASlRules(
    permissions: string[],
    orgId: string,
    userId: string,
    roleCode: string,
  ): any[] {
    const rules: any[] = [];

    // Pour chaque permission, créer les règles CASL appropriées
    permissions.forEach(permission => {
      const [resource, action, scope] = permission.split(/[.:]/);
      
      // Actions CRUD mapping
      let caslActions: string[] = [];
      switch (action) {
        case 'create':
          caslActions = ['create'];
          break;
        case 'read':
          caslActions = ['read'];
          break;
        case 'update':
          caslActions = ['update'];
          break;
        case 'delete':
          caslActions = ['delete'];
          break;
        case 'manage':
          caslActions = ['manage']; // CASL 'manage' = toutes les actions
          break;
        default:
          caslActions = [action]; // custom actions
      }

      // Subject mapping (resource -> CASL subject)
      const subjectMap: Record<string, string> = {
        users: 'User',
        roles: 'Role',
        events: 'Event',
        attendees: 'Attendee',
        organizations: 'Organization',
        invitations: 'Invitation',
        analytics: 'Analytics',
        reports: 'Report',
      };

      const subject = subjectMap[resource] || resource;

      // Conditions basées sur le scope
      let conditions: any = {};
      
      if (scope === 'own') {
        // Accès limité aux ressources de l'utilisateur
        if (resource === 'users') {
          conditions = { id: userId };
        } else {
          conditions = { user_id: userId };
        }
      } else if (scope === 'org') {
        // Accès limité à l'organisation
        conditions = { org_id: orgId };
      }
      // scope === 'any' ou pas de scope = pas de conditions (accès global)

      // Ajouter une règle pour chaque action
      caslActions.forEach(caslAction => {
        rules.push({
          action: caslAction,
          subject,
          ...(Object.keys(conditions).length > 0 && { conditions }),
        });
      });
    });

    // Note: SUPER_ADMIN bypass est géré directement dans getPolicyRules()
    // pour éviter le traitement inutile des permissions

    return rules;
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
      // Scope global = accès à toutes les orgs
      if (scope === 'global') return true;
      // Scope assigned = vérifier accès spécifique
      if (scope === 'assigned') {
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
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 7, // 7 jours
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
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
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

      // Scope global → accès à toutes les orgs
      if (user.platformRole.scope === 'global') {
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
      // Scope assigned → accès aux orgs assignées
      else if (user.platformRole.scope === 'assigned') {
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
  ): Promise<{ accessToken: string; mode: 'tenant' }> {
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
      key: rp.permission.key,
      scope: rp.scope_limit as 'any' | 'org' | 'own',
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
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        subscription: {
          include: {
            plan: {
              include: {
                planModules: {
                  include: {
                    module: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!org?.subscription?.plan) {
      return [];
    }

    return org.subscription.plan.planModules.map((pm) => pm.module.key);
  }
}
