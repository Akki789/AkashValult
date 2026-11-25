import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createRateLimiters } from './middleware/rateLimiter.js';
import {
  csrfProtection,
  requireJsonContentType,
  sanitizeMongoInput,
} from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp({ forceEnableRateLimitInTest = false } = {}) {
  const app = express();
  const limiters = createRateLimiters({
    forceEnableInTest: forceEnableRateLimitInTest,
  });

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", env.APP_ORIGIN],
          frameAncestors: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === env.APP_ORIGIN) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    })
  );

  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use(sanitizeMongoInput);
  app.use(requireJsonContentType);
  app.use('/api', limiters.globalApiLimiter);
  app.use('/api', csrfProtection);

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Service healthy',
      data: { status: 'ok' },
    });
  });

  app.use('/api/auth', createAuthRouter(limiters));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
