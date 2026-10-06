"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from "@/generated/api/naala";
import {
  clearSession,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
  subscribeToSessionInvalidation,
  subscribeToSessionRefresh,
  type SessionUser,
} from "@/lib/api/auth-session";
import { uiCapabilities, type UiCapabilities } from "@/lib/auth/permissions";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  isAdmin: boolean;
  capabilities: UiCapabilities;
  login(email: string, password: string): Promise<SessionUser>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readProfile(value: unknown): SessionUser | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.email !== "string" ||
    typeof record.firstName !== "string" ||
    typeof record.lastName !== "string" ||
    !Array.isArray(record.roles) ||
    !record.roles.every((role) => typeof role === "string") ||
    !Array.isArray(record.permissions) ||
    !record.permissions.every((permission) => typeof permission === "string")
  ) {
    return null;
  }
  return {
    id: record.id,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    roles: record.roles,
    permissions: record.permissions,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  const endSession = useCallback(() => {
    clearSession();
    queryClient.clear();
    setUser(null);
    setStatus("unauthenticated");
  }, [queryClient]);

  useEffect(() => subscribeToSessionInvalidation(endSession), [endSession]);
  useEffect(() => subscribeToSessionRefresh(setUser), []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        if (!getAccessToken() && !(await refreshAccessToken())) {
          if (active) endSession();
          return;
        }
        const response = await getCurrentUser();
        const profile = readProfile(response.data);
        const token = getAccessToken();
        if (!profile || !token) {
          if (active) endSession();
          return;
        }
        setAccessToken(token);
        if (active) {
          setUser(profile);
          setStatus("authenticated");
        }
      } catch {
        if (active) endSession();
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, [endSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginRequest({ email, password });
      const profile = readProfile(response.data.user);
      if (!response.data.accessToken || !profile) {
        throw new Error("Invalid authentication response");
      }
      queryClient.clear();
      setAccessToken(response.data.accessToken);
      setUser(profile);
      setStatus("authenticated");
      return profile;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Local session cleanup must still complete if the API is unavailable.
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAdmin: Boolean(user?.roles.includes("ADMIN")),
      capabilities: uiCapabilities(user),
      login,
      logout,
    }),
    [status, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

export function homeForUser(user: SessionUser) {
  return user.roles.includes("ADMIN") ? "/" : "/dashboard";
}
