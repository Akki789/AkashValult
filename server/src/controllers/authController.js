import {
  completePinReset,
  createInitialPin,
  loginWithPin,
  resendVerificationOtp,
  startPinReset,
  startRegistration,
  verifyRegistrationOtp,
  verifyResetOtp,
} from '../services/authService.js';
import { revokeSession, rotateRefreshSession } from '../services/sessionService.js';
import {
  COOKIE_NAMES,
  clearAuthCookies,
  clearScopedCookie,
  setAuthCookies,
  setScopedCookie,
} from '../utils/token.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { issueCsrfToken } from '../middleware/security.js';

export function getCsrfToken(_req, res) {
  const token = issueCsrfToken(res);
  return sendSuccess(res, 200, 'CSRF token issued.', { csrfToken: token });
}

export async function register(req, res, next) {
  try {
    const result = await startRegistration({ ...req.body, req });
    return sendSuccess(
      res,
      201,
      'Verification code sent. Enter the 6-digit code to activate your account.',
      result
    );
  } catch (err) {
    return next(err);
  }
}

export async function sendOtp(req, res, next) {
  try {
    const result = await resendVerificationOtp({ ...req.body, req });
    return sendSuccess(res, 200, 'A new verification code has been sent.', result);
  } catch (err) {
    return next(err);
  }
}

export async function verifyOtpController(req, res, next) {
  try {
    const { purpose, registrationId, identifier, otp } = req.body;

    if (purpose === 'REGISTER') {
      const { user, setupToken } = await verifyRegistrationOtp({
        registrationId,
        otp,
        req,
      });
      setScopedCookie(res, COOKIE_NAMES.SETUP, setupToken);
      return sendSuccess(
        res,
        200,
        'Contact verified. Now create your 6-digit login PIN.',
        { user }
      );
    }

    const { resetToken } = await verifyResetOtp({ identifier, otp, req });
    setScopedCookie(res, COOKIE_NAMES.RESET, resetToken);
    return sendSuccess(
      res,
      200,
      'Identity verified. Choose a new 6-digit PIN.',
      { verified: true }
    );
  } catch (err) {
    return next(err);
  }
}

export async function createPin(req, res, next) {
  try {
    const { user } = await createInitialPin({
      userId: req.scopedUserId,
      pin: req.body.pin,
      req,
    });

    clearScopedCookie(res, COOKIE_NAMES.SETUP);

    return sendSuccess(res, 201, 'Your 6-digit PIN is set. Sign in with your email and PIN to continue.', {
      user,
    });
  } catch (err) {
    return next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { user, accessToken, refreshToken, session, replacedPreviousSession } =
      await loginWithPin({
        identifier: req.body.identifier,
        pin: req.body.pin,
        req,
      });

    setAuthCookies(res, { accessToken, refreshToken });
    const csrfToken = issueCsrfToken(res);

    return sendSuccess(res, 200, 'Welcome back. You are signed in.', {
      user,
      csrfToken,
      replacedPreviousSession,
      session: {
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
        lastActivityAt: session.lastActivityAt,
        deviceInfo: session.deviceInfo,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const incomingRefresh = req.cookies?.[COOKIE_NAMES.REFRESH];
    const { accessToken, refreshToken, user, session } = await rotateRefreshSession({
      refreshToken: incomingRefresh,
      req,
    });

    setAuthCookies(res, { accessToken, refreshToken });

    return sendSuccess(res, 200, 'Session refreshed.', {
      user: user.toSafeProfile(),
      session: {
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
        lastActivityAt: session.lastActivityAt,
        deviceInfo: session.deviceInfo,
      },
    });
  } catch (err) {
    clearAuthCookies(res);
    return next(err);
  }
}

export async function logout(req, res, next) {
  try {
    await revokeSession({
      userId: req.user._id,
      sessionId: req.session.sessionId,
      reason: 'LOGOUT',
      req,
    });
    clearAuthCookies(res);
    return sendSuccess(res, 200, 'You have been signed out.');
  } catch (err) {
    return next(err);
  }
}

export async function forgotPin(req, res, next) {
  try {
    const result = await startPinReset({ identifier: req.body.identifier, req });
    return sendSuccess(
      res,
      200,
      'If an account matches that contact, a verification code has been sent.',
      result
    );
  } catch (err) {
    return next(err);
  }
}

export async function resetPin(req, res, next) {
  try {
    await completePinReset({
      userId: req.scopedUserId,
      pin: req.body.pin,
      req,
    });

    clearScopedCookie(res, COOKIE_NAMES.RESET);
    clearAuthCookies(res);

    return sendSuccess(
      res,
      200,
      'Your 6-digit PIN has been updated. Sign in with your new PIN to continue.'
    );
  } catch (err) {
    return next(err);
  }
}

export async function getMe(req, res) {
  return sendSuccess(res, 200, 'Authenticated profile retrieved.', {
    user: req.user.toSafeProfile(),
  });
}

export async function getSession(req, res) {
  if (!req.session) {
    return sendError(res, 401, 'AUTH_REQUIRED', 'No active session.');
  }
  return sendSuccess(res, 200, 'Active session retrieved.', {
    session: {
      sessionId: req.session.sessionId,
      createdAt: req.session.createdAt,
      expiresAt: req.session.expiresAt,
      lastActivityAt: req.session.lastActivityAt,
      deviceInfo: req.session.deviceInfo,
    },
  });
}
