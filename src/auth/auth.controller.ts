import { Controller, Post, Body, UnauthorizedException, Req, Res, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiCookieAuth, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../infra/db/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
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
    try {
      // Valider les credentials (vérification basique)
      const user = await this.prisma.user.findUnique({
        where: { email: loginDto.email, is_active: true },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(
        loginDto.password,
        user.password_hash,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Appeler la nouvelle méthode login() (STEP 2)
      const result = await this.authService.login(user);

      return result;
    } catch (error) {
      console.error('[AuthController.login] Error:', error);
      throw error;
    }
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
    @Body() body?: { refresh_token?: string },
  ) {
    // Detect if request is from mobile app
    const isMobileApp = req.headers['x-client-type'] === 'mobile';
    
    // Get refresh token from cookie (web) or body (mobile)
    const refreshToken = isMobileApp 
      ? body?.refresh_token 
      : req.cookies[this.configService.authCookieName];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const ctx = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
    };

    const result = await this.authService.rotateRefreshToken(refreshToken, ctx);

    // Set new refresh token as HttpOnly cookie (web only)
    if (!isMobileApp) {
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
    }

    const response: any = {
      access_token: result.access.token,
      expires_in: result.access.expiresIn,
    };

    // Mobile: Include new refresh token in response body
    if (isMobileApp) {
      response.refresh_token = result.newRefreshTokenRaw;
    }

    return response;
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

  @Get('policy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Récupérer la politique de permissions CASL',
    description: 'Retourne les règles CASL basées sur les permissions actuelles du rôle de l\'utilisateur connecté. Permet la mise à jour en temps réel des permissions côté frontend.'
  })
  @ApiResponse({
    status: 200,
    description: 'Règles CASL retournées avec succès',
    schema: {
      type: 'object',
      properties: {
        rules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', example: 'read' },
              subject: { type: 'string', example: 'User' },
              conditions: { type: 'object', example: { org_id: 'org-uuid' } }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié'
  })
  async getPolicy(@Req() req: any) {
    return await this.authService.getPolicyRules(req.user);
  }

  // ============================================
  // STEP 2: JWT Multi-org + Switch Context
  // ============================================

  @Post('switch-org')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Switcher vers une autre organisation',
    description: 'Génère un nouveau JWT tenant-mode avec l\'organisation spécifiée'
  })
  @ApiBody({ type: SwitchOrgDto })
  @ApiResponse({
    status: 200,
    description: 'Nouveau JWT généré avec succès',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        mode: { type: 'string', example: 'tenant', enum: ['tenant'] }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Accès refusé à cette organisation' })
  async switchOrg(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SwitchOrgDto,
  ) {
    const result = await this.authService.switchOrg(user.sub, dto.orgId);
    return { access_token: result.accessToken, mode: result.mode };
  }

  @Get('me/orgs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtenir la liste des organisations accessibles',
    description: 'Retourne toutes les organisations auxquelles l\'utilisateur a accès'
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des organisations disponibles',
    schema: {
      type: 'object',
      properties: {
        current: { type: 'string', example: 'org-uuid', nullable: true },
        available: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              orgId: { type: 'string' },
              orgSlug: { type: 'string' },
              orgName: { type: 'string' },
              role: { type: 'string' },
              roleLevel: { type: 'number' },
              isPlatform: { type: 'boolean' }
            }
          }
        }
      }
    }
  })
  async getMyOrgs(@CurrentUser() user: JwtPayload) {
    const orgs = await this.authService.getAvailableOrgs(user.sub);
    return {
      current: user.currentOrgId || null,
      available: orgs,
    };
  }

  @Get('me/ability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtenir les permissions pour l\'organisation active',
    description: 'Retourne les modules accessibles et les permissions (grants) pour l\'org active. À appeler après login ou switch-org.'
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions de l\'utilisateur',
    schema: {
      type: 'object',
      properties: {
        orgId: { type: 'string', example: 'org-uuid', nullable: true },
        modules: { type: 'array', items: { type: 'string' }, example: ['events', 'attendees'] },
        grants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', example: 'event.create' },
              scope: { type: 'string', enum: ['any', 'org', 'own'], example: 'org' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Aucun contexte d\'organisation (tenant-no-org)' })
  async getMyAbility(@CurrentUser() user: JwtPayload) {
    // Mode platform : pas de permissions org-specific
    if (user.mode === 'platform') {
      return {
        orgId: null,
        modules: ['platform'],
        grants: [], // Platform permissions à définir ultérieurement
      };
    }

    // Mode tenant sans org → erreur
    if (!user.currentOrgId) {
      throw new UnauthorizedException(
        'No organization context. Please switch to an organization first.',
      );
    }

    // Charger les permissions pour l'org active
    return this.authService.getUserAbility(user.sub, user.currentOrgId);
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
