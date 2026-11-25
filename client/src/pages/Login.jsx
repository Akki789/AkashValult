import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/common/AuthLayout.jsx';
import { AlertBanner } from '../components/common/AlertBanner.jsx';
import { Button } from '../components/common/Button.jsx';
import { PinCodeInput } from '../components/forms/PinCodeInput.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authService } from '../services/authService.js';
import { extractApiError } from '../services/api.js';
import { ROUTES } from '../utils/constants.js';
import { normalizeEmail, validateEmail, validatePinFormat } from '../utils/validation.js';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, setAuthenticatedState, setLockoutInfo } = useAuth();

  const [step, setStep] = useState('identifier'); // 'identifier' | 'pin'
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const bannerMessage = location.state?.notice || '';

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  const handleIdentifierNext = (e) => {
    e.preventDefault();
    setServerError('');
    const err = validateEmail(identifier);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError('');
    setPin('');
    setStep('pin');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const pinErr = validatePinFormat(pin);
    if (pinErr) {
      setFieldError(pinErr);
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    try {
      const data = await authService.login({
        identifier: normalizeEmail(identifier),
        pin,
      });
      setAuthenticatedState(data.user, data.session);
      navigate(ROUTES.DASHBOARD, {
        replace: true,
        state: { replacedPreviousSession: data.replacedPreviousSession },
      });
    } catch (err) {
      const apiErr = extractApiError(err);
      if (apiErr.code === 'ACCOUNT_LOCKED') {
        setLockoutInfo({
          lockedUntil: apiErr.details?.lockedUntil,
          remainingSeconds: apiErr.details?.remainingSeconds || 3600,
          message: apiErr.message,
        });
        navigate(ROUTES.ACCOUNT_LOCKED, { replace: true });
        return;
      }
      setPin('');
      setServerError(apiErr.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="page-header">
        <span className="page-step">
          {step === 'identifier' ? 'Sign in · Step 1 of 2' : 'Sign in · Step 2 of 2'}
        </span>
        <h2 className="page-title">
          {step === 'identifier' ? 'Sign in to your account' : 'Enter your 6-digit PIN'}
        </h2>
        <p className="page-subtitle">
          {step === 'identifier'
            ? 'Use the email address linked to your account.'
            : `Signing in as ${normalizeEmail(identifier)}.`}
        </p>
      </div>

      {bannerMessage ? (
        <div style={{ marginBottom: '1rem' }}>
          <AlertBanner variant="success">{bannerMessage}</AlertBanner>
        </div>
      ) : null}

      {step === 'identifier' ? (
        <form className="form-stack" onSubmit={handleIdentifierNext} noValidate>
          {serverError ? <AlertBanner variant="error">{serverError}</AlertBanner> : null}

          <div className="field-group">
            <label className="field-label" htmlFor="login-identifier">
              Email address
            </label>
            <input
              id="login-identifier"
              name="identifier"
              type="email"
              autoComplete="email"
              placeholder="alex.mercer@company.com"
              className={`input-control ${fieldError ? 'is-invalid' : ''}`}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (fieldError) setFieldError('');
              }}
              aria-invalid={Boolean(fieldError) || undefined}
            />
            {fieldError ? (
              <p className="field-error" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>

          <Button type="submit" variant="primary" fullWidth>
            Continue
          </Button>
        </form>
      ) : (
        <form className="form-stack" onSubmit={handleLoginSubmit} noValidate>
          {serverError ? <AlertBanner variant="error">{serverError}</AlertBanner> : null}

          <PinCodeInput
            idPrefix="login-pin"
            label="6-digit PIN"
            value={pin}
            onChange={(val) => {
              setPin(val);
              if (fieldError) setFieldError('');
            }}
            error={fieldError}
            masked
            autoFocus
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={submitting}
            disabled={pin.length !== 6}
          >
            Sign in
          </Button>

          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={submitting}
            onClick={() => {
              setFieldError('');
              setServerError('');
              setPin('');
              setStep('identifier');
            }}
          >
            Change email address
          </Button>
        </form>
      )}

      <div className="form-footer">
        <Link to={ROUTES.FORGOT_PIN}>Forgot your PIN?</Link>
        <Link to={ROUTES.REGISTER}>Create account</Link>
      </div>
    </AuthLayout>
  );
}
