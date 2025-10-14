import { z } from 'zod';

export const configSchema = z.object({
  DATABASE_URL: z.string(),
  
  // JWT Configuration
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  
  // Legacy JWT (for backward compatibility)
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('900s'),
  
  // Auth Cookie Configuration
  AUTH_COOKIE_NAME: z.string().default('__Host-refresh_token'),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  AUTH_COOKIE_SECURE: z.string().transform(val => val === 'true').default('true'),
  AUTH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  
  // CORS Configuration
  API_CORS_ORIGIN: z.string().default('http://localhost:3001'),
  
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
});

export type Config = z.infer<typeof configSchema>;
