import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const COOKIE_NAMES = {
  ACCESS: 'akashvault_access',
  REFRESH: 'akashvault_refresh',
  SETUP: 'akashvault_setup',
  RESET: 'akashvault_reset',
  CSRF: 'csrf_token',
};

export function signAccessToken({ userId, sessionId }) {
  return jwt.sign(
    {
      sub: String(userId),
      sid: String(sessionId),
      typ: 'access',
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.ACCESS_TOKEN_EXPIRY,
      issuer: 'akashvault-auth',
      audience: 'akashvault-client',
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'akashvault-auth',
    audience: 'akashvault-client',
  });
}

/**
 * Sign a short-lived, strictly scoped token for post-OTP PIN creation or PIN reset.
 */
export function signScopedActionToken({ userId, purpose }) {
  return jwt.sign(
    {
      sub: String(userId),
      typ: purpose,
    },
    env.JWT_SETUP_SECRET,
    {
      expiresIn: `${env.SETUP_TOKEN_EXPIRY_MINUTES}m`,
      issuer: 'akashvault-auth',
      audience: 'akashvault-client',
    }
  );
}

export function verifyScopedActionToken(token, expectedPurpose) {
  const payload = jwt.verify(token, env.JWT_SETUP_SECRET, {
    issuer: 'akashvault-auth',
    audience: 'akashvault-client',
  });
  if (payload.typ !== expectedPurpose) {
    throw new Error('Invalid token scope');
  }
  return payload;
}

export function getCookieOptions({ httpOnly = true, maxAgeMs } = {}) {
  return {
    httpOnly,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
    ...(typeof maxAgeMs === 'number' ? { maxAge: maxAgeMs } : {}),
  };
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(
    COOKIE_NAMES.ACCESS,
    accessToken,
    getCookieOptions({ httpOnly: true, maxAgeMs: 15 * 60 * 1000 })
  );
  res.cookie(
    COOKIE_NAMES.REFRESH,
    refreshToken,
    getCookieOptions({
      httpOnly: true,
      maxAgeMs: env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    })
  );
}

export function clearAuthCookies(res) {
  const opts = getCookieOptions({ httpOnly: true });
  res.clearCookie(COOKIE_NAMES.ACCESS, opts);
  res.clearCookie(COOKIE_NAMES.REFRESH, opts);
}

export function setScopedCookie(res, cookieName, token) {
  res.cookie(
    cookieName,
    token,
    getCookieOptions({
      httpOnly: true,
      maxAgeMs: env.SETUP_TOKEN_EXPIRY_MINUTES * 60 * 1000,
    })
  );
}

export function clearScopedCookie(res, cookieName) {
  res.clearCookie(cookieName, getCookieOptions({ httpOnly: true }));
}
