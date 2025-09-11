import { z } from 'zod';

export const configSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('900s'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
});

export type Config = z.infer<typeof configSchema>;
