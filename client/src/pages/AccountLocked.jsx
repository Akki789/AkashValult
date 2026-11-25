import { Link, Navigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { AuthLayout } from '../components/common/AuthLayout.jsx';
import { AlertBanner } from '../components/common/AlertBanner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { ROUTES } from '../utils/constants.js';
import { formatDurationMMSS } from '../utils/validation.js';

export function AccountLocked() {
  const { lockoutInfo, setLockoutInfo } = useAuth();

  const initialRemaining = lockoutInfo?.lockedUntil
    ? Math.max(
        0,
        Math.ceil((new Date(lockoutInfo.lockedUntil).getTime() - Date.now()) / 1000)
      )
    : lockoutInfo?.remainingSeconds || 0;

  const [secondsLeft] = useCountdown(initialRemaining);

  if (!lockoutInfo) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  const unlocked = secondsLeft === 0;

  return (
    <AuthLayout>
      <div className="page-header">
        <span className="page-step">Security protection</span>
        <h2 className="page-title">Account temporarily locked</h2>
        <p className="page-subtitle">
          After five consecutive incorrect PIN attempts, sign-in is paused for one hour across
          all devices.
        </p>
      </div>

      <div className="lockout-timer-box" role="status" aria-live="polite">
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '6px',
            color: 'var(--color-ink-secondary)',
          }}
        >
          <LockKeyhole size={16} aria-hidden="true" />
          <span className="lockout-timer-label" style={{ marginBottom: 0 }}>
            {unlocked ? 'Lockout period ended' : 'Time remaining'}
          </span>
        </div>
        <div className="lockout-timer-value">{formatDurationMMSS(secondsLeft)}</div>
      </div>

      {unlocked ? (
        <AlertBanner variant="success">
          Your temporary lockout has expired. You can sign in again now.
        </AlertBanner>
      ) : (
        <AlertBanner variant="warning">
          If you have forgotten your PIN, you can reset it right away by verifying your contact
          method.
        </AlertBanner>
      )}

      <div className="form-stack" style={{ marginTop: '1.25rem' }}>
        <Link
          to={ROUTES.LOGIN}
          className="btn btn-primary btn-full"
          onClick={() => {
            if (unlocked) setLockoutInfo(null);
          }}
        >
          {unlocked ? 'Return to sign in' : 'Try signing in later'}
        </Link>
        <Link to={ROUTES.FORGOT_PIN} className="btn btn-secondary btn-full">
          Reset PIN with verification code
        </Link>
      </div>
    </AuthLayout>
  );
}
