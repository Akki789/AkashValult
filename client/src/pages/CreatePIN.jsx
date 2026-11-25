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

export function CreatePIN() {
  const navigate = useNavigate();
  const { registrationFlow, setRegistrationFlow } = useAuth();

  const [step, setStep] = useState('create'); // 'create' | 'confirm'
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  if (!registrationFlow?.verifiedUser && !completed) {
    return <Navigate to={ROUTES.REGISTER} replace />;
  }

  const handleContinueToConfirm = (e) => {
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

  const handleConfirmSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (confirmPin.length !== 6) {
      setFieldError('Re-enter all 6 digits to confirm your PIN.');
      return;
    }

    if (confirmPin !== pin) {
      setFieldError('Those PINs do not match. Try entering your confirmation PIN again.');
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    try {
      await authService.createPin({ pin, confirmPin });
      setCompleted(true);
      setRegistrationFlow(null);
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: {
          notice: 'Your 6-digit PIN is set. Sign in with your email and PIN to continue.',
        },
      });
    } catch (err) {
      const apiErr = extractApiError(err);
      setServerError(apiErr.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'create') {
    return (
      <AuthLayout>
        <div className="page-header">
          <span className="page-step">Step 3 of 3 · Create PIN</span>
          <h2 className="page-title">Create your 6-digit PIN</h2>
          <p className="page-subtitle">
            You will use this 6-digit PIN whenever you sign in. Avoid repeated or sequential
            digits.
          </p>
        </div>

        <form className="form-stack" onSubmit={handleContinueToConfirm} noValidate>
          {serverError ? <AlertBanner variant="error">{serverError}</AlertBanner> : null}

          <PinCodeInput
            idPrefix="create-pin"
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

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={pin.length !== 6}
          >
            Continue
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="page-header">
        <span className="page-step">Step 3 of 3 · Confirm PIN</span>
        <h2 className="page-title">Confirm your 6-digit PIN</h2>
        <p className="page-subtitle">
          Re-enter your 6-digit PIN to complete account setup.
        </p>
      </div>

      <form className="form-stack" onSubmit={handleConfirmSubmit} noValidate>
        {serverError ? <AlertBanner variant="error">{serverError}</AlertBanner> : null}

        <PinCodeInput
          idPrefix="confirm-pin"
          label="Confirm 6-digit PIN"
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
          Save 6-digit PIN
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
    </AuthLayout>
  );
}
