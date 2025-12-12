import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../infra/db/prisma.service';
import { ConfigService } from '../config/config.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

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

  async login(user: any) {
    const permissions = user.role?.rolePermissions?.map(
      (rp: any) => `${rp.permission.code}:${rp.permission.scope}`,
    ) || [];

    const payload = {
      sub: user.id,
      org_id: user.org_id,
      role: user.role?.code,
      permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
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

  /**
   * Génère un token de réinitialisation de mot de passe
   */
  async requestPasswordReset(email: string, orgId?: string): Promise<{ resetToken: string; user: any }> {
    // Chercher par email uniquement (un utilisateur peut avoir plusieurs organisations)
    const user = await this.prisma.user.findFirst({
      where: { 
        email,
        is_active: true 
      },
    });

    if (!user) {
      // Pour des raisons de sécurité, on ne révèle pas si l'email existe ou non
      // On génère quand même un token fictif pour éviter le timing attack
      const fakeToken = crypto.randomBytes(32).toString('hex');
      return { resetToken: fakeToken, user: null };
    }

    // Générer un token sécurisé
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expire dans 1 heure

    // Stocker le token hashé dans la base de données
    const hashedToken = this.hashToken(resetToken);
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        reset_token: hashedToken,
        reset_token_expires_at: expiresAt,
      },
    });

    return { resetToken, user };
  }

  /**
   * Valide un token de réinitialisation
   */
  async validatePasswordResetToken(token: string): Promise<any> {
    const hashedToken = this.hashToken(token);
    
    const user = await this.prisma.user.findFirst({
      where: {
        reset_token: hashedToken,
        reset_token_expires_at: {
          gt: new Date(), // Token non expiré
        },
        is_active: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Token de réinitialisation invalide ou expiré');
    }

    return user;
  }

  /**
   * Réinitialise le mot de passe avec un token valide
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.validatePasswordResetToken(token);

    const hashedPassword = await this.hashPassword(newPassword);

    // Mettre à jour le mot de passe et supprimer le token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expires_at: null,
      },
    });

    // Optionnel : Révoquer tous les refresh tokens existants pour forcer la reconnexion
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });
  }
}
