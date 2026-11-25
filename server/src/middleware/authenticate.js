import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import {
  COOKIE_NAMES,
  clearAuthCookies,
  verifyAccessToken,
  verifyScopedActionToken,
} from '../utils/token.js';
import { sendError } from '../utils/response.js';

/**
 * Verifies the short-lived access JWT AND enforces server-side session & single-device validity.
 * A valid JWT alone never grants access if the server-side session is revoked or replaced.
 */
export async function authenticateSession(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAMES.ACCESS];
    if (!token) {
      return sendError(res, 401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 401, 'AUTH_ACCESS_EXPIRED', 'Session token expired.');
      }
      return sendError(res, 401, 'AUTH_INVALID_TOKEN', 'Your session is no longer valid.');
    }

    if (payload.typ !== 'access' || !payload.sub || !payload.sid) {
      return sendError(res, 401, 'AUTH_INVALID_TOKEN', 'Your session is no longer valid.');
    }

    const [user, session] = await Promise.all([
      User.findById(payload.sub).select('+pinHash'),
      Session.findOne({ sessionId: payload.sid, userId: payload.sub }),
    ]);

    if (!user || !user.isActive) {
      clearAuthCookies(res);
      return sendError(res, 401, 'AUTH_INVALID_SESSION', 'Your session is no longer active.');
    }

    if (!session) {
      clearAuthCookies(res);
      return sendError(res, 401, 'AUTH_INVALID_SESSION', 'Your session could not be found.');
    }

    const now = new Date();

    if (session.revokedAt) {
      clearAuthCookies(res);
      if (session.revokedReason === 'REPLACED_BY_NEW_LOGIN') {
        return sendError(
          res,
          401,
          'SESSION_REPLACED',
          'Your account was signed in on another device. This session is no longer active.'
        );
      }
      return sendError(
        res,
        401,
        'SESSION_REVOKED',
        'This session has been signed out. Please sign in again.'
      );
    }

    if (user.activeSessionId !== session.sessionId) {
      await Session.updateOne(
        { _id: session._id, revokedAt: null },
        { $set: { revokedAt: now, revokedReason: 'REPLACED_BY_NEW_LOGIN' } }
      );
      clearAuthCookies(res);
      return sendError(
        res,
        401,
        'SESSION_REPLACED',
        'Your account was signed in on another device. This session is no longer active.'
      );
    }

    if (session.expiresAt <= now) {
      await Session.updateOne(
        { _id: session._id },
        { $set: { revokedAt: now, revokedReason: 'EXPIRED' } }
      );
      await User.updateOne(
        { _id: user._id, activeSessionId: session.sessionId },
        { $set: { activeSessionId: null } }
      );
      clearAuthCookies(res);
      return sendError(res, 401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
    }

    // Update lastActivityAt asynchronously without blocking request
    Session.updateOne({ _id: session._id }, { $set: { lastActivityAt: now } }).catch(() => {});

    req.user = user;
    req.session = session;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Verifies a short-lived HttpOnly cookie scoped strictly to CREATE_PIN or RESET_PIN.
 */
export function authenticateScopedCookie(cookieName, expectedPurpose) {
  return (req, res, next) => {
    const token = req.cookies?.[cookieName];
    if (!token) {
      return sendError(
        res,
        401,
        'SCOPED_TOKEN_REQUIRED',
        'Your verification session has expired. Please start again.'
      );
    }

    try {
      const payload = verifyScopedActionToken(token, expectedPurpose);
      req.scopedUserId = payload.sub;
      return next();
    } catch {
      return sendError(
        res,
        401,
        'SCOPED_TOKEN_INVALID',
        'Your verification session has expired. Please verify your contact again.'
      );
    }
  };
}
