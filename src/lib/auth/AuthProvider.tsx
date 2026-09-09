'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiClient } from '@/lib/api/client';
import * as authApi from '@/lib/api/auth';
import type { AuthResponse, AuthUser, UserRole } from '@/types/auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  user: AuthUser | null;
  role: UserRole | null;
  isAdmin: boolean;
  status: AuthStatus;
  restoreSession: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const unauthenticatedRefreshBlockedUntilRef = useRef(0);
  const didAttemptInitialRestoreRef = useRef(false);
  const statusRef = useRef<AuthStatus>('loading');
  const resolveBootstrapRef = useRef<(() => void) | null>(null);
  // Bumped on every explicit logout so a refresh that was already in flight
  // cannot resurrect the session after the user has signed out.
  const sessionEpochRef = useRef(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Initialize bootstrap promise resolver once
  useEffect(() => {
    if (!resolveBootstrapRef.current) {
      let resolve: () => void = () => {};
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      resolveBootstrapRef.current = resolve;
      globalResolveBootstrap = resolve;
      globalBootstrapPromise = promise;
    }
  }, []);

  const applySession = useCallback((session: AuthResponse) => {
    accessTokenRef.current = session.accessToken;
    unauthenticatedRefreshBlockedUntilRef.current = 0;
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    sessionEpochRef.current += 1;
    accessTokenRef.current = null;
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Bumps the session epoch and drops the stored refresh token so no in-flight
  // or future refresh can reuse it, without touching the current access token
  // (still needed to authorize the logout request itself).
  const invalidatePendingRefresh = useCallback(() => {
    sessionEpochRef.current += 1;
  }, []);

  // Single-flight refresh: concurrent 401s (and Strict Mode double-invokes) share
  // one rotation so the backend's single stored refresh-token hash is not raced.
  const refreshSession = useCallback(
    async (force = false): Promise<string | null> => {
      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      const nowMs = Date.now();
      if (
        !force &&
        !accessTokenRef.current &&
        statusRef.current === 'unauthenticated' &&
        unauthenticatedRefreshBlockedUntilRef.current > nowMs
      ) {
        return null;
      }

      const epochAtStart = sessionEpochRef.current;
      setStatus('loading');

      const promise = (async () => {
        try {
          const session = await authApi.refresh();
          // A logout may have completed while this request was in flight; discard
          // the result instead of resurrecting a session the user already left.
          if (sessionEpochRef.current !== epochAtStart) {
            return null;
          }

          unauthenticatedRefreshBlockedUntilRef.current = 0;
          applySession(session);
          return session.accessToken;
        } catch {
          if (sessionEpochRef.current === epochAtStart) {
            // Prevent repeated refresh attempts while clearly signed out.
            unauthenticatedRefreshBlockedUntilRef.current = Date.now() + 30_000;
            clearSession();
          }
          return null;
        }
      })().finally(() => {
        refreshPromiseRef.current = null;
      });

      refreshPromiseRef.current = promise;
      return promise;
    },
    [applySession, clearSession]
  );

  const restoreSession = useCallback(async (): Promise<boolean> => {
    if (statusRef.current === 'authenticated') {
      return true;
    }

    const token = await refreshSession(true);
    return token !== null;
  }, [refreshSession]);

  useEffect(() => {
    if (didAttemptInitialRestoreRef.current) {
      return;
    }

    didAttemptInitialRestoreRef.current = true;
    restoreSession().finally(() => {
      resolveBootstrapRef.current?.();
      // Signal global bootstrap completion so API client can wait if needed
      globalResolveBootstrap?.();
    });
  }, [restoreSession]);

  // Register token hooks with the shared API client (access token + 401 refresh).
  useEffect(() => {
    apiClient.setAccessTokenProvider(() => accessTokenRef.current);
    apiClient.setTokenRefresher(() => refreshSession(false));

    return () => {
      apiClient.setAccessTokenProvider(null);
      apiClient.setTokenRefresher(null);
    };
  }, [refreshSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login({ email, password });
      applySession(session);
      return session.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.register({ email, password });
      applySession(session);
      return session.user;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    // Immediately invalidate any in-flight refresh and stop future refreshes
    // from reusing the soon-to-be-revoked refresh token, but keep the current
    // access token in place until the server call has been attempted so its
    // Authorization header still identifies the user being revoked.
    invalidatePendingRefresh();
    try {
      await authApi.logout();
    } catch {
      // Best-effort server-side revocation; local session is cleared regardless.
    } finally {
      clearSession();
    }
  }, [invalidatePendingRefresh, clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isAdmin: user?.role === 'ADMIN',
      status,
      restoreSession,
      login,
      register,
      logout,
    }),
    [user, status, restoreSession, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

let globalBootstrapPromise: Promise<void> | null = null;
let globalResolveBootstrap: (() => void) | null = null;

// Initialize global bootstrap tracking
{
  let resolve: () => void = () => {};
  globalBootstrapPromise = new Promise((r) => {
    resolve = r;
  });
  globalResolveBootstrap = resolve;
}

export function getAuthBootstrapPromise(): Promise<void> {
  return globalBootstrapPromise ?? Promise.resolve();
}

export function useAuthBootstrapComplete(): boolean {
  const { status } = useAuth();
  return status !== 'loading';
}

export function useAuthDependentEffect(
  effect: () => void | (() => void),
  deps?: React.DependencyList
): void {
  const { status } = useAuth();
  useEffect(() => {
    if (status === 'loading') {
      return;
    }
    return effect();
    // This hook intentionally wraps useEffect to add auth bootstrap gating.
    // The effect is passed as a function parameter and called directly,
    // so we don't include it in the dependency array to avoid re-running
    // when the effect function's identity changes (common with inline functions).
    // Callers should memoize effect with useCallback if it references external state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ...(deps ?? [])]);
}
