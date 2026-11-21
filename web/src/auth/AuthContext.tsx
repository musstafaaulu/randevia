import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  fetchMe,
  login as loginRequest,
  logoutRequest,
  register as registerRequest,
} from '../api/auth';
import { apiRequest, ApiError, setAccessToken, setUnauthorizedHandler } from '../api/client';
import type { User } from '../types/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    // Clear local state immediately so the UI reacts right away; the server
    // call revokes the refresh token so it can't be used again, but that
    // shouldn't block (or fail) the user actually being signed out locally.
    setAccessToken(null);
    setUser(null);
    void logoutRequest().catch(() => undefined);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // A page reload has no access token in memory, only the httpOnly refresh
  // cookie; apiRequest's own 401-retry path is what turns that into a fresh
  // one here, so the user stays signed in without a dedicated bootstrap call.
  useEffect(() => {
    fetchMe()
      .then(({ user: me }) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser, accessToken } = await loginRequest(email, password);
    setAccessToken(accessToken);
    setUser(loggedInUser);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user: registeredUser, accessToken } = await registerRequest(name, email, password);
    setAccessToken(accessToken);
    setUser(registeredUser);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: me } = await apiRequest<{ user: User }>('/api/v1/auth/me');
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
