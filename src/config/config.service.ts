import { Injectable } from '@nestjs/common';
import { configSchema, Config } from './validation';

@Injectable()
export class ConfigService {
  private readonly config: Config;

  constructor() {
    const result = configSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(`Configuration validation error: ${result.error.message}`);
    }
    this.config = result.data;
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  get databaseUrl(): string {
    return this.config.DATABASE_URL;
  }

  // JWT Configuration
  get jwtAccessSecret(): string {
    return this.config.JWT_ACCESS_SECRET;
  }

  get jwtRefreshSecret(): string {
    return this.config.JWT_REFRESH_SECRET;
  }

  get jwtAccessTtl(): string {
    return this.config.JWT_ACCESS_TTL;
  }

  get jwtRefreshTtl(): string {
    return this.config.JWT_REFRESH_TTL;
  }

  get jwtExpiresIn(): string {
    return this.config.JWT_EXPIRES_IN;
  }

  // Auth Cookie Configuration
  get authCookieName(): string {
    return this.config.AUTH_COOKIE_NAME;
  }

  get authCookieDomain(): string | undefined {
    return this.config.AUTH_COOKIE_DOMAIN;
  }

  get authCookieSecure(): boolean {
    return this.config.AUTH_COOKIE_SECURE;
  }

  get authCookieSameSite(): 'strict' | 'lax' | 'none' {
    return this.config.AUTH_COOKIE_SAMESITE;
  }

  // CORS Configuration
  get apiCorsOrigin(): string {
    return this.config.API_CORS_ORIGIN;
  }

  get nodeEnv(): string {
    return this.config.NODE_ENV;
  }

  get port(): number {
    return this.config.PORT;
  }
}
