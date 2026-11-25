import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { PendingRegistration } from '../models/PendingRegistration.js';
import { SecurityLog } from '../models/SecurityLog.js';
import { hashPin, verifyPin } from '../utils/crypto.js';
import { signScopedActionToken } from '../utils/token.js';
import { AppError } from '../utils/response.js';
import {
  normalizeEmail,
  normalizeAndValidatePhone,
  normalizeSurname,
  parseIdentifier,
  validateDateOfBirthString,
} from '../validators/authValidators.js';
import { issueOtp, maskContact, verifyOtp } from './otpService.js';
import {
  createSingleActiveSession,
  extractClientMetadata,
  revokeAllUserSessions,
} from './sessionService.js';

// Precomputed valid bcrypt hash used to equalize response timing when an account is not found
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('000000', 4);

function isDobDerivedPin(pin, dateOfBirth) {
  if (!dateOfBirth) return false;
  const iso = new Date(dateOfBirth).toISOString().slice(0, 10); // YYYY-MM-DD
  const [yyyy, mm, dd] = iso.split('-');
  const yy = yyyy.slice(2);
  const candidates = new Set([
    `${dd}${mm}${yy}`,
    `${mm}${dd}${yy}`,
    `${yy}${mm}${dd}`,
    `${yyyy}${mm}`,
    `${mm}${yyyy}`,
  ]);
  return candidates.has(pin);
}

export async function startRegistration({
  surname,
  dateOfBirth,
  email,
  req,
}) {
  const meta = extractClientMetadata(req);
  const cleanSurname = normalizeSurname(surname);
  const dobCheck = validateDateOfBirthString(dateOfBirth);
  if (!dobCheck.valid) {
    throw new AppError(400, 'VALIDATION_ERROR', dobCheck.reason);
  }

  const channel = 'email';
  const normalizedEmail = normalizeEmail(email);
  const target = normalizedEmail;

  const existingUser = await User.findOne({ normalizedEmail }).lean();

  if (existingUser) {
    throw new AppError(
      409,
      'ACCOUNT_EXISTS',
      'An account with that email address already exists. Try signing in instead.'
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  // Clean up any abandoned pending registrations for this same email
  await PendingRegistration.deleteMany({ normalizedEmail });

  const pending = await PendingRegistration.create({
    surname: cleanSurname,
    channel,
    email: email.trim(),
    normalizedEmail,
    dateOfBirth: dobCheck.date,
    lastOtpSentAt: now,
    expiresAt,
  });

  const otpInfo = await issueOtp({
    pendingRegistrationId: pending._id,
    target,
    channel,
    purpose: 'REGISTER',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  await SecurityLog.create({
    identifier: maskContact(channel, target),
    eventType: 'REGISTER_STARTED',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { channel },
  });

  return {
    registrationId: String(pending._id),
    channel,
    ...otpInfo,
  };
}

export async function resendVerificationOtp({ purpose, registrationId, identifier, req }) {
  const meta = extractClientMetadata(req);

  if (purpose === 'REGISTER') {
    const pending = await PendingRegistration.findById(registrationId);
    if (!pending || pending.expiresAt <= new Date()) {
      throw new AppError(
        400,
        'REGISTRATION_EXPIRED',
        'Your registration session has expired. Please start again.'
      );
    }

    const target =
      pending.channel === 'email'
        ? pending.normalizedEmail
        : pending.normalizedPhoneNumber;

    const existing = await User.findOne(
      pending.channel === 'email'
        ? { normalizedEmail: target }
        : { normalizedPhoneNumber: target }
    ).lean();

    if (existing) {
      throw new AppError(
        409,
        'ACCOUNT_EXISTS',
        'This contact is already registered. Try signing in instead.'
      );
    }

    // Extend pending registration lifetime on active resend
    pending.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    pending.lastOtpSentAt = new Date();
    await pending.save();

    const otpInfo = await issueOtp({
      pendingRegistrationId: pending._id,
      target,
      channel: pending.channel,
      purpose: 'REGISTER',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      registrationId: String(pending._id),
      channel: pending.channel,
      ...otpInfo,
    };
  }

  return startPinReset({ identifier, req });
}

export async function verifyRegistrationOtp({ registrationId, otp, req }) {
  const meta = extractClientMetadata(req);
  const pending = await PendingRegistration.findById(registrationId);

  if (!pending || pending.expiresAt <= new Date()) {
    throw new AppError(
      400,
      'REGISTRATION_EXPIRED',
      'Your registration session has expired. Please start again.'
    );
  }

  const target =
    pending.channel === 'email'
      ? pending.normalizedEmail
      : pending.normalizedPhoneNumber;

  await verifyOtp({
    target,
    purpose: 'REGISTER',
    otp,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const existing = await User.findOne(
    pending.channel === 'email'
      ? { normalizedEmail: target }
      : { normalizedPhoneNumber: target }
  ).lean();

  if (existing) {
    await PendingRegistration.deleteOne({ _id: pending._id });
    throw new AppError(
      409,
      'ACCOUNT_EXISTS',
      'An account with this contact already exists. Try signing in instead.'
    );
  }

  const user = await User.create({
    surname: pending.surname,
    ...(pending.channel === 'email'
      ? {
          email: pending.email,
          normalizedEmail: pending.normalizedEmail,
          emailVerified: true,
        }
      : {
          phoneNumber: pending.phoneNumber,
          normalizedPhoneNumber: pending.normalizedPhoneNumber,
          phoneVerified: true,
        }),
    dateOfBirth: pending.dateOfBirth,
    isActive: true,
  });

  await PendingRegistration.deleteOne({ _id: pending._id });

  await SecurityLog.create({
    userId: user._id,
    identifier: maskContact(pending.channel, target),
    eventType: 'REGISTER_VERIFIED',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { channel: pending.channel },
  });

  const setupToken = signScopedActionToken({
    userId: user._id,
    purpose: 'CREATE_PIN',
  });

  return {
    user: user.toSafeProfile(),
    setupToken,
  };
}

export async function createInitialPin({ userId, pin, req }) {
  const meta = extractClientMetadata(req);
  const user = await User.findById(userId).select('+pinHash');

  if (!user || !user.isActive) {
    throw new AppError(401, 'SETUP_INVALID', 'Your setup session is no longer valid.');
  }

  if (user.pinHash) {
    throw new AppError(
      409,
      'PIN_ALREADY_SET',
      'A PIN has already been created for this account. Please sign in or reset your PIN.'
    );
  }

  if (isDobDerivedPin(pin, user.dateOfBirth)) {
    throw new AppError(
      400,
      'PIN_TOO_PREDICTABLE',
      'Avoid using digits from your date of birth. Choose a different 6-digit PIN.'
    );
  }

  const pinHash = await hashPin(pin);

  const updated = await User.findOneAndUpdate(
    { _id: user._id, pinHash: null },
    { $set: { pinHash } },
    { new: true }
  ).select('+pinHash');

  if (!updated) {
    throw new AppError(
      409,
      'PIN_ALREADY_SET',
      'A PIN has already been created for this account.'
    );
  }

  await SecurityLog.create({
    userId: user._id,
    eventType: 'PIN_CREATED',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    user: updated.toSafeProfile(),
  };
}

export async function loginWithPin({ identifier, pin, req }) {
  const meta = extractClientMetadata(req);
  const parsed = parseIdentifier(identifier);

  if (!parsed) {
    throw new AppError(
      401,
      'AUTH_INVALID_CREDENTIALS',
      "We couldn't verify those details. Check your information and try again."
    );
  }

  const query =
    parsed.channel === 'email'
      ? { normalizedEmail: parsed.normalized }
      : { normalizedPhoneNumber: parsed.normalized };

  const user = await User.findOne(query).select('+pinHash');
  const masked = maskContact(parsed.channel, parsed.normalized);
  const now = new Date();

  if (!user || !user.isActive || !user.pinHash) {
    // Perform dummy hash comparison to reduce timing-based account enumeration
    await verifyPin(pin, DUMMY_BCRYPT_HASH);
    await SecurityLog.create({
      identifier: masked,
      eventType: 'LOGIN_FAILED',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { reason: 'UNKNOWN_OR_NO_PIN' },
    });
    throw new AppError(
      401,
      'AUTH_INVALID_CREDENTIALS',
      "We couldn't verify those details. Check your information and try again."
    );
  }

  if (user.lockedUntil && user.lockedUntil > now) {
    const remainingSeconds = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
    await SecurityLog.create({
      userId: user._id,
      identifier: masked,
      eventType: 'LOCKOUT_BLOCKED_ATTEMPT',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { remainingSeconds },
    });
    throw new AppError(
      423,
      'ACCOUNT_LOCKED',
      'Too many incorrect attempts. Your account is temporarily locked for your security.',
      {
        lockedUntil: user.lockedUntil.toISOString(),
        remainingSeconds,
      }
    );
  }

  const isPinValid = await verifyPin(pin, user.pinHash);

  if (!isPinValid) {
    const lockDurationMs = env.LOCKOUT_DURATION_MINUTES * 60 * 1000;
    const lockUntilTarget = new Date(now.getTime() + lockDurationMs);

    // Atomic pipeline update guarantees concurrent failed attempts cannot exceed MAX_LOGIN_ATTEMPTS
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      [
        {
          $set: {
            failedLoginAttempts: {
              $add: [
                {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$lockedUntil', null] },
                        { $lte: ['$lockedUntil', now] },
                      ],
                    },
                    0,
                    '$failedLoginAttempts',
                  ],
                },
                1,
              ],
            },
          },
        },
        {
          $set: {
            lockedUntil: {
              $cond: [
                { $gte: ['$failedLoginAttempts', env.MAX_LOGIN_ATTEMPTS] },
                {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$lockedUntil', null] },
                        { $gt: ['$lockedUntil', now] },
                      ],
                    },
                    '$lockedUntil',
                    lockUntilTarget,
                  ],
                },
                null,
              ],
            },
          },
        },
      ],
      { new: true }
    );

    const attempts = updatedUser?.failedLoginAttempts || 1;
    const isNowLocked = Boolean(updatedUser?.lockedUntil && updatedUser.lockedUntil > now);

    await SecurityLog.create({
      userId: user._id,
      identifier: masked,
      eventType: isNowLocked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { attempts },
    });

    if (isNowLocked) {
      const remainingSeconds = Math.ceil(
        (updatedUser.lockedUntil.getTime() - now.getTime()) / 1000
      );
      throw new AppError(
        423,
        'ACCOUNT_LOCKED',
        'Too many incorrect attempts. Your account is temporarily locked for your security.',
        {
          lockedUntil: updatedUser.lockedUntil.toISOString(),
          remainingSeconds,
        }
      );
    }

    throw new AppError(
      401,
      'AUTH_INVALID_CREDENTIALS',
      "We couldn't verify those details. Check your information and try again."
    );
  }

  // Re-check lockout status right before issuing a session in case a concurrent failed request locked it
  const freshUser = await User.findById(user._id).lean();
  if (freshUser?.lockedUntil && new Date(freshUser.lockedUntil) > new Date()) {
    const remainingSeconds = Math.ceil(
      (new Date(freshUser.lockedUntil).getTime() - Date.now()) / 1000
    );
    throw new AppError(
      423,
      'ACCOUNT_LOCKED',
      'Too many incorrect attempts. Your account is temporarily locked for your security.',
      {
        lockedUntil: new Date(freshUser.lockedUntil).toISOString(),
        remainingSeconds,
      }
    );
  }

  const sessionData = await createSingleActiveSession({ userId: user._id, req });

  await SecurityLog.create({
    userId: user._id,
    identifier: masked,
    eventType: 'LOGIN_SUCCESS',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      sessionId: sessionData.session.sessionId,
      replacedPreviousSession: sessionData.replacedPreviousSession,
    },
  });

  const refreshedUser = await User.findById(user._id).select('+pinHash');

  return {
    user: refreshedUser.toSafeProfile(),
    ...sessionData,
  };
}

export async function startPinReset({ identifier, req }) {
  const meta = extractClientMetadata(req);
  const parsed = parseIdentifier(identifier);
  if (!parsed) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Enter a valid email address.'
    );
  }

  const query =
    parsed.channel === 'email'
      ? { normalizedEmail: parsed.normalized }
      : { normalizedPhoneNumber: parsed.normalized };

  const user = await User.findOne(query).lean();
  const masked = maskContact(parsed.channel, parsed.normalized);

  if (!user || !user.isActive) {
    // Return indistinguishable generic payload to prevent account enumeration
    return {
      channel: parsed.channel,
      maskedTarget: masked,
      expiresAt: new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000).toISOString(),
      expiresInSeconds: env.OTP_EXPIRY_MINUTES * 60,
      resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  const otpInfo = await issueOtp({
    userId: user._id,
    target: parsed.normalized,
    channel: parsed.channel,
    purpose: 'RESET_PIN',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    channel: parsed.channel,
    ...otpInfo,
  };
}

export async function verifyResetOtp({ identifier, otp, req }) {
  const meta = extractClientMetadata(req);
  const parsed = parseIdentifier(identifier);
  if (!parsed) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Enter a valid email address.'
    );
  }

  const query =
    parsed.channel === 'email'
      ? { normalizedEmail: parsed.normalized }
      : { normalizedPhoneNumber: parsed.normalized };

  const user = await User.findOne(query).lean();
  if (!user || !user.isActive) {
    throw new AppError(
      400,
      'OTP_INVALID',
      "That code doesn't look right. Try entering it again."
    );
  }

  await verifyOtp({
    target: parsed.normalized,
    purpose: 'RESET_PIN',
    otp,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const resetToken = signScopedActionToken({
    userId: user._id,
    purpose: 'RESET_PIN',
  });

  return { resetToken };
}

export async function completePinReset({ userId, pin, req }) {
  const meta = extractClientMetadata(req);
  const user = await User.findById(userId).select('+pinHash');

  if (!user || !user.isActive) {
    throw new AppError(401, 'RESET_INVALID', 'Your reset session has expired. Start again.');
  }

  if (isDobDerivedPin(pin, user.dateOfBirth)) {
    throw new AppError(
      400,
      'PIN_TOO_PREDICTABLE',
      'Avoid using digits from your date of birth. Choose a different 6-digit PIN.'
    );
  }

  const pinHash = await hashPin(pin);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        pinHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }
  );

  // Revoke any previously active session on PIN reset for security
  await revokeAllUserSessions({ userId: user._id, reason: 'PIN_RESET' });

  await SecurityLog.create({
    userId: user._id,
    eventType: 'PIN_RESET_SUCCESS',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { reset: true };
}
