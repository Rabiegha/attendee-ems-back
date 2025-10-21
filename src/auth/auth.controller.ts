import { Controller, Post, Body, UnauthorizedException, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiCookieAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '../config/config.service';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('login')
  @ApiOperation({
    summary: 'Connexion utilisateur',
    description: 'Authentifie un utilisateur et retourne un token JWT avec refresh token en cookie'
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        expires_in: {
          type: 'number',
          example: 900,
          description: 'Durée de validité du token en secondes'
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
            email: { type: 'string', example: 'user@example.com' },
            org_id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440001' },
            role: { type: 'string', example: 'admin' },
            permissions: { type: 'array', items: { type: 'string' }, example: ['users.read', 'users.write'] }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Identifiants invalides'
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ctx = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
    };

    const result = await this.authService.loginWithRefreshToken(user, ctx);

    // Set refresh token as HttpOnly cookie
    const cookieOptions = {
      httpOnly: true,
      secure: this.configService.authCookieSecure,
      sameSite: this.configService.authCookieSameSite as 'strict' | 'lax' | 'none',
      path: '/',
      maxAge: this.secondsFromTtl(this.configService.jwtRefreshTtl) * 1000,
    };

    if (this.configService.authCookieDomain) {
      (cookieOptions as any).domain = this.configService.authCookieDomain;
    }

    res.cookie(this.configService.authCookieName, result.refresh_token, cookieOptions);

    // Return access token and user info (no refresh token in response)
    return {
      access_token: result.access_token,
      expires_in: result.expires_in,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renouvellement du token d\'accès',
    description: 'Utilise le refresh token en cookie pour générer un nouveau token d\'accès'
  })
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    description: 'Token renouvelé avec succès',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        expires_in: {
          type: 'number',
          example: 900,
          description: 'Durée de validité du token en secondes'
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token invalide ou expiré'
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies[this.configService.authCookieName];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const ctx = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
    };

    const result = await this.authService.rotateRefreshToken(refreshToken, ctx);

    // Set new refresh token as HttpOnly cookie
    const cookieOptions = {
      httpOnly: true,
      secure: this.configService.authCookieSecure,
      sameSite: this.configService.authCookieSameSite as 'strict' | 'lax' | 'none',
      path: '/',
      maxAge: this.secondsFromTtl(this.configService.jwtRefreshTtl) * 1000,
    };

    if (this.configService.authCookieDomain) {
      (cookieOptions as any).domain = this.configService.authCookieDomain;
    }

    res.cookie(this.configService.authCookieName, result.newRefreshTokenRaw, cookieOptions);

    return {
      access_token: result.access.token,
      expires_in: result.access.expiresIn,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Déconnexion utilisateur',
    description: 'Révoque le refresh token et supprime le cookie'
  })
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    description: 'Déconnexion réussie',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true }
      }
    }
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies[this.configService.authCookieName];

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    // Clear the refresh token cookie
    res.clearCookie(this.configService.authCookieName, { path: '/' });

    return { ok: true };
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
}
