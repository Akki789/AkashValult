import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute.jsx';
import { Welcome } from '../pages/Welcome.jsx';
import { Register } from '../pages/Register.jsx';
import { VerifyOTP } from '../pages/VerifyOTP.jsx';
import { CreatePIN } from '../pages/CreatePIN.jsx';
import { Login } from '../pages/Login.jsx';
import { ForgotPIN } from '../pages/ForgotPIN.jsx';
import { ResetPIN } from '../pages/ResetPIN.jsx';
import { AccountLocked } from '../pages/AccountLocked.jsx';
import { SessionReplaced } from '../pages/SessionReplaced.jsx';
import { Dashboard } from '../pages/Dashboard.jsx';
import { ROUTES } from '../utils/constants.js';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.WELCOME} element={<Welcome />} />
      <Route path={ROUTES.REGISTER} element={<Register />} />
      <Route path={ROUTES.VERIFY_OTP} element={<VerifyOTP mode="register" />} />
      <Route path={ROUTES.CREATE_PIN} element={<CreatePIN />} />
      <Route path={ROUTES.LOGIN} element={<Login />} />
      <Route path={ROUTES.FORGOT_PIN} element={<ForgotPIN />} />
      <Route path={ROUTES.VERIFY_RESET_OTP} element={<VerifyOTP mode="reset" />} />
      <Route path={ROUTES.RESET_PIN} element={<ResetPIN />} />
      <Route path={ROUTES.ACCOUNT_LOCKED} element={<AccountLocked />} />
      <Route path={ROUTES.SESSION_REPLACED} element={<SessionReplaced />} />
      <Route
        path={ROUTES.DASHBOARD}
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.WELCOME} replace />} />
    </Routes>
  );
}
