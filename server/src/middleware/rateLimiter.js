import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { parseIdentifier } from '../validators/authValidators.js';

function createRateLimitHandler(message) {
  return (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
      },
    });
  };
}

export function createRateLimiters({ forceEnableInTest = false } = {}) {
  const shouldSkip = () => env.NODE_ENV === 'test' && !forceEnableInTest;

  const globalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
      shouldSkip() || (req.method === 'GET' && req.path === '/auth/session'),
    handler: createRateLimitHandler(
      'Too many requests from this network. Please pause and try again shortly.'
    ),
  });

  // Generous limiter for active session heartbeat checks
  const sessionCheckLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    handler: createRateLimitHandler(
      'Too many session status checks. Please pause and try again shortly.'
    ),
  });

  // IP-based login limiter
  const loginIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    handler: createRateLimitHandler(
      'Too many sign-in attempts from this network. Please wait a few minutes.'
    ),
  });

  // Account/identifier-based login limiter
  const loginAccountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    keyGenerator: (req) => {
      const parsed = parseIdentifier(req.body?.identifier || '');
      return parsed ? `acct:${parsed.normalized}` : `ip:${req.ip}`;
    },
    handler: createRateLimitHandler(
      'Too many sign-in attempts for this account. Please wait before trying again.'
    ),
  });

  const otpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    handler: createRateLimitHandler(
      'Too many verification code requests. Please wait before trying again.'
    ),
  });

  const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    handler: createRateLimitHandler(
      'Too many verification attempts. Please wait before trying again.'
    ),
  });

  const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    handler: createRateLimitHandler(
      'Too many registration attempts. Please try again in a few minutes.'
    ),
  });

  return {
    globalApiLimiter,
    sessionCheckLimiter,
    loginIpLimiter,
    loginAccountLimiter,
    otpSendLimiter,
    otpVerifyLimiter,
    registerLimiter,
  };
}
