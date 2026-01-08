import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '../config/config.service';
import { AuthService } from './auth.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.jwtAccessSecret,
    });
  }

  /**
   * Valide le JWT et retourne le payload complet (STEP 2)
   * Pas de validation DB supplémentaire pour les performances
   */
  async validate(payload: any): Promise<JwtPayload> {
    // Retourner le payload complet (incluant mode + currentOrgId)
    return {
      sub: payload.sub,
      mode: payload.mode || 'tenant', // Fallback pour anciens JWT
      currentOrgId: payload.currentOrgId,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}

