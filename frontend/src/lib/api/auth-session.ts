export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
};

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
const invalidationListeners = new Set<() => void>();
const refreshListeners = new Set<(user: SessionUser) => void>();

const ACCESS_KEY = "naala-access-token";

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
}

export function resolveApiUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  const base = apiBase();
  if (!base || path === base || path.startsWith(`${base}/`)) return path;
  return `${base}${path}`;
}

export function getAccessToken() {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = sessionStorage.getItem(ACCESS_KEY);
  }
  return accessToken;
}

export function setAccessToken(token: string) {
  accessToken = token;
  if (typeof window !== "undefined") sessionStorage.setItem(ACCESS_KEY, token);
}

export function clearSession() {
  accessToken = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem("naala-session");
  }
}

export function subscribeToSessionInvalidation(listener: () => void) {
  invalidationListeners.add(listener);
  return () => {
    invalidationListeners.delete(listener);
  };
}

export function subscribeToSessionRefresh(listener: (user: SessionUser) => void) {
  refreshListeners.add(listener);
  return () => {
    refreshListeners.delete(listener);
  };
}

function invalidateSession() {
  clearSession();
  invalidationListeners.forEach((listener) => listener());
}

export function displayName(user: SessionUser | null) {
  return user ? `${user.firstName} ${user.lastName}`.trim() : "Utilisateur";
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Gerant / Administrateur",
  USER: "Utilisateur",
};

export function roleDisplayName(roles?: string[]) {
  const key = roles?.[0];
  return key ? ROLE_LABELS[key] ?? key : "Utilisateur";
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(resolveApiUrl("/api/auth/refresh"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        invalidateSession();
        return false;
      }
      const body = (await response.json()) as {
        accessToken: string;
        user: SessionUser;
      };
      if (!body.accessToken || !body.user?.id) {
        invalidateSession();
        return false;
      }
      setAccessToken(body.accessToken);
      refreshListeners.forEach((listener) => listener(body.user));
      return true;
    } catch {
      invalidateSession();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function canRefresh(url: string) {
  return !["/auth/login", "/auth/refresh", "/auth/logout"].some((path) =>
    url.includes(path),
  );
}

export async function fetchWithAuth(url: string, options?: RequestInit) {
  const execute = () => {
    const headers = new Headers(options?.headers);
    const token = getAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(resolveApiUrl(url), {
      ...options,
      headers,
      credentials: "include",
    });
  };

  let response = await execute();
  if (response.status === 401 && canRefresh(url)) {
    if (await refreshAccessToken()) response = await execute();
  }
  return response;
}

export { apiBase };
