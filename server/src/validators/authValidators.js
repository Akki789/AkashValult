import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { env } from '../config/env.js';

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Allows international Unicode letters, combining marks, spaces, hyphens, apostrophes, and periods
const SURNAME_REGEX = /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u;

const WEAK_PINS = new Set([
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '123456',
  '654321',
  '012345',
  '543210',
  '121212',
  '212121',
  '112233',
  '332211',
  '123123',
  '321321',
  '111222',
  '000001',
  '101010',
  '696969',
  '246810',
  '024680',
  '135790',
  '112358',
]);

export function normalizeEmail(rawEmail) {
  if (typeof rawEmail !== 'string') return '';
  return rawEmail.trim().toLowerCase();
}

export function isValidEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email || email.length > 254) return false;
  if (email.includes('..')) return false;
  const [local, domain] = email.split('@');
  if (!local || !domain || local.length > 64) return false;
  return EMAIL_REGEX.test(email);
}

export function normalizeAndValidatePhone(rawPhone) {
  if (typeof rawPhone !== 'string') return null;
  const trimmed = rawPhone.trim();
  if (!trimmed.startsWith('+')) return null;

  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed || !parsed.isValid()) {
    return null;
  }
  return parsed.number; // E.164 format e.g. +14155552671
}

export function normalizeSurname(rawSurname) {
  if (typeof rawSurname !== 'string') return '';
  return rawSurname.trim().replace(/\s+/g, ' ');
}

export function validateDateOfBirthString(dobStr, minAgeYears = env.MIN_AGE_YEARS) {
  if (typeof dobStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
    return { valid: false, reason: 'Please enter a valid date in YYYY-MM-DD format.' };
  }

  const [yearStr, monthStr, dayStr] = dobStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(utcDate.getTime()) ||
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return { valid: false, reason: 'Please enter a real calendar date.' };
  }

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  if (utcDate > todayUtc) {
    return { valid: false, reason: 'Date of birth cannot be in the future.' };
  }

  const maxAgeDate = new Date(
    Date.UTC(
      todayUtc.getUTCFullYear() - 120,
      todayUtc.getUTCMonth(),
      todayUtc.getUTCDate()
    )
  );
  if (utcDate < maxAgeDate) {
    return { valid: false, reason: 'Please enter a valid date of birth.' };
  }

  const minAgeCutoff = new Date(
    Date.UTC(
      todayUtc.getUTCFullYear() - minAgeYears,
      todayUtc.getUTCMonth(),
      todayUtc.getUTCDate()
    )
  );

  if (utcDate > minAgeCutoff) {
    return {
      valid: false,
      reason: `You must be at least ${minAgeYears} years old to create an account.`,
    };
  }

  return { valid: true, date: utcDate };
}

export function isWeakPin(pin) {
  if (WEAK_PINS.has(pin)) return true;

  // Reject all identical digits or simple ascending/descending step sequences
  const digits = pin.split('').map(Number);
  const allSame = digits.every((d) => d === digits[0]);
  if (allSame) return true;

  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i += 1) {
    if (digits[i] !== (digits[i - 1] + 1) % 10) ascending = false;
    if (digits[i] !== (digits[i - 1] + 9) % 10) descending = false;
  }
  if (ascending || descending) return true;

  // Reject ABABAB and AABBCC patterns
  if (pin[0] === pin[2] && pin[2] === pin[4] && pin[1] === pin[3] && pin[3] === pin[5]) {
    return true;
  }
  if (pin[0] === pin[1] && pin[2] === pin[3] && pin[4] === pin[5]) {
    return true;
  }

  return false;
}

export function parseIdentifier(rawIdentifier) {
  if (typeof rawIdentifier !== 'string') return null;
  const trimmed = rawIdentifier.trim();
  if (!trimmed || !isValidEmail(trimmed)) return null;
  return { channel: 'email', normalized: normalizeEmail(trimmed) };
}

export const surnameSchema = z
  .string({ required_error: 'Surname is required.' })
  .transform(normalizeSurname)
  .refine((val) => val.length >= 2 && val.length <= 60, {
    message: 'Surname must be between 2 and 60 characters.',
  })
  .refine((val) => SURNAME_REGEX.test(val), {
    message:
      'Surname may only contain letters, spaces, hyphens, apostrophes, and periods.',
  });

export const dobSchema = z
  .string({ required_error: 'Date of birth is required.' })
  .trim()
  .superRefine((val, ctx) => {
    const check = validateDateOfBirthString(val);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.reason,
      });
    }
  });

export const strictPinSchema = z
  .string({ required_error: 'A 6-digit PIN is required.' })
  .refine((val) => /^\d{6}$/.test(val), {
    message: 'PIN must be exactly 6 numeric digits with no spaces.',
  });

export const strongPinSchema = strictPinSchema.refine((val) => !isWeakPin(val), {
  message: 'Choose a less predictable PIN. Avoid repeated or sequential digits.',
});

export const otpCodeSchema = z
  .string({ required_error: 'Verification code is required.' })
  .trim()
  .refine((val) => /^\d{6}$/.test(val), {
    message: 'Verification code must be exactly 6 numeric digits.',
  });

export const registerSchema = z
  .object({
    surname: surnameSchema,
    dateOfBirth: dobSchema,
    email: z
      .string({ required_error: 'Email address is required.' })
      .trim()
      .refine((val) => isValidEmail(val), {
        message: 'Enter a valid email address.',
      }),
  })
  .strict();

export const sendOtpSchema = z
  .object({
    purpose: z.enum(['REGISTER', 'RESET_PIN']),
    registrationId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid registration reference.').optional(),
    identifier: z.string().trim().min(3).max(254).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.purpose === 'REGISTER' && !data.registrationId && !data.identifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['registrationId'],
        message: 'A registration reference or contact identifier is required.',
      });
    }
    if (data.purpose === 'RESET_PIN' && !parseIdentifier(data.identifier || '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['identifier'],
        message: 'Enter a valid email address.',
      });
    }
  });

export const verifyOtpSchema = z
  .object({
    purpose: z.enum(['REGISTER', 'RESET_PIN']),
    registrationId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid registration reference.').optional(),
    identifier: z.string().trim().min(3).max(254).optional(),
    otp: otpCodeSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.purpose === 'REGISTER' && !data.registrationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['registrationId'],
        message: 'Registration reference is required.',
      });
    }
    if (data.purpose === 'RESET_PIN' && !parseIdentifier(data.identifier || '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['identifier'],
        message: 'Enter a valid email address.',
      });
    }
  });

export const createPinSchema = z
  .object({
    pin: strongPinSchema,
    confirmPin: strictPinSchema,
  })
  .strict()
  .refine((data) => data.pin === data.confirmPin, {
    path: ['confirmPin'],
    message: 'PIN confirmation does not match.',
  });

export const loginSchema = z
  .object({
    identifier: z
      .string({ required_error: 'Email address is required.' })
      .trim()
      .min(3, 'Enter your registered email address.')
      .max(254)
      .refine((val) => Boolean(parseIdentifier(val)), {
        message: 'Enter a valid email address.',
      }),
    pin: strictPinSchema,
  })
  .strict();

export const forgotPinSchema = z
  .object({
    identifier: z
      .string({ required_error: 'Email address is required.' })
      .trim()
      .min(3)
      .max(254)
      .refine((val) => Boolean(parseIdentifier(val)), {
        message: 'Enter a valid email address.',
      }),
  })
  .strict();

export const resetPinSchema = z
  .object({
    pin: strongPinSchema,
    confirmPin: strictPinSchema,
  })
  .strict()
  .refine((data) => data.pin === data.confirmPin, {
    path: ['confirmPin'],
    message: 'PIN confirmation does not match.',
  });

export const emptyBodySchema = z.object({}).strict();
export const emptyQuerySchema = z.object({}).strict();
export const emptyParamsSchema = z.object({}).strict();
