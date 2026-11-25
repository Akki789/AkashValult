import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/common/AuthLayout.jsx';
import { AlertBanner } from '../components/common/AlertBanner.jsx';
import { Button } from '../components/common/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authService } from '../services/authService.js';
import { extractApiError } from '../services/api.js';
import { MIN_AGE_YEARS, ROUTES } from '../utils/constants.js';
import {
  normalizeEmail,
  normalizeSurname,
  validateDateOfBirth,
  validateEmail,
  validateSurname,
} from '../utils/validation.js';

export function Register() {
  const navigate = useNavigate();
  const { setRegistrationFlow } = useAuth();

  const [surname, setSurname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    const errors = {};
    const surnameErr = validateSurname(surname);
    if (surnameErr) errors.surname = surnameErr;

    const dobErr = validateDateOfBirth(dateOfBirth);
    if (dobErr) errors.dateOfBirth = dobErr;

    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validateForm() || submitting) return;

    setSubmitting(true);
    try {
      const data = await authService.register({
        surname: normalizeSurname(surname),
        dateOfBirth,
        email: normalizeEmail(email),
      });
      setRegistrationFlow({
        registrationId: data.registrationId,
        channel: data.channel,
        maskedTarget: data.maskedTarget,
        expiresInSeconds: data.expiresInSeconds,
        resendCooldownSeconds: data.resendCooldownSeconds,
      });

      navigate(ROUTES.VERIFY_OTP);
    } catch (err) {
      const apiErr = extractApiError(err);
      if (apiErr.details?.fields) {
        setFieldErrors((prev) => ({ ...prev, ...apiErr.details.fields }));
      }
      setServerError(apiErr.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="page-header">
        <span className="page-step">Step 1 of 3 · Account details</span>
        <h2 className="page-title">Create your account</h2>
        <p className="page-subtitle">Verify your email address to get started.</p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {serverError ? <AlertBanner variant="error">{serverError}</AlertBanner> : null}

        <div className="field-group">
          <label className="field-label" htmlFor="register-email">
            Email address
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="alex.mercer@company.com"
            className={`input-control ${fieldErrors.email ? 'is-invalid' : ''}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
            }}
            aria-invalid={Boolean(fieldErrors.email) || undefined}
          />
          {fieldErrors.email ? (
            <p className="field-error" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="register-surname">
            Surname / Last name
          </label>
          <input
            id="register-surname"
            name="surname"
            type="text"
            autoComplete="family-name"
            placeholder="O'Connor"
            className={`input-control ${fieldErrors.surname ? 'is-invalid' : ''}`}
            value={surname}
            onChange={(e) => {
              setSurname(e.target.value);
              if (fieldErrors.surname) setFieldErrors((p) => ({ ...p, surname: '' }));
            }}
            aria-invalid={Boolean(fieldErrors.surname) || undefined}
          />
          {fieldErrors.surname ? (
            <p className="field-error" role="alert">
              {fieldErrors.surname}
            </p>
          ) : null}
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="register-dob">
            <span>Date of birth</span>
            <span className="field-hint">Minimum age {MIN_AGE_YEARS}</span>
          </label>
          <input
            id="register-dob"
            name="dateOfBirth"
            type="date"
            autoComplete="bday"
            max={new Date().toISOString().slice(0, 10)}
            className={`input-control ${fieldErrors.dateOfBirth ? 'is-invalid' : ''}`}
            value={dateOfBirth}
            onChange={(e) => {
              setDateOfBirth(e.target.value);
              if (fieldErrors.dateOfBirth) {
                setFieldErrors((p) => ({ ...p, dateOfBirth: '' }));
              }
            }}
            aria-invalid={Boolean(fieldErrors.dateOfBirth) || undefined}
          />
          {fieldErrors.dateOfBirth ? (
            <p className="field-error" role="alert">
              {fieldErrors.dateOfBirth}
            </p>
          ) : null}
        </div>

        <Button type="submit" variant="primary" fullWidth loading={submitting}>
          Send verification code
        </Button>
      </form>

      <div className="form-footer">
        <span>Already have an account?</span>
        <Link to={ROUTES.LOGIN}>Sign in</Link>
      </div>
    </AuthLayout>
  );
}
