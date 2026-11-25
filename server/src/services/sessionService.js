import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { SecurityLog } from '../models/SecurityLog.js';
import { generateOpaqueToken, hashRefreshToken } from '../utils/crypto.js';
import { signAccessToken } from '../utils/token.js';
import { AppError } from '../utils/response.js';

export function extractClientMetadata(req) {
  const userAgent = String(req.headers['user-agent'] || 'Unknown').slice(0, 300);
  const ipAddress = String(req.ip || req.socket?.remoteAddress || 'Unknown').slice(0, 64);

  let browser = 'Web Browser';
  if (/Edg\//i.test(userAgent)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(userAgent)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(userAgent)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) browser = 'Safari';

  let os = '';
  if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/Macintosh|Mac OS/i.test(userAgent)) os = 'macOS';
  else if (/iPhone|iPad/i.test(userAgent)) os = 'iOS';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/Linux/i.test(userAgent)) os = 'Linux';

  const deviceLabel = os ? `${browser} on ${os}` : browser;
  return { userAgent, ipAddress, deviceLabel };
}

/**
 * Create a single active server-side session for a user, revoking any existing active sessions.
 */
export async function createSingleActiveSession({ userId, req }) {
  const now = new Date();
  const sessionId = crypto.randomUUID();
  const refreshToken = generateOpaqueToken(48);
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(
    now.getTime() + env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );
  const deviceInfo = extractClientMetadata(req);

  // Revoke all previously unrevoked sessions for this user
  const revokeResult = await Session.updateMany(
    { userId, revokedAt: null },
    {
      $set: {
        revokedAt: now,
        revokedReason: 'REPLACED_BY_NEW_LOGIN',
      },
    }
  );

  const session = await Session.create({
    userId,
    sessionId,
    refreshTokenHash,
    previousRefreshTokenHashes: [],
    expiresAt,
    lastActivityAt: now,
    deviceInfo,
  });

  // Atomically bind User.activeSessionId to this newly minted session and clear lockout counters
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        activeSessionId: sessionId,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    }
  );

  const replacedPreviousSession = revokeResult.modifiedCount > 0;
  if (replacedPreviousSession) {
    await SecurityLog.create({
      userId,
      eventType: 'SESSION_REPLACED',
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      metadata: {
        newSessionId: sessionId,
        revokedCount: revokeResult.modifiedCount,
      },
    });
  }

  const accessToken = signAccessToken({ userId, sessionId });

  return {
    accessToken,
    refreshToken,
    session,
    replacedPreviousSession,
  };
}

/**
 * Rotate a refresh token with reuse detection and single-device enforcement.
 */
export async function rotateRefreshSession({ refreshToken, req }) {
  if (!refreshToken) {
    throw new AppError(401, 'AUTH_NO_REFRESH', 'Your session has ended. Please sign in again.');
  }

  const now = new Date();
  const incomingHash = hashRefreshToken(refreshToken);
  const deviceInfo = extractClientMetadata(req);

  const session = await Session.findOne({
    $or: [
      { refreshTokenHash: incomingHash },
      { previousRefreshTokenHashes: incomingHash },
    ],
  }).select('+refreshTokenHash +previousRefreshTokenHashes');

  if (!session) {
    throw new AppError(401, 'AUTH_INVALID_REFRESH', 'Your session is no longer valid. Please sign in again.');
  }

  // Detect refresh token reuse (previously rotated token presented again)
  if (session.refreshTokenHash !== incomingHash) {
    await Session.updateOne(
      { _id: session._id },
      {
        $set: {
          revokedAt: now,
          revokedReason: 'TOKEN_REUSE_DETECTED',
        },
      }
    );
    await User.updateOne(
      { _id: session.userId, activeSessionId: session.sessionId },
      { $set: { activeSessionId: null } }
    );

    await SecurityLog.create({
      userId: session.userId,
      eventType: 'REFRESH_TOKEN_REUSE',
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      metadata: { sessionId: session.sessionId },
    });

    throw new AppError(
      401,
      'SESSION_COMPROMISED',
      'We noticed unusual session activity and signed you out for your protection. Please sign in again.'
    );
  }

  const user = await User.findById(session.userId).select('+pinHash');
  if (!user || !user.isActive) {
    throw new AppError(401, 'AUTH_INVALID_SESSION', 'Your session is no longer active.');
  }

  if (session.revokedAt) {
    if (session.revokedReason === 'REPLACED_BY_NEW_LOGIN') {
      throw new AppError(
        401,
        'SESSION_REPLACED',
        'Your account was signed in on another device. This session is no longer active.'
      );
    }
    throw new AppError(401, 'SESSION_REVOKED', 'This session has been signed out. Please sign in again.');
  }

  if (user.activeSessionId !== session.sessionId) {
    await Session.updateOne(
      { _id: session._id, revokedAt: null },
      { $set: { revokedAt: now, revokedReason: 'REPLACED_BY_NEW_LOGIN' } }
    );
    throw new AppError(
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
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }

  const newRefreshToken = generateOpaqueToken(48);
  const newRefreshHash = hashRefreshToken(newRefreshToken);

  const rotated = await Session.findOneAndUpdate(
    {
      _id: session._id,
      refreshTokenHash: incomingHash,
      revokedAt: null,
    },
    {
      $set: {
        refreshTokenHash: newRefreshHash,
        lastActivityAt: now,
        'deviceInfo.ipAddress': deviceInfo.ipAddress,
        'deviceInfo.userAgent': deviceInfo.userAgent,
        'deviceInfo.deviceLabel': deviceInfo.deviceLabel,
      },
      $push: {
        previousRefreshTokenHashes: {
          $each: [incomingHash],
          $slice: -10,
        },
      },
    },
    { new: true }
  );

  if (!rotated) {
    throw new AppError(
      401,
      'SESSION_CONFLICT',
      'Your session could not be refreshed due to a concurrent update. Please sign in again.'
    );
  }

  const accessToken = signAccessToken({ userId: user._id, sessionId: session.sessionId });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user,
    session: rotated,
  };
}

export async function revokeSession({ userId, sessionId, reason = 'LOGOUT', req = null }) {
  const now = new Date();
  await Session.updateOne(
    { sessionId, userId, revokedAt: null },
    { $set: { revokedAt: now, revokedReason: reason } }
  );
  await User.updateOne(
    { _id: userId, activeSessionId: sessionId },
    { $set: { activeSessionId: null } }
  );

  if (req) {
    const meta = extractClientMetadata(req);
    await SecurityLog.create({
      userId,
      eventType: reason === 'LOGOUT' ? 'LOGOUT' : 'SESSION_REVOKED',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { sessionId, reason },
    });
  }
}

export async function revokeAllUserSessions({ userId, reason = 'PIN_RESET' }) {
  const now = new Date();
  await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: now, revokedReason: reason } }
  );
  await User.updateOne({ _id: userId }, { $set: { activeSessionId: null } });
}
