import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../utils/response.js';

// In-memory store strictly for non-production test/dev inspection
const devLastDispatchedOtps = new Map();

export function getLastDevOtp(target) {
  if (env.NODE_ENV === 'production') return null;
  return devLastDispatchedOtps.get(target) || null;
}

export function clearDevOtpStore() {
  devLastDispatchedOtps.clear();
}

function buildOtpMessage(otp, purpose) {
  const actionLabel =
    purpose === 'REGISTER' ? 'verify your new account' : 'reset your 6-digit PIN';
  return {
    subject: 'Your AkashVault verification code',
    text: `Use verification code ${otp} to ${actionLabel}. This code expires in ${env.OTP_EXPIRY_MINUTES} minutes. Never share this code with anyone.`,
  };
}

async function sendViaSmtp({ to, subject, text }) {
  const pass = env.SMTP_HOST.includes('gmail.com')
    ? env.SMTP_PASS.replace(/\s+/g, '')
    : env.SMTP_PASS;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass,
    },
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text,
  });
}

async function sendViaTwilio({ to, text }) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    env.TWILIO_ACCOUNT_SID
  )}/Messages.json`;

  const body = new URLSearchParams({
    To: to,
    From: env.TWILIO_FROM_NUMBER,
    Body: text,
  });

  const authHeader = Buffer.from(
    `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
  ).toString('base64');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Twilio SMS API returned status ${response.status}`);
  }
}

export async function dispatchOtp({ channel, target, otp, purpose }) {
  const { subject, text } = buildOtpMessage(otp, purpose);

  if (env.NODE_ENV !== 'production') {
    devLastDispatchedOtps.set(target, {
      otp,
      purpose,
      channel,
      sentAt: new Date().toISOString(),
    });
  }

  if (env.NODE_ENV === 'test') {
    return { deliveredVia: 'test-memory' };
  }

  const smtpConfigured =
    env.EMAIL_PROVIDER === 'smtp' && Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  const twilioConfigured =
    env.SMS_PROVIDER === 'twilio' &&
    Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);

  try {
    if (channel === 'email') {
      if (smtpConfigured) {
        await sendViaSmtp({ to: target, subject, text });
        return { deliveredVia: 'smtp' };
      }

      if (env.NODE_ENV === 'production') {
        throw new Error('SMTP credentials are not configured in production.');
      }

      if (env.NODE_ENV === 'development') {
        console.info(`[DEV OTP - EMAIL] To: ${target} | Code: ${otp} | Purpose: ${purpose}`);
      }
      return { deliveredVia: 'console' };
    }

    if (channel === 'phone') {
      if (twilioConfigured) {
        await sendViaTwilio({ to: target, text });
        return { deliveredVia: 'twilio' };
      }

      if (env.NODE_ENV === 'production') {
        throw new Error('Twilio SMS credentials are not configured in production.');
      }

      if (env.NODE_ENV === 'development') {
        console.info(`[DEV OTP - SMS] To: ${target} | Code: ${otp} | Purpose: ${purpose}`);
      }
      return { deliveredVia: 'console' };
    }

    throw new Error('Unsupported notification channel');
  } catch (error) {
    console.error('OTP delivery failed:', error.message);
    throw new AppError(
      503,
      'DELIVERY_UNAVAILABLE',
      "We couldn't send your verification code right now. Please try again shortly."
    );
  }
}
