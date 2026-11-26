import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  GAME_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  ADMIN_ORIGIN: z.string().min(1).default('http://localhost:5174'),
  ADMIN_EMAIL: z.string().email().optional(),
});

export function loadEnv(overrides = {}) {
  const merged = { ...process.env, ...overrides };
  const parsed = envSchema.safeParse(merged);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const parseOrigins = (raw) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    ...parsed.data,
    GAME_ORIGINS: parseOrigins(parsed.data.GAME_ORIGIN),
    ADMIN_ORIGINS: parseOrigins(parsed.data.ADMIN_ORIGIN),
    ALLOWED_ORIGINS: Array.from(
      new Set([
        ...parseOrigins(parsed.data.GAME_ORIGIN),
        ...parseOrigins(parsed.data.ADMIN_ORIGIN),
      ])
    ),
  };
}
