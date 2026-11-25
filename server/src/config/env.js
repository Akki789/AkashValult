import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env first, falling back to root .env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  APP_ORIGIN: z
    .string()
    .url()
    .default('http://localhost:5173')
    .transform((val) => new URL(val).origin),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/akashvault'),

  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_SETUP_SECRET: z.string().min(32).optional(),
  OTP_HMAC_SECRET: z.string().min(32).optional(),
  REFRESH_HMAC_SECRET: z.string().min(32).optional(),

  ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  SETUP_TOKEN_EXPIRY_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),

  MIN_AGE_YEARS: z.coerce.number().int().min(13).max(120).default(18),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().min(1).max(30).default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(10).max(600).default(60),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),

  EMAIL_PROVIDER: z.enum(['smtp', 'console']).default('smtp'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('AkashVault <no-reply@example.com>'),

  SMS_PROVIDER: z.enum(['twilio', 'console']).default('twilio'),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_FROM_NUMBER: z.string().optional().default(''),
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

  const data = parsed.data;
  const isProd = data.NODE_ENV === 'production';

  const requiredInProd = [
    'JWT_ACCESS_SECRET',
    'JWT_SETUP_SECRET',
    'OTP_HMAC_SECRET',
    'REFRESH_HMAC_SECRET',
  ];

  if (isProd) {
    for (const key of requiredInProd) {
      if (!data[key] || data[key].includes('replace-with-strong-random')) {
        throw new Error(`Missing or unsafe production secret: ${key}`);
      }
    }
  }

  // Only allow ephemeral non-production fallback secrets in test/dev
  return {
    ...data,
    JWT_ACCESS_SECRET:
      data.JWT_ACCESS_SECRET || 'dev-only-jwt-access-secret-minimum-32-chars-long',
    JWT_SETUP_SECRET:
      data.JWT_SETUP_SECRET || 'dev-only-jwt-setup-secret-minimum-32-chars-long!',
    OTP_HMAC_SECRET:
      data.OTP_HMAC_SECRET || 'dev-only-otp-hmac-secret-minimum-32-chars-long!',
    REFRESH_HMAC_SECRET:
      data.REFRESH_HMAC_SECRET || 'dev-only-refresh-hmac-secret-min-32-chars-long',
    COOKIE_SECURE: isProd ? true : Boolean(data.COOKIE_SECURE),
    COOKIE_SAME_SITE: data.COOKIE_SAME_SITE || (isProd ? 'none' : 'lax'),
  };
}

export const env = loadEnv();
