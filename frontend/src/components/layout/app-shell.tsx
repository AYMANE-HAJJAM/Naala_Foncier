"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Users,
  Bell,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Menu,
  LogOut,
  ChevronDown,
  X,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Dialog } from "@/components/ui/core";
import {
  useGetAlerts,
  useGetRequisitions,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@/generated/api/naala";
import type { NotificationItem, Requisition } from "@/types/domain";
import {
  displayName,
  roleDisplayName,
} from "@/lib/api/auth-session";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  userOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/", icon: LayoutDashboard, adminOnly: true },
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, userOnly: true },
  { label: "Mes terrains", href: "/mes-terrains", icon: FolderKanban, userOnly: true },
  { label: "Terrains", href: "/requisitions", icon: FolderKanban, adminOnly: true },
  { label: "Calendrier", href: "/calendrier", icon: CalendarDays },
  { label: "Administration", href: "/administration", icon: Users, adminOnly: true },
];

function pageTitle(pathname: string, isAdmin: boolean) {
  if (pathname.startsWith("/requisitions/nouveau")) return "Nouveau terrain";
  if (pathname.startsWith("/requisitions/")) return "Terrain";
  if (pathname.startsWith("/requisitions")) return "Terrains";
  if (pathname.startsWith("/mes-terrains") || pathname.startsWith("/mes-dossiers"))
    return "Mes terrains";
  if (pathname.startsWith("/dashboard")) return "Tableau de bord";
  if (pathname.startsWith("/calendrier") || pathname.startsWith("/agenda"))
    return "Calendrier";
  if (pathname.startsWith("/administration")) return "Administration";
  if (pathname.startsWith("/utilisateurs")) return "Administration";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/profil")) return "Mon profil";
  return isAdmin ? "Tableau de bord" : "Tableau de bord";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, logout: endAuthSession } = useAuth();
  const markAllRead = useMarkAllNotificationsRead();
  const markOneRead = useMarkNotificationRead();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [notifs, setNotifs] = useState(false);
  const [query, setQuery] = useState("");
  const userLabel = user ? displayName(user) : "Utilisateur";
  const userRole = user ? roleDisplayName(user.roles) : "Session";
  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() || "NF"
    : "NF";

  const reqQuery = useGetRequisitions(undefined, {
    query: { enabled: true },
  });
  const alertsQuery = useGetAlerts({
    query: { enabled: true },
  });
  const alerts = (alertsQuery.data?.data ?? []) as unknown as NotificationItem[];
  const unread = alerts.filter((n) => !n.read).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleNav = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.adminOnly && !isAdmin) return false;
        if (item.userOnly && isAdmin) return false;
        return true;
      }),
    [isAdmin],
  );

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return ((reqQuery.data?.data ?? []) as unknown as Requisition[])
      .filter((r) =>
        [r.number, r.property, r.location, r.buyer].some((v) =>
          v.toLowerCase().includes(q),
        ),
      )
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        title: `${r.number} — ${r.property}`,
        meta: r.status,
        href: `/requisitions/${r.id}`,
      }));
  }, [query, reqQuery.data]);

  const active = (href: string) =>
    href === "/" ? pathname === href : pathname.startsWith(href);

  const logout = async () => {
    await endAuthSession();
    router.replace("/login");
  };

  const showSearch =
    isAdmin &&
    (pathname === "/" ||
      pathname.startsWith("/requisitions") ||
      pathname.startsWith("/calendrier") ||
      pathname.startsWith("/agenda"));

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      {mobile && (
        <button
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-[var(--navy-950)]/40 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}

      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/6 bg-[linear-gradient(180deg,var(--navy-950),#0e1d30)] text-slate-300 shadow-[8px_0_28px_rgba(11,23,40,.08)] transition-[width,transform]",
          collapsed ? "lg:w-[80px]" : "lg:w-[256px]",
          mobile
            ? "w-[272px] translate-x-0"
            : "w-[272px] -translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex h-[72px] items-center border-b border-white/8 px-5",
            collapsed ? "justify-center lg:px-0" : "gap-3",
          )}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] border border-white/10 bg-white/[0.06] text-[11px] font-bold tracking-[0.08em] text-[var(--accent)] shadow-inner">
            NF
          </span>
          <div className="min-w-0">
            {!collapsed || mobile ? (
              <>
                <p className="text-[13px] font-semibold tracking-[0.08em] text-white">
                  NAALA FONCIER
                </p>
                <p className="mt-0.5 truncate text-[11px] text-white/40">
                  Gestion foncière
                </p>
              </>
            ) : null}
          </div>
          <button
            className="ml-auto rounded-[var(--radius-md)] p-1.5 text-white/50 hover:bg-white/8 hover:text-white lg:hidden"
            onClick={() => setMobile(false)}
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav
          className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-5"
          aria-label="Navigation principale"
        >
          {(!collapsed || mobile) && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
              Navigation
            </p>
          )}
          {visibleNav.map(({ label, href, icon: Icon }) => {
            const isActive = active(href);
            return (
              <Link
                onClick={() => setMobile(false)}
                title={collapsed ? label : undefined}
                key={`${label}-${href}`}
                href={href}
                className={cn(
                  "relative flex h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-[13px] font-medium transition-all",
                  isActive
                    ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.035)]"
                    : "text-white/55 hover:bg-white/[0.045] hover:text-white/90",
                )}
              >
                {isActive && (
                  <span className="absolute -left-0.5 top-2.5 bottom-2.5 w-[3px] rounded-full bg-[var(--accent)]" />
                )}
                <Icon
                  className={cn(
                    "size-[17px] shrink-0",
                    isActive ? "text-[var(--accent)]" : "",
                  )}
                />
                {(!collapsed || mobile) && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-white/8 p-3">
          {(!collapsed || mobile) && (
            <div className="mb-2 flex items-center gap-3 rounded-[var(--radius-md)] bg-white/[0.035] p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                {initials}
              </span>
              <span className="min-w-0">
                <b className="block truncate text-[12px] font-semibold text-white/90">
                  {userLabel}
                </b>
                <span className="block truncate text-[10px] text-white/40">
                  {userRole}
                </span>
              </span>
            </div>
          )}
          {!isAdmin && (
            <Link
              href="/profil"
              onClick={() => setMobile(false)}
              title={collapsed ? "Mon profil" : undefined}
              className={cn(
                "flex h-10 items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-[13px]",
                active("/profil")
                  ? "bg-white/8 text-white"
                  : "text-white/55 hover:bg-white/[0.04] hover:text-white/90",
              )}
            >
              <UserRound className="size-4 shrink-0" />
              {(!collapsed || mobile) && <span>Mon profil</span>}
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-[12px] text-white/45 hover:bg-white/[0.04] hover:text-white/80 lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
            {!collapsed && "Réduire"}
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "transition-[padding]",
          collapsed ? "lg:pl-[80px]" : "lg:pl-[256px]",
        )}
      >
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-white/80 px-4 shadow-[0_1px_0_rgba(11,23,40,.02)] backdrop-blur-xl md:h-[72px] md:px-8">
          <button
            className="rounded-[var(--radius-md)] p-2 text-[var(--text-muted)] hover:bg-[var(--slate-100)] lg:hidden"
            onClick={() => setMobile(true)}
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--navy-950)]">
              {pageTitle(pathname, isAdmin)}
            </p>
            <p className="hidden text-[11px] text-[var(--text-faint)] sm:block">
              Espace de gestion fonciÃ¨re
            </p>
          </div>

          {showSearch && (
            <button
              onClick={() => setSearch(true)}
              className="hidden h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-[13px] text-[var(--text-muted)] shadow-[var(--shadow-xs)] hover:border-[var(--slate-300)] hover:bg-white sm:flex md:min-w-[220px]"
            >
              <Search className="size-3.5" />
              <span className="truncate">Rechercher…</span>
              <kbd className="ml-auto hidden rounded border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-faint)] lg:block">
                ⌘K
              </kbd>
            </button>
          )}

          <div className="relative">
            <Button
              aria-label="Notifications"
              variant="ghost"
              size="icon"
              onClick={() => setNotifs(!notifs)}
            >
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold leading-4 text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
            {notifs && (
              <div className="absolute right-0 top-12 w-[min(92vw,380px)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-md)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold">Notifications</h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {unread} non lue{unread > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {isAdmin && (
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          href="/notifications"
                          onClick={() => setNotifs(false)}
                        >
                          Voir toutes
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={markAllRead.isPending}
                      onClick={async () => {
                        try {
                          await markAllRead.mutateAsync();
                          await alertsQuery.refetch();
                          toast.success("Notifications marquées comme lues");
                        } catch {
                          toast.error(
                            "Impossible de marquer les notifications",
                          );
                        }
                      }}
                    >
                      <CheckCheck className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="max-h-[380px] overflow-y-auto">
                  {alerts.slice(0, 6).map((n) => (
                    <Link
                      onClick={async () => {
                        setNotifs(false);
                        if (!n.read) {
                          try {
                            await markOneRead.mutateAsync({ id: n.id });
                            await alertsQuery.refetch();
                          } catch {
                            /* ignore */
                          }
                        }
                      }}
                      href={
                        n.requisitionId
                          ? `/requisitions/${n.requisitionId}`
                          : isAdmin
                            ? "/notifications"
                            : "/dashboard"
                      }
                      key={n.id}
                      className="block border-b border-[var(--border)] px-4 py-3 hover:bg-[var(--surface-muted)]"
                    >
                      <div className="flex gap-3">
                        <span
                          className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                            n.read
                              ? "bg-[var(--slate-300)]"
                              : "bg-[var(--accent)]",
                          )}
                        />
                        <div>
                          <p className="text-[13px] font-semibold">{n.title}</p>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
                            {n.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {alerts.length === 0 && (
                    <p className="p-6 text-center text-sm text-[var(--text-muted)]">
                      Aucune notification.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="group relative">
            <button className="flex items-center gap-2 rounded-[var(--radius-md)] border border-transparent p-1 hover:border-[var(--border)] hover:bg-white">
              <span className="grid size-8 place-items-center rounded-full bg-[var(--navy-900)] text-[11px] font-semibold text-white">
                {initials}
              </span>
              <span className="hidden text-left xl:block">
                <b className="block text-[12px] font-semibold text-[var(--text)]">
                  {userLabel}
                </b>
                <span className="block text-[11px] text-[var(--text-muted)]">
                  {userRole}
                </span>
              </span>
              <ChevronDown className="hidden size-3 text-[var(--text-faint)] xl:block" />
            </button>
            <div className="invisible absolute right-0 top-12 w-52 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-1.5 opacity-0 shadow-[var(--shadow-md)] transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {!isAdmin && (
                <Link
                  href="/profil"
                  className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-muted)]"
                >
                  <UserRound className="size-4" />
                  Mon profil
                </Link>
              )}
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--critical)] hover:bg-red-50"
              >
                <LogOut className="size-4" />
                Se déconnecter
              </button>
            </div>
          </div>
        </header>

        <main className="app-main page-enter mx-auto min-h-[calc(100vh-var(--topbar-h))] max-w-[1440px] px-4 py-6 sm:px-6 md:px-8 md:py-9 xl:px-10">
          {children}
        </main>
      </div>

      <Dialog
        open={search}
        onOpenChange={setSearch}
        title="Recherche"
        description="Terrains et propriétés"
      >
        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-[var(--text-faint)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Saisir au moins 2 caractères…"
            className="nf-input nf-input--icon-left"
          />
        </div>
        <div className="mt-3 space-y-0.5">
          {query.length >= 2 && results.length === 0 && (
            <p className="p-6 text-center text-sm text-[var(--text-muted)]">
              Aucun résultat trouvé.
            </p>
          )}
          {results.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setSearch(false)}
              className="flex items-center justify-between rounded-[var(--radius-md)] p-3 hover:bg-[var(--surface-muted)]"
            >
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-[12px] text-[var(--text-muted)]">
                  {item.meta}
                </p>
              </div>
              <Badge>Ouvrir</Badge>
            </Link>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
