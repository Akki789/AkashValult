import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROUTES } from '../../utils/constants.js';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing, sessionNotice } = useAuth();

  if (isInitializing) {
    return (
      <div className="dashboard-shell" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="panel" style={{ textAlign: 'center', padding: '2rem 2.5rem' }}>
          <span className="spinner" aria-hidden="true" />
          <p className="page-subtitle" style={{ marginTop: '0.75rem' }}>
            Verifying active session...
          </p>
        </div>
      </div>
    );
  }

  if (sessionNotice) {
    return <Navigate to={ROUTES.SESSION_REPLACED} replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return children;
}
