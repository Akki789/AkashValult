import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/common/AuthLayout.jsx';
import { AlertBanner } from '../components/common/AlertBanner.jsx';
import { Button } from '../components/common/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authService } from '../services/authService.js';
import { extractApiError } from '../services/api.js';
import { ROUTES } from '../utils/constants.js';
import { normalizeEmail, validateEmail } from '../utils/validation.js';

export function ForgotPIN() {
  const navigate = useNavigate();
  const { setResetFlow } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const err = validateEmail(identifier);
    if (err) {
      setFieldError(err);
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    try {
      const cleaned = normalizeEmail(identifier);
      const data = await authService.forgotPin({ identifier: cleaned });
      setResetFlow({
        identifier: cleaned,
        channel: data.channel,
        maskedTarget: data.maskedTarget,
        expiresInSeconds: data.expiresInSeconds,
        resendCooldownSeconds: data.resendCooldownSeconds,
      });
      navigate(ROUTES.VERIFY_RESET_OTP);
    } catch (err) {
      const apiErr = extractApiError(err);
      setServerError(apiErr.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="page-header">
        <span className="page-step">PIN recovery · Step 1 of 3</span>
        <h2 className="page-title">Reset your 6-digit PIN</h2>
        <p className="page-subtitle">
          Enter your registered email address. We will send a 6-digit code to verify ownership.
        </p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {serverError ? <AlertBanner variant="error">{serverError}</AlertBanner> : null}

        <div className="field-group">
          <label className="field-label" htmlFor="forgot-identifier">
            Email address
          </label>
          <input
            id="forgot-identifier"
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

        <Button type="submit" variant="primary" fullWidth loading={submitting}>
          Send recovery code
        </Button>
      </form>

      <div className="form-footer">
        <Link to={ROUTES.LOGIN}>Back to sign in</Link>
        <Link to={ROUTES.REGISTER}>Create account</Link>
      </div>
    </AuthLayout>
  );
}
