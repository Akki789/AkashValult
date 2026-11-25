import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  KeyRound,
  Lock,
  MailCheck,
  ShieldCheck,
  Smartphone,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { ROUTES } from '../utils/constants.js';

export function Welcome() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (!isInitializing && isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Link to={ROUTES.WELCOME} className="brand-mark landing-brand">
            <span className="landing-brand-badge" aria-hidden="true">
              <ShieldCheck size={18} />
            </span>
            <span>AkashVault</span>
          </Link>

          <nav className="landing-nav" aria-label="Primary actions">
            <Link to={ROUTES.LOGIN} className="btn btn-ghost">
              Sign in
            </Link>
            <Link to={ROUTES.REGISTER} className="btn btn-primary">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-container landing-hero">
          <div className="landing-hero-copy">
            <span className="page-step">MERN Authentication Architecture</span>
            <h1 className="landing-title">
              Account access built around verified identity and strict session control.
            </h1>
            <p className="landing-subtitle">
              AkashVault is a full-stack authentication system combining email ownership
              verification, a 6-digit numeric PIN, server-enforced single active device
              sessions, and atomic one-hour brute-force protection.
            </p>

            <div className="landing-cta-row">
              <Link to={ROUTES.REGISTER} className="btn btn-primary">
                <UserPlus size={17} aria-hidden="true" />
                <span>Create account</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to={ROUTES.LOGIN} className="btn btn-secondary">
                <KeyRound size={17} aria-hidden="true" />
                <span>Sign in with PIN</span>
              </Link>
            </div>
          </div>

          <aside className="panel landing-spec-card" aria-label="Active security controls">
            <div className="landing-spec-header">
              <span className="status-pill">Production Security Policy</span>
              <span className="field-hint">Server-enforced</span>
            </div>

            <dl className="detail-list">
              <div className="detail-item">
                <dt className="detail-label">Account verification</dt>
                <dd className="detail-value">6-digit email OTP · Single-use</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Sign-in credential</dt>
                <dd className="detail-value">6-digit PIN · bcrypt hashed</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Active device limit</dt>
                <dd className="detail-value">1 active session per user</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Brute-force lockout</dt>
                <dd className="detail-value">5 failed tries → 60 min lock</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Session transport</dt>
                <dd className="detail-value">HttpOnly cookies + CSRF guard</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="landing-container landing-section" aria-labelledby="pillars-heading">
          <div className="landing-section-head">
            <h2 id="pillars-heading" className="landing-section-title">
              How AkashVault protects every account
            </h2>
            <p className="page-subtitle">
              Security rules are enforced on the server and database layers—never left to browser
              state alone.
            </p>
          </div>

          <div className="landing-pillars">
            <article className="panel landing-pillar-card">
              <span className="landing-icon-box" aria-hidden="true">
                <MailCheck size={18} />
              </span>
              <h3 className="landing-pillar-title">Verified Email Onboarding</h3>
              <p className="page-subtitle">
                Accounts stay uncreated until a time-limited, single-use 6-digit email code
                confirms ownership. Resend cooldowns and attempt limits prevent code abuse.
              </p>
            </article>

            <article className="panel landing-pillar-card">
              <span className="landing-icon-box" aria-hidden="true">
                <Lock size={18} />
              </span>
              <h3 className="landing-pillar-title">6-Digit PIN &amp; Atomic Lockout</h3>
              <p className="page-subtitle">
                Weak, sequential, and date-of-birth PINs are rejected. Five consecutive wrong
                attempts atomically lock the account for one hour across all devices and IPs.
              </p>
            </article>

            <article className="panel landing-pillar-card">
              <span className="landing-icon-box" aria-hidden="true">
                <Smartphone size={18} />
              </span>
              <h3 className="landing-pillar-title">Single Active Device</h3>
              <p className="page-subtitle">
                Signing in on a new browser or device revokes the prior session immediately and
                rotates HttpOnly refresh tokens with reuse detection.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-container landing-section" aria-labelledby="flow-heading">
          <div className="panel landing-steps-panel">
            <div className="landing-section-head" style={{ marginBottom: '1.5rem' }}>
              <h2 id="flow-heading" className="landing-section-title">
                From sign-up to active session in three steps
              </h2>
            </div>

            <div className="landing-steps-grid">
              <div className="landing-step-item">
                <span className="landing-step-num">01</span>
                <h3 className="landing-pillar-title">Enter details &amp; verify email</h3>
                <p className="page-subtitle">
                  Provide your email address, surname, and date of birth, then confirm your
                  one-time 6-digit verification code.
                </p>
              </div>
              <div className="landing-step-item">
                <span className="landing-step-num">02</span>
                <h3 className="landing-pillar-title">Create your 6-digit PIN</h3>
                <p className="page-subtitle">
                  Configure and confirm a personal 6-digit PIN. Forgot it later? Recover access
                  anytime through verified email ownership.
                </p>
              </div>
              <div className="landing-step-item">
                <span className="landing-step-num">03</span>
                <h3 className="landing-pillar-title">Manage your active session</h3>
                <p className="page-subtitle">
                  View your active device details, verify token rotation, and stay protected if
                  another device signs in.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <span className="field-hint">
            AkashVault · MongoDB, Express, React &amp; Node.js
          </span>
          <span className="field-hint">
            Single-device session protection · HttpOnly cookies
          </span>
        </div>
      </footer>
    </div>
  );
}
