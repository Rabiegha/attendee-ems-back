import { Controller, Post, Body, UnauthorizedException, Req, Res, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiCookieAuth, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/password-reset.dto';
import { ConfigService } from '../config/config.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailService } from '../modules/email/email.service';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private emailService: EmailService,
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

    // Detect if request is from mobile app (via custom header)
    const isMobileApp = req.headers['x-client-type'] === 'mobile';
    
    console.log('[AuthController.login] Client type:', {
      isMobileApp,
      header: req.headers['x-client-type'],
      userAgent: req.get('User-Agent'),
    });

    if (!isMobileApp) {
      // Web: Set refresh token as HttpOnly cookie
      res.cookie(this.configService.authCookieName, result.refresh_token, cookieOptions);
    }

    // Return access token, user info, and organization
    const response: any = {
      access_token: result.access_token,
      expires_in: result.expires_in,
      user: result.user,
    };

    // Include organization if present
    if (result.organization) {
      response.organization = result.organization;
    }

    // Mobile: Include refresh token in response body
    if (isMobileApp) {
      response.refresh_token = result.refresh_token;
      console.log('[AuthController.login] Mobile response includes refresh_token:', {
        hasRefreshToken: !!response.refresh_token,
        refreshTokenType: typeof response.refresh_token,
        refreshTokenLength: response.refresh_token?.length,
      });
    }

    return response;
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

  @Post('password/request-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demander la réinitialisation du mot de passe',
    description: 'Envoie un email avec un lien de réinitialisation. Retourne toujours 200 pour éviter l\'énumération d\'emails.'
  })
  @ApiResponse({
    status: 200,
    description: 'Si l\'email existe, un lien de réinitialisation a été envoyé',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' }
      }
    }
  })
  async requestPasswordReset(@Body() requestDto: RequestPasswordResetDto) {
    const { resetToken, user } = await this.authService.requestPasswordReset(
      requestDto.email,
      requestDto.org_id
    );

    // Seulement envoyer l'email si l'utilisateur existe
    if (user) {
      const resetUrl = `${this.configService.frontendUrl}/auth/reset-password/${resetToken}`;
      
      // Envoyer l'email via le service email centralisé
      await this.emailService.sendPasswordResetEmail({
        email: user.email,
        resetUrl,
        userName: user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : undefined,
      });
      
      console.log(`[Password Reset] Email sent to ${user.email}`);
    }

    // Toujours retourner le même message pour éviter l'énumération d'emails
    return {
      message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
    };
  }

  @Post('password/validate-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Valider un token de réinitialisation',
    description: 'Vérifie qu\'un token de réinitialisation est valide et non expiré'
  })
  @ApiResponse({
    status: 200,
    description: 'Token valide',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        email: { type: 'string', example: 'user@example.com' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Token invalide ou expiré'
  })
  async validateResetToken(@Body() validateDto: any) {
    const user = await this.authService.validatePasswordResetToken(validateDto.token);
    
    return {
      valid: true,
      email: user.email,
    };
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réinitialiser le mot de passe',
    description: 'Définit un nouveau mot de passe avec un token valide'
  })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe réinitialisé avec succès',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Mot de passe réinitialisé avec succès' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Token invalide ou expiré'
  })
  async resetPassword(@Body() resetDto: any) {
    await this.authService.resetPassword(resetDto.token, resetDto.newPassword);
    
    return {
      message: 'Mot de passe réinitialisé avec succès',
    };
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
