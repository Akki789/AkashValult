import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { AlertBanner } from '../components/common/AlertBanner.jsx';
import { Button } from '../components/common/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { extractApiError } from '../services/api.js';
import { ROUTES } from '../utils/constants.js';

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, session, logout, refreshActiveSession } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const replacedPreviousSession = Boolean(location.state?.replacedPreviousSession);

  const handleCheckSession = async () => {
    setError('');
    setFeedback('');
    setRefreshing(true);
    try {
      await refreshActiveSession();
      setFeedback('Session verified and refresh token rotated securely.');
    } catch (err) {
      const apiErr = extractApiError(err);
      if (apiErr.code === 'SESSION_REPLACED' || apiErr.code === 'SESSION_REVOKED') {
        navigate(ROUTES.SESSION_REPLACED, { replace: true });
        return;
      }
      setError(apiErr.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: { notice: 'You have signed out safely.' },
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="dashboard-shell">
      <header className="dashboard-nav">
        <div className="dashboard-nav-inner">
          <div className="brand-mark" style={{ color: 'var(--color-brand-primary)' }}>
            <ShieldCheck size={20} aria-hidden="true" />
            <span>AkashVault</span>
          </div>

          <Button
            variant="secondary"
            loading={signingOut}
            onClick={handleLogout}
            aria-label="Sign out"
          >
            <LogOut size={15} aria-hidden="true" />
            <span>Sign out</span>
          </Button>
        </div>
      </header>

      <main className="dashboard-container">
        {replacedPreviousSession ? (
          <AlertBanner variant="neutral">
            Your previous session on another device was signed out automatically because only one
            active device is allowed at a time.
          </AlertBanner>
        ) : null}

        {feedback ? <AlertBanner variant="success">{feedback}</AlertBanner> : null}
        {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

        <section className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <span className="status-pill">Authenticated · Single active session</span>
              <h1 className="page-title" style={{ marginTop: '0.75rem' }}>
                Welcome, {user?.surname}
              </h1>
              <p className="page-subtitle">
                Your identity is verified and your account is protected by a 6-digit PIN.
              </p>
            </div>

            <Button variant="secondary" loading={refreshing} onClick={handleCheckSession}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>Rotate &amp; verify session</span>
            </Button>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="panel" aria-labelledby="profile-heading">
            <h2 id="profile-heading" className="panel-title">
              Account profile
            </h2>
            <p className="panel-subtitle">Verified identity attributes stored on file.</p>

            <dl className="detail-list">
              <div className="detail-item">
                <dt className="detail-label">Surname</dt>
                <dd className="detail-value">{user?.surname}</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Email address</dt>
                <dd className="detail-value">{user?.email}</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Verification status</dt>
                <dd className="detail-value">Email verified</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Date of birth</dt>
                <dd className="detail-value">{user?.dateOfBirth}</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">6-digit PIN</dt>
                <dd className="detail-value">{user?.hasPin ? 'Configured' : 'Not set'}</dd>
              </div>
            </dl>
          </section>

          <section className="panel" aria-labelledby="session-heading">
            <h2 id="session-heading" className="panel-title">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={18} aria-hidden="true" />
                Active device session
              </span>
            </h2>
            <p className="panel-subtitle">
              Only this session is permitted to access your account right now.
            </p>

            <dl className="detail-list">
              <div className="detail-item">
                <dt className="detail-label">Device</dt>
                <dd className="detail-value">
                  {session?.deviceInfo?.deviceLabel || 'Web Browser'}
                </dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Session ID</dt>
                <dd className="detail-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {session?.sessionId ? `${session.sessionId.slice(0, 13)}...` : 'Active'}
                </dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Last activity</dt>
                <dd className="detail-value">
                  {session?.lastActivityAt
                    ? new Date(session.lastActivityAt).toLocaleString()
                    : 'Just now'}
                </dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Expires</dt>
                <dd className="detail-value">
                  {session?.expiresAt ? new Date(session.expiresAt).toLocaleDateString() : '—'}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}
