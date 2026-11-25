import { AlertCircle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: ShieldAlert,
  neutral: Info,
};

export function AlertBanner({ variant = 'error', children }) {
  if (!children) return null;
  const Icon = ICONS[variant] || Info;

  return (
    <div className={`alert alert-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
