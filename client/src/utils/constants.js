export const MIN_AGE_YEARS = Number(import.meta.env.VITE_MIN_AGE_YEARS) || 18;

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const COUNTRY_CODES = [
  { code: '+1', label: 'US / CA (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+91', label: 'IN (+91)' },
  { code: '+61', label: 'AU (+61)' },
  { code: '+49', label: 'DE (+49)' },
  { code: '+33', label: 'FR (+33)' },
  { code: '+81', label: 'JP (+81)' },
  { code: '+65', label: 'SG (+65)' },
  { code: '+971', label: 'AE (+971)' },
  { code: '+55', label: 'BR (+55)' },
];

export const ROUTES = {
  WELCOME: '/',
  REGISTER: '/register',
  VERIFY_OTP: '/verify-otp',
  CREATE_PIN: '/create-pin',
  LOGIN: '/login',
  FORGOT_PIN: '/forgot-pin',
  VERIFY_RESET_OTP: '/verify-reset-otp',
  RESET_PIN: '/reset-pin',
  ACCOUNT_LOCKED: '/account-locked',
  SESSION_REPLACED: '/session-replaced',
  DASHBOARD: '/dashboard',
};
