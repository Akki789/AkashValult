import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { MIN_AGE_YEARS } from './constants.js';

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

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

export function normalizeSurname(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

export function validateSurname(raw) {
  const cleaned = normalizeSurname(raw);
  if (!cleaned) return 'Enter your surname or family name.';
  if (cleaned.length < 2 || cleaned.length > 60) {
    return 'Surname must be between 2 and 60 characters.';
  }
  if (!SURNAME_REGEX.test(cleaned)) {
    return 'Surname may only include letters, spaces, hyphens, apostrophes, and periods.';
  }
  return '';
}

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function validateEmail(raw) {
  const email = normalizeEmail(raw);
  if (!email) return 'Enter your email address.';
  if (email.length > 254 || email.includes('..')) {
    return 'Enter a valid email address.';
  }
  const [local, domain] = email.split('@');
  if (!local || !domain || local.length > 64 || !EMAIL_REGEX.test(email)) {
    return 'Enter a valid email address.';
  }
  return '';
}

export function formatPhoneWithCode(countryCode, nationalNumber) {
  const cleanedLocal = String(nationalNumber || '').replace(/[^\d]/g, '');
  if (!cleanedLocal) return '';
  return `${countryCode}${cleanedLocal}`;
}

export function validatePhone(fullInternationalPhone) {
  const raw = String(fullInternationalPhone || '').trim();
  if (!raw) return 'Enter your phone number.';
  if (!raw.startsWith('+')) {
    return 'Include your country calling code (for example, +14155552671).';
  }
  const parsed = parsePhoneNumberFromString(raw);
  if (!parsed || !parsed.isValid()) {
    return 'Enter a valid phone number for the selected country code.';
  }
  return '';
}

export function normalizePhone(fullInternationalPhone) {
  const parsed = parsePhoneNumberFromString(String(fullInternationalPhone || '').trim());
  return parsed && parsed.isValid() ? parsed.number : '';
}

export function validateDateOfBirth(dobStr, minAgeYears = MIN_AGE_YEARS) {
  if (!dobStr) return 'Enter your date of birth.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
    return 'Enter a valid date in YYYY-MM-DD format.';
  }

  const [y, m, d] = dobStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(utcDate.getTime()) ||
    utcDate.getUTCFullYear() !== y ||
    utcDate.getUTCMonth() !== m - 1 ||
    utcDate.getUTCDate() !== d
  ) {
    return 'Enter a valid calendar date.';
  }

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (utcDate > todayUtc) {
    return 'Date of birth cannot be in the future.';
  }

  const maxAgeDate = new Date(
    Date.UTC(todayUtc.getUTCFullYear() - 120, todayUtc.getUTCMonth(), todayUtc.getUTCDate())
  );
  if (utcDate < maxAgeDate) {
    return 'Enter a valid date of birth.';
  }

  const minAgeCutoff = new Date(
    Date.UTC(
      todayUtc.getUTCFullYear() - minAgeYears,
      todayUtc.getUTCMonth(),
      todayUtc.getUTCDate()
    )
  );
  if (utcDate > minAgeCutoff) {
    return `You must be at least ${minAgeYears} years old to register.`;
  }

  return '';
}

export function isWeakPin(pin) {
  if (WEAK_PINS.has(pin)) return true;
  const digits = pin.split('').map(Number);
  if (digits.every((d) => d === digits[0])) return true;

  let asc = true;
  let desc = true;
  for (let i = 1; i < digits.length; i += 1) {
    if (digits[i] !== (digits[i - 1] + 1) % 10) asc = false;
    if (digits[i] !== (digits[i - 1] + 9) % 10) desc = false;
  }
  if (asc || desc) return true;

  if (pin[0] === pin[2] && pin[2] === pin[4] && pin[1] === pin[3] && pin[3] === pin[5]) {
    return true;
  }
  if (pin[0] === pin[1] && pin[2] === pin[3] && pin[4] === pin[5]) {
    return true;
  }
  return false;
}

export function validateNewPin(pin) {
  if (!/^\d{6}$/.test(String(pin || ''))) {
    return 'Your PIN must be 6 numeric digits.';
  }
  if (isWeakPin(pin)) {
    return 'Choose a stronger PIN. Avoid repeated or sequential numbers.';
  }
  return '';
}

export function validatePinFormat(pin) {
  if (!/^\d{6}$/.test(String(pin || ''))) {
    return 'Enter all 6 digits of your PIN.';
  }
  return '';
}

export function validateOtpCode(otp) {
  if (!/^\d{6}$/.test(String(otp || ''))) {
    return 'Enter the full 6-digit verification code.';
  }
  return '';
}

export function validateIdentifier(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return 'Enter your email address.';
  return validateEmail(trimmed) ? 'Enter a valid email address.' : '';
}

export function formatDurationMMSS(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}
