import { Link } from 'react-router-dom';
import { MonitorOff } from 'lucide-react';
import { AuthLayout } from '../components/common/AuthLayout.jsx';
import { AlertBanner } from '../components/common/AlertBanner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROUTES } from '../utils/constants.js';

export function SessionReplaced() {
  const { sessionNotice, setSessionNotice } = useAuth();

  return (
    <AuthLayout>
      <div className="page-header">
        <span className="page-step">Single active device</span>
        <h2 className="page-title">You have been signed out</h2>
        <p className="page-subtitle">
          {sessionNotice?.message ||
            "Your account was opened on another device, so you've been signed out here."}
        </p>
      </div>

      <AlertBanner variant="neutral">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <MonitorOff size={16} aria-hidden="true" />
          <span>
            Only one device can remain signed in at a time. Signing in here will end the session
            on the other device.
          </span>
        </div>
      </AlertBanner>

      <div className="form-stack" style={{ marginTop: '1.5rem' }}>
        <Link
          to={ROUTES.LOGIN}
          className="btn btn-primary btn-full"
          onClick={() => setSessionNotice(null)}
        >
          Sign in on this device
        </Link>
        <Link
          to={ROUTES.FORGOT_PIN}
          className="btn btn-secondary btn-full"
          onClick={() => setSessionNotice(null)}
        >
          Reset your PIN if this wasn&apos;t you
        </Link>
      </div>
    </AuthLayout>
  );
}
