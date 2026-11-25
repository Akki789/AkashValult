import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/common/AuthLayout.jsx';
import { AlertBanner } from '../components/common/AlertBanner.jsx';
import { Button } from '../components/common/Button.jsx';
import { PinCodeInput } from '../components/forms/PinCodeInput.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { authService } from '../services/authService.js';
import { extractApiError } from '../services/api.js';
import { ROUTES } from '../utils/constants.js';
import { formatDurationMMSS, validateOtpCode } from '../utils/validation.js';

export function VerifyOTP({ mode = 'register' }) {
  const navigate = useNavigate();
  const { registrationFlow, setRegistrationFlow, resetFlow, setResetFlow } = useAuth();

  const isReset = mode === 'reset';
  const activeFlow = isReset ? resetFlow : registrationFlow;

  const [otp, setOtp] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const [expiresIn, setExpiresIn] = useCountdown(activeFlow?.expiresInSeconds || 300);
  const [resendCooldown, setResendCooldown] = useCountdown(
    activeFlow?.resendCooldownSeconds || 60
  );

  if (!activeFlow) {
    return (
      <Navigate to={isReset ? ROUTES.FORGOT_PIN : ROUTES.REGISTER} replace />
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setInfoMessage('');

    const codeError = validateOtpCode(otp);
    if (codeError) {
      setFieldError(codeError);
      return;
    }

    setSubmitting(true);
    try {
      if (isReset) {
        await authService.verifyOtp({
          purpose: 'RESET_PIN',
          identifier: activeFlow.identifier,
          otp,
        });
        navigate(ROUTES.RESET_PIN);
      } else {
        const data = await authService.verifyOtp({
          purpose: 'REGISTER',
          registrationId: activeFlow.registrationId,
          otp,
        });
        setRegistrationFlow((prev) => (prev ? { ...prev, verifiedUser: data.user } : null));
        navigate(ROUTES.CREATE_PIN);
      }
    } catch (err) {
      const apiErr = extractApiError(err);
      setServerError(apiErr.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setServerError('');
    setInfoMessage('');
    setResending(true);

    try {
      const payload = isReset
        ? { purpose: 'RESET_PIN', identifier: activeFlow.identifier }
        : { purpose: 'REGISTER', registrationId: activeFlow.registrationId };
      const data = await authService.sendOtp(payload);

      if (isReset) {
        setResetFlow((prev) => ({ ...prev, ...data }));
      } else {
        setRegistrationFlow((prev) => ({ ...prev, ...data }));
      }

      setExpiresIn(data.expiresInSeconds || 300);
      setResendCooldown(data.resendCooldownSeconds || 60);
      setOtp('');
      setInfoMessage(`A fresh 6-digit code was sent to ${data.maskedTarget}.`);
    } catch (err) {
      const apiErr = extractApiError(err);
      if (apiErr.details?.retryAfterSeconds) {
        setResendCooldown(apiErr.details.retryAfterSeconds);
      }
      setServerError(apiErr.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="page-header">
        <span className="page-step">
          {isReset ? 'PIN recovery · Step 2 of 3' : 'Step 2 of 3 · Verify contact'}
        </span>
        <h2 className="page-title">Enter verification code</h2>
        <p className="page-subtitle">
          We sent a 6-digit code to <strong>{activeFlow.maskedTarget}</strong>. Enter it below to
          continue.
        </p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {serverError ? <AlertBanner variant="error">{serverError}</AlertBanner> : null}
        {infoMessage ? <AlertBanner variant="success">{infoMessage}</AlertBanner> : null}

        <PinCodeInput
          idPrefix="otp"
          label="6-digit verification code"
          value={otp}
          onChange={(val) => {
            setOtp(val);
            if (fieldError) setFieldError('');
          }}
          error={fieldError}
          masked={false}
          allowVisibilityToggle={false}
          autoComplete="one-time-code"
          autoFocus
        />

        <div className="meta-row">
          <span>
            {expiresIn > 0 ? (
              <>
                Code expires in <span className="mono-timer">{formatDurationMMSS(expiresIn)}</span>
              </>
            ) : (
              'This code has expired. Request a new code.'
            )}
          </span>
          <button
            type="button"
            className="pin-visibility-btn"
            disabled={resendCooldown > 0 || resending}
            onClick={handleResend}
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : resending
                ? 'Sending...'
                : 'Resend code'}
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={submitting}
          disabled={otp.length !== 6}
        >
          Verify code
        </Button>
      </form>

      <div className="form-footer">
        <Link to={isReset ? ROUTES.FORGOT_PIN : ROUTES.REGISTER}>Use a different contact</Link>
        <Link to={ROUTES.LOGIN}>Back to sign in</Link>
      </div>
    </AuthLayout>
  );
}
