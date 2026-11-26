import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onSessionInvalidated } from '../services/api.js';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);
const HEARTBEAT_INTERVAL_MS = 3000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionNotice, setSessionNotice] = useState(null);
  const [lockoutInfo, setLockoutInfo] = useState(null);
  const [registrationFlow, setRegistrationFlow] = useState(null);
  const [resetFlow, setResetFlow] = useState(null);
  const checkingSessionRef = useRef(false);
  const activeSessionIdRef = useRef(null);

  useEffect(() => {
    activeSessionIdRef.current = session?.sessionId || null;
  }, [session?.sessionId]);

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

  useEffect(() => {
    const isAuthed = Boolean(user && session);
    if (!isAuthed) return undefined;

    const verifyActiveSession = async () => {
      if (checkingSessionRef.current) return;
      checkingSessionRef.current = true;
      try {
        const data = await authService.getSession();
        if (data?.session) {
          setSession(data.session);
        }
      } catch {
        // Axios interceptor handles SESSION_REPLACED / SESSION_REVOKED via onSessionInvalidated
      } finally {
        checkingSessionRef.current = false;
      }
    };

    const intervalId = setInterval(verifyActiveSession, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        verifyActiveSession();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    let channel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('akashvault_auth');
      channel.onmessage = (event) => {
        if (
          event.data?.type === 'NEW_LOGIN' &&
          event.data?.sessionId &&
          event.data.sessionId !== activeSessionIdRef.current
        ) {
          setUser(null);
          setSession(null);
          setSessionNotice({
            code: 'SESSION_REPLACED',
            message:
              'Your account was signed in on another device. This session is no longer active.',
          });
        }
      };
    }

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      if (channel) channel.close();
    };
  }, [Boolean(user && session)]);

  const setAuthenticatedState = useCallback((nextUser, nextSession) => {
    setUser(nextUser);
    setSession(nextSession);
    setSessionNotice(null);
    setLockoutInfo(null);
    if (typeof BroadcastChannel !== 'undefined' && nextSession?.sessionId) {
      const channel = new BroadcastChannel('akashvault_auth');
      channel.postMessage({ type: 'NEW_LOGIN', sessionId: nextSession.sessionId });
      channel.close();
    }
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
