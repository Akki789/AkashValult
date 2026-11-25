import { ShieldCheck, Lock, Smartphone, CheckCircle2 } from 'lucide-react';

export function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside" aria-label="Security overview">
        <div>
          <div className="brand-mark">
            <span className="brand-badge" aria-hidden="true">
              <ShieldCheck size={18} />
            </span>
            <span>AkashVault</span>
          </div>

          <div className="aside-copy">
            <p className="aside-eyebrow">Protected Identity</p>
            <h1 className="aside-title">Simple sign-in backed by strict session security.</h1>
            <p className="aside-subtitle">
              Every account is verified by one-time email code, secured with a 6-digit PIN,
              and restricted to one active device at a time.
            </p>
          </div>

          <ul className="aside-checklist">
            <li>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Verified email ownership before account activation</span>
            </li>
            <li>
              <Smartphone size={16} aria-hidden="true" />
              <span>Single active device session with automatic previous-session sign-out</span>
            </li>
            <li>
              <Lock size={16} aria-hidden="true" />
              <span>Automatic 1-hour protection after 5 consecutive incorrect PIN attempts</span>
            </li>
          </ul>
        </div>

        <div className="aside-footer">
          HttpOnly cookie sessions · Rotating refresh tokens · Zero localStorage secrets
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="mobile-brand">
            <ShieldCheck size={20} aria-hidden="true" />
            <span>AkashVault</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
