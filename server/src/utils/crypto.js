import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/**
 * Generate a cryptographically random 6-digit numeric OTP string.
 */
export function generateSixDigitOTP() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Generate a high-entropy opaque token (used for refresh tokens and CSRF tokens).
 */
export function generateOpaqueToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Compute an HMAC-SHA256 digest bound to a domain purpose so hashes cannot be reused across contexts.
 */
export function hashOtp(otp, context, secret = env.OTP_HMAC_SECRET) {
  return crypto
    .createHmac('sha256', secret)
    .update(`otp:${context}:${otp}`)
    .digest('hex');
}

/**
 * Compute an HMAC-SHA256 digest for refresh tokens before storing in MongoDB.
 */
export function hashRefreshToken(token, secret = env.REFRESH_HMAC_SECRET) {
  return crypto
    .createHmac('sha256', secret)
    .update(`refresh:${token}`)
    .digest('hex');
}

/**
 * Timing-safe hex digest comparison to mitigate side-channel timing leaks.
 */
export function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hash a 6-digit PIN string with bcrypt. Always preserves string type and leading zeroes.
 */
export async function hashPin(pin) {
  const rounds = env.NODE_ENV === 'test' ? Math.min(env.BCRYPT_ROUNDS, 6) : env.BCRYPT_ROUNDS;
  return bcrypt.hash(String(pin), rounds);
}

/**
 * Verify a candidate 6-digit PIN against a stored bcrypt hash.
 */
export async function verifyPin(candidatePin, storedHash) {
  if (!candidatePin || !storedHash) {
    return false;
  }
  return bcrypt.compare(String(candidatePin), storedHash);
}
