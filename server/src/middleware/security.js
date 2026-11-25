import { env } from '../config/env.js';
import { generateOpaqueToken, timingSafeEqualHex } from '../utils/crypto.js';
import { COOKIE_NAMES, getCookieOptions } from '../utils/token.js';
import { sendError } from '../utils/response.js';
import crypto from 'node:crypto';

function sanitizeObject(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeObject);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      // Strip MongoDB query operators ($...) and dot-notation keys
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      clean[key] = sanitizeObject(val);
    }
    return clean;
  }
  return value;
}

/**
 * Prevents NoSQL operator injection and prototype pollution on body, query, and params.
 */
export function sanitizeMongoInput(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

/**
 * Enforces application/json Content-Type on mutating requests carrying payloads.
 */
export function requireJsonContentType(req, res, next) {
  const mutatingMethods = new Set(['POST', 'PUT', 'PATCH']);
  if (!mutatingMethods.has(req.method)) {
    return next();
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength === 0 && (!req.body || Object.keys(req.body).length === 0)) {
    return next();
  }

  if (!req.is('application/json')) {
    return sendError(
      res,
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Requests must use application/json content type.'
    );
  }
  return next();
}

/**
 * Issues a readable CSRF token cookie for double-submit protection.
 */
export function issueCsrfToken(res) {
  const token = generateOpaqueToken(32);
  res.cookie(
    COOKIE_NAMES.CSRF,
    token,
    getCookieOptions({
      httpOnly: false,
      maxAgeMs: 24 * 60 * 60 * 1000,
    })
  );
  return token;
}

/**
 * Verifies double-submit CSRF cookie + header and validates Origin on state-changing requests.
 */
export function csrfProtection(req, res, next) {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (safeMethods.has(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  if (origin && origin !== env.APP_ORIGIN) {
    return sendError(res, 403, 'CSRF_ORIGIN_MISMATCH', 'Request origin is not permitted.');
  }

  const cookieToken = req.cookies?.[COOKIE_NAMES.CSRF];
  const headerToken = req.headers['x-csrf-token'];

  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    cookieToken.length < 16 ||
    cookieToken.length !== headerToken.length
  ) {
    return sendError(
      res,
      403,
      'CSRF_TOKEN_INVALID',
      'Security verification failed. Refresh the page and try again.'
    );
  }

  const hashA = crypto.createHash('sha256').update(cookieToken).digest('hex');
  const hashB = crypto.createHash('sha256').update(headerToken).digest('hex');

  if (!timingSafeEqualHex(hashA, hashB)) {
    return sendError(
      res,
      403,
      'CSRF_TOKEN_INVALID',
      'Security verification failed. Refresh the page and try again.'
    );
  }

  return next();
}
