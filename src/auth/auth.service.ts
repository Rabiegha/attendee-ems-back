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
      (rp: any) => rp.permission.code,
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
      (rp: any) => rp.permission.code,
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
        // Reuse detection: revoke all user sessions
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
      permissions: user.role?.rolePermissions?.map((rp: any) => rp.permission.code) || [],
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
}
