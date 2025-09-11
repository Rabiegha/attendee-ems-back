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

  get jwtSecret(): string {
    return this.config.JWT_SECRET;
  }

  get jwtExpiresIn(): string {
    return this.config.JWT_EXPIRES_IN;
  }

  get nodeEnv(): string {
    return this.config.NODE_ENV;
  }

  get port(): number {
    return this.config.PORT;
  }
}
