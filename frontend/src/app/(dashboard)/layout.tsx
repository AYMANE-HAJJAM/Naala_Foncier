import { AppShell } from "@/components/layout/app-shell";
import { RequireAuth, RequireRouteAccess } from "@/components/auth/auth-guards";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireRouteAccess>
        <AppShell>{children}</AppShell>
      </RequireRouteAccess>
    </RequireAuth>
  );
}
