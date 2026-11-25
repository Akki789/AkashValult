import { env } from '../config/env.js';
import { OTP } from '../models/OTP.js';
import { SecurityLog } from '../models/SecurityLog.js';
import {
  generateSixDigitOTP,
  hashOtp,
  timingSafeEqualHex,
} from '../utils/crypto.js';
import { AppError } from '../utils/response.js';
import { dispatchOtp } from './notificationService.js';

export function maskContact(channel, target) {
  if (channel === 'email') {
    const [local, domain] = target.split('@');
    if (!local || !domain) return '***';
    const visible = local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
  }
  if (target.length <= 4) return '****';
  return `${target.slice(0, 3)}****${target.slice(-4)}`;
}

export async function issueOtp({
  userId = null,
  pendingRegistrationId = null,
  target,
  channel,
  purpose,
  ipAddress = 'Unknown',
  userAgent = 'Unknown',
}) {
  const now = new Date();
  const cooldownMs = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;

  // Enforce resend cooldown based on the latest OTP issued for this target & purpose
  const recentOtp = await OTP.findOne({ target, purpose })
    .sort({ createdAt: -1 })
    .lean();

  if (recentOtp) {
    const elapsedMs = now.getTime() - new Date(recentOtp.createdAt).getTime();
    if (elapsedMs < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      throw new AppError(
        429,
        'OTP_RESEND_COOLDOWN',
        `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        { retryAfterSeconds }
      );
    }
  }

  // Invalidate any previously active unconsumed OTPs for this target & purpose
  await OTP.updateMany(
    {
      target,
      purpose,
      consumedAt: null,
      invalidatedAt: null,
    },
    {
      $set: { invalidatedAt: now },
    }
  );

  const otp = generateSixDigitOTP();
  const context = `${purpose}:${target}`;
  const hashedOTP = hashOtp(otp, context);
  const expiresAt = new Date(now.getTime() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

  const otpDoc = await OTP.create({
    userId,
    pendingRegistrationId,
    target,
    channel,
    purpose,
    hashedOTP,
    expiresAt,
    attempts: 0,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  });

  try {
    await dispatchOtp({ channel, target, otp, purpose });
  } catch (err) {
    await OTP.deleteOne({ _id: otpDoc._id });
    throw err;
  }

  await SecurityLog.create({
    userId,
    identifier: maskContact(channel, target),
    eventType: 'OTP_SENT',
    ipAddress,
    userAgent,
    metadata: { purpose, channel },
  });

  return {
    expiresAt: expiresAt.toISOString(),
    expiresInSeconds: env.OTP_EXPIRY_MINUTES * 60,
    resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    maskedTarget: maskContact(channel, target),
  };
}

export async function verifyOtp({
  target,
  purpose,
  otp,
  ipAddress = 'Unknown',
  userAgent = 'Unknown',
}) {
  const now = new Date();

  const otpDoc = await OTP.findOne({
    target,
    purpose,
    consumedAt: null,
    invalidatedAt: null,
  })
    .select('+hashedOTP')
    .sort({ createdAt: -1 });

  if (!otpDoc) {
    throw new AppError(
      400,
      'OTP_NOT_FOUND',
      'No active verification code was found. Request a new code and try again.'
    );
  }

  // Explicit application-level expiration check (never rely solely on MongoDB TTL)
  if (otpDoc.expiresAt <= now) {
    await OTP.updateOne({ _id: otpDoc._id }, { $set: { invalidatedAt: now } });
    throw new AppError(
      400,
      'OTP_EXPIRED',
      'That verification code has expired. Request a new code to continue.'
    );
  }

  if (otpDoc.attempts >= otpDoc.maxAttempts) {
    await OTP.updateOne({ _id: otpDoc._id }, { $set: { invalidatedAt: now } });
    throw new AppError(
      429,
      'OTP_ATTEMPTS_EXCEEDED',
      'Too many incorrect verification codes. Request a new code to continue.'
    );
  }

  const candidateHash = hashOtp(otp, `${purpose}:${target}`);
  const isMatch = timingSafeEqualHex(candidateHash, otpDoc.hashedOTP);

  if (!isMatch) {
    const updated = await OTP.findOneAndUpdate(
      { _id: otpDoc._id, consumedAt: null, invalidatedAt: null },
      { $inc: { attempts: 1 } },
      { new: true }
    );

    const attemptsUsed = updated ? updated.attempts : otpDoc.attempts + 1;
    const exhausted = attemptsUsed >= otpDoc.maxAttempts;

    if (exhausted && updated) {
      await OTP.updateOne({ _id: otpDoc._id }, { $set: { invalidatedAt: now } });
    }

    await SecurityLog.create({
      userId: otpDoc.userId,
      identifier: maskContact(otpDoc.channel, target),
      eventType: exhausted ? 'OTP_MAX_ATTEMPTS' : 'OTP_FAILED',
      ipAddress,
      userAgent,
      metadata: { purpose, attemptsUsed },
    });

    if (exhausted) {
      throw new AppError(
        429,
        'OTP_ATTEMPTS_EXCEEDED',
        'Too many incorrect verification codes. Request a new code to continue.'
      );
    }

    throw new AppError(
      400,
      'OTP_INVALID',
      "That code doesn't look right. Try entering it again.",
      { remainingAttempts: Math.max(0, otpDoc.maxAttempts - attemptsUsed) }
    );
  }

  // Atomically consume the OTP so concurrent requests cannot reuse the same code
  const consumed = await OTP.findOneAndUpdate(
    {
      _id: otpDoc._id,
      consumedAt: null,
      invalidatedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: otpDoc.maxAttempts },
    },
    {
      $set: { consumedAt: now },
    },
    { new: true }
  );

  if (!consumed) {
    throw new AppError(
      400,
      'OTP_ALREADY_USED',
      'This verification code is no longer valid. Request a new code to continue.'
    );
  }

  return consumed;
}
