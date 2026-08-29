"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

function AuthLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--navy-950)] text-white">
      <div className="text-center">
        <p className="text-[13px] tracking-[0.14em] text-[var(--accent)]">
          NAALA FONCIER
        </p>
        <p className="mt-3 text-sm text-white/70">Ouverture de l’espace...</p>
      </div>
    </div>
  );
}

function isAdminRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/requisitions" ||
    pathname.startsWith("/requisitions/nouveau") ||
    pathname.startsWith("/administration") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/utilisateurs")
  );
}

function isUserRoute(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/mes-terrains") ||
    pathname.startsWith("/mes-dossiers")
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return <AuthLoader />;
  return children;
}

export function RequireRouteAccess({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const forbidden = isAdmin ? isUserRoute(pathname) : isAdminRoute(pathname);

  useEffect(() => {
    if (forbidden) router.replace(isAdmin ? "/" : "/forbidden");
  }, [forbidden, isAdmin, router]);

  if (forbidden) return <AuthLoader />;
  return children;
}
