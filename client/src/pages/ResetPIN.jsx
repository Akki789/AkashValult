import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/common/AuthLayout.jsx';
import { AlertBanner } from '../components/common/AlertBanner.jsx';
import { Button } from '../components/common/Button.jsx';
import { PinCodeInput } from '../components/forms/PinCodeInput.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authService } from '../services/authService.js';
import { extractApiError } from '../services/api.js';
import { ROUTES } from '../utils/constants.js';
import { validateNewPin } from '../utils/validation.js';

export function ResetPIN() {
  const navigate = useNavigate();
  const { resetFlow, setResetFlow } = useAuth();

  const [step, setStep] = useState('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  if (!resetFlow && !completed) {
    return <Navigate to={ROUTES.FORGOT_PIN} replace />;
  }

  const handleNext = (e) => {
    e.preventDefault();
    setServerError('');
    const err = validateNewPin(pin);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError('');
    setConfirmPin('');
    setStep('confirm');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (confirmPin.length !== 6) {
      setFieldError('Re-enter all 6 digits to confirm your new PIN.');
      return;
    }

    if (confirmPin !== pin) {
      setFieldError('Those PINs do not match. Try entering your confirmation PIN again.');
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    try {
      await authService.resetPin({ pin, confirmPin });
      setCompleted(true);
      setResetFlow(null);
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: { notice: 'Your 6-digit PIN has been updated. Sign in with your new PIN.' },
      });
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
        <span className="page-step">PIN recovery · Step 3 of 3</span>
        <h2 className="page-title">
          {step === 'create' ? 'Choose a new 6-digit PIN' : 'Confirm your new PIN'}
        </h2>
        <p className="page-subtitle">
          {step === 'create'
            ? 'Updating your PIN will sign out any active session for your security.'
            : 'Re-enter your new 6-digit PIN to save changes.'}
        </p>
      </div>

      {step === 'create' ? (
        <form className="form-stack" onSubmit={handleNext} noValidate>
          {serverError ? <AlertBanner variant="error">{serverError}</AlertBanner> : null}

          <PinCodeInput
            idPrefix="reset-pin"
            label="New 6-digit PIN"
            value={pin}
            onChange={(val) => {
              setPin(val);
              if (fieldError) setFieldError('');
            }}
            error={fieldError}
            masked
            autoFocus
          />

          <Button type="submit" variant="primary" fullWidth disabled={pin.length !== 6}>
            Continue
          </Button>
        </form>
      ) : (
        <form className="form-stack" onSubmit={handleSubmit} noValidate>
          {serverError ? <AlertBanner variant="error">{serverError}</AlertBanner> : null}

          <PinCodeInput
            idPrefix="reset-confirm-pin"
            label="Confirm new 6-digit PIN"
            value={confirmPin}
            onChange={(val) => {
              setConfirmPin(val);
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
            disabled={confirmPin.length !== 6}
          >
            Update PIN
          </Button>

          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={submitting}
            onClick={() => {
              setConfirmPin('');
              setFieldError('');
              setServerError('');
              setStep('create');
            }}
          >
            Choose a different PIN
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
