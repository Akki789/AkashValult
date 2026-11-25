import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onSessionInvalidated } from '../services/api.js';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionNotice, setSessionNotice] = useState(null);
  const [lockoutInfo, setLockoutInfo] = useState(null);
  const [registrationFlow, setRegistrationFlow] = useState(null);
  const [resetFlow, setResetFlow] = useState(null);

  const hydrateSession = useCallback(async () => {
    try {
      await authService.ensureCsrf();
      const [meData, sessionData] = await Promise.all([
        authService.getMe(),
        authService.getSession(),
      ]);
      setUser(meData.user);
      setSession(sessionData.session);
      setSessionNotice(null);
    } catch {
      setUser(null);
      setSession(null);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    return onSessionInvalidated(({ code, message }) => {
      setUser(null);
      setSession(null);
      setSessionNotice({
        code,
        message:
          message ||
          "Your account was opened on another device, so you've been signed out here.",
      });
    });
  }, []);

  const setAuthenticatedState = useCallback((nextUser, nextSession) => {
    setUser(nextUser);
    setSession(nextSession);
    setSessionNotice(null);
    setLockoutInfo(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setSession(null);
    }
  }, []);

  const refreshActiveSession = useCallback(async () => {
    const data = await authService.refresh();
    setUser(data.user);
    setSession(data.session);
    return data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      isAuthenticated: Boolean(user && session),
      isInitializing,
      sessionNotice,
      setSessionNotice,
      lockoutInfo,
      setLockoutInfo,
      registrationFlow,
      setRegistrationFlow,
      resetFlow,
      setResetFlow,
      setAuthenticatedState,
      hydrateSession,
      refreshActiveSession,
      logout,
    }),
    [
      user,
      session,
      isInitializing,
      sessionNotice,
      lockoutInfo,
      registrationFlow,
      resetFlow,
      setAuthenticatedState,
      hydrateSession,
      refreshActiveSession,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
