import express from 'express';
import {
  createPin,
  forgotPin,
  getCsrfToken,
  getMe,
  getSession,
  login,
  logout,
  refresh,
  register,
  resetPin,
  sendOtp,
  verifyOtpController,
} from '../controllers/authController.js';
import {
  authenticateScopedCookie,
  authenticateSession,
} from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createPinSchema,
  emptyBodySchema,
  forgotPinSchema,
  loginSchema,
  registerSchema,
  resetPinSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from '../validators/authValidators.js';
import { COOKIE_NAMES } from '../utils/token.js';

export function createAuthRouter(limiters) {
  const router = express.Router();

  router.get('/csrf', validateRequest(), getCsrfToken);

  router.post(
    '/register',
    limiters.registerLimiter,
    validateRequest({ body: registerSchema }),
    register
  );

  router.post(
    '/send-otp',
    limiters.otpSendLimiter,
    validateRequest({ body: sendOtpSchema }),
    sendOtp
  );

  router.post(
    '/verify-otp',
    limiters.otpVerifyLimiter,
    validateRequest({ body: verifyOtpSchema }),
    verifyOtpController
  );

  router.post(
    '/create-pin',
    authenticateScopedCookie(COOKIE_NAMES.SETUP, 'CREATE_PIN'),
    validateRequest({ body: createPinSchema }),
    createPin
  );

  router.post(
    '/login',
    limiters.loginIpLimiter,
    limiters.loginAccountLimiter,
    validateRequest({ body: loginSchema }),
    login
  );

  router.post('/refresh', validateRequest({ body: emptyBodySchema }), refresh);

  router.post(
    '/logout',
    authenticateSession,
    validateRequest({ body: emptyBodySchema }),
    logout
  );

  router.post(
    '/forgot-pin',
    limiters.otpSendLimiter,
    validateRequest({ body: forgotPinSchema }),
    forgotPin
  );

  router.post(
    '/reset-pin',
    authenticateScopedCookie(COOKIE_NAMES.RESET, 'RESET_PIN'),
    validateRequest({ body: resetPinSchema }),
    resetPin
  );

  router.get('/me', authenticateSession, validateRequest(), getMe);
  router.get('/session', authenticateSession, validateRequest(), getSession);

  return router;
}
