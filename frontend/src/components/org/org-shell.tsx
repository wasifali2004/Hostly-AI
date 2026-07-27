"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarRange,
  ChevronDown,
  ExternalLink,
  History,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { LoadingBlock } from "@/components/ui/status";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { cn, initials } from "@/lib/utils";

function workspaceHref(slug: string) {
  return `/org/${encodeURIComponent(slug)}/dashboard`;
}

export function OrgShell({
  orgSlug,
  children
}: {
  orgSlug: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { user, loading, signOut } = useAuth();
  const { membership, organization, canManage, isAdmin } = useOrg(orgSlug);
  const pathname = usePathname();
  const router = useRouter();
  const base = `/org/${encodeURIComponent(orgSlug)}`;

  useEffect(() => {
    if (!loading && user && (!membership || !canManage)) {
      router.replace("/dashboard");
    }
  }, [canManage, loading, membership, router, user]);

  const pageTitle = useMemo(() => {
    if (pathname.endsWith("/events/new")) return "Create event";
    if (pathname.endsWith("/edit")) return "Edit event";
    if (pathname.endsWith("/registrations")) return "Registrations";
    if (pathname.endsWith("/checkin")) return "Door check-in";
    if (pathname.endsWith("/events")) return "Events";
    if (pathname.endsWith("/venues/availability")) return "Room availability";
    if (pathname.endsWith("/venues")) return "Venues & rooms";
    if (pathname.endsWith("/activity")) return "Activity log";
    if (pathname.endsWith("/compliance")) return "Compliance";
    if (pathname.endsWith("/members")) return "Members";
    if (pathname.endsWith("/settings")) return "Settings";
    return "Overview";
  }, [pathname]);

  if (loading || !user || !organization || !membership || !canManage) {
    return <LoadingBlock label="Opening your workspace…" />;
  }

  const navigation = [
    { href: `${base}/dashboard`, label: "Overview", icon: BarChart3 },
    { href: `${base}/events`, label: "Events", icon: CalendarRange },
    { href: `${base}/venues`, label: "Venues", icon: Building2 },
    ...(isAdmin
      ? [
          { href: `${base}/members`, label: "Members", icon: Users },
          { href: `${base}/activity`, label: "Activity", icon: History },
          { href: `${base}/compliance`, label: "Compliance", icon: ShieldCheck },
          { href: `${base}/settings`, label: "Settings", icon: Settings }
        ]
      : [])
  ];

  const sidebar = (
    <div className="flex h-full flex-col overflow-y-auto border-r border-white/10 bg-midnight px-3 py-4 text-white">
      <div className="flex h-12 items-center justify-between px-2">
        <Logo inverse href={base + "/dashboard"} />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 lg:hidden"
          aria-label="Close workspace navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-6 px-1">
        <button
          type="button"
          onClick={() => setWorkspaceMenu((current) => !current)}
          className="focus-ring flex w-full items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] p-2.5 text-left transition-[background-color,border-color] hover:border-white/20 hover:bg-white/[0.08]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-butter text-xs font-extrabold text-ink">
            {initials(organization.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{organization.name}</span>
            <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[.12em] text-white/40">
              {membership.role.replace("_", " ")}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-white/35" />
        </button>
        {workspaceMenu ? (
          <div className="absolute inset-x-0 top-[calc(100%+.4rem)] z-30 rounded-lg border border-slate-200 bg-white p-1.5 text-ink shadow-lift">
            {user.memberships
              .filter((item) => item.role !== "ATTENDEE")
              .map((item) => (
                <Link
                  key={item.organizationId}
                  href={workspaceHref(item.organization.slug)}
                  onClick={() => setWorkspaceMenu(false)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-[9px] font-semibold">
                    {initials(item.organization.name)}
                  </span>
                  <span className="truncate">{item.organization.name}</span>
                </Link>
              ))}
          </div>
        ) : null}
      </div>

      <nav className="mt-7 space-y-1 px-1" aria-label="Workspace">
        <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[.14em] text-white/30">
          Workspace
        </p>
        {navigation.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            ((label === "Events" || label === "Venues") && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "focus-ring flex h-10 items-center gap-3 rounded-full px-3 text-xs font-bold transition-[background-color,color,box-shadow]",
                active
                  ? "bg-butter text-ink shadow-[0_10px_24px_rgba(255,217,90,.22)]"
                  : "text-white/55 hover:bg-white/[0.065] hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-1 mt-auto border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 px-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-semibold">
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold">{user.name}</span>
            <span className="block truncate text-[9px] text-white/40">{user.email}</span>
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="grid h-8 w-8 place-items-center rounded-full text-white/35 hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[16.5rem] lg:block">{sidebar}</aside>
      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close workspace navigation"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[min(19rem,88vw)] lg:hidden">
            {sidebar}
          </aside>
        </>
      ) : null}

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-30 flex h-[4.5rem] items-center border-b border-ink/10 bg-paper/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="mr-3 grid h-10 w-10 place-items-center rounded-full border border-ink/10 bg-white shadow-sm lg:hidden"
            aria-label="Open workspace navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[9px] font-medium uppercase tracking-[.12em] text-slate-500">
              {organization.name}
            </p>
            <h1 className="mt-0.5 truncate text-sm font-semibold text-slate-950">{pageTitle}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/org/${encodeURIComponent(orgSlug)}`}
              className="hidden h-10 items-center gap-2 rounded-full px-4 text-[11px] font-bold text-ink/55 transition hover:bg-white hover:text-ink sm:flex"
            >
              Public profile
              <ExternalLink className="h-3 w-3" />
            </Link>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationOpen((current) => !current)}
                className="focus-ring relative grid h-10 w-10 place-items-center rounded-full border border-ink/10 bg-white text-ink/50 shadow-sm transition-[border-color,color,background-color] hover:border-ink/25 hover:text-ink"
                aria-label="Open notifications"
                aria-expanded={notificationOpen}
              >
                <Bell className="h-4 w-4" />
              </button>
              {notificationOpen ? (
                <div className="absolute right-0 top-[calc(100%+.55rem)] z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lift">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Notifications</p>
                      <p className="mt-0.5 text-[9px] text-slate-400">Workspace updates and operational alerts</p>
                    </div>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-emerald-700">
                      All clear
                    </span>
                  </div>
                  <div className="p-5 text-center">
                    <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-400">
                      <Bell className="h-4 w-4" />
                    </span>
                    <p className="mt-3 text-xs font-semibold text-slate-800">You’re all caught up</p>
                    <p className="mx-auto mt-1 max-w-[15rem] text-[10px] leading-5 text-slate-400">
                      Registration spikes, booking conflicts, and team changes will appear here.
                    </p>
                  </div>
                  {isAdmin ? (
                    <Link
                      href={`${base}/activity`}
                      onClick={() => setNotificationOpen(false)}
                      className="flex h-10 items-center justify-center border-t border-slate-200 bg-slate-50 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Open activity log
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
            <Link
              href={`${base}/events/new`}
              className="button-polish focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-ink bg-ink px-4 text-[11px] font-bold text-white shadow-sm transition-[background-color,box-shadow,transform] hover:bg-black"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New event</span>
              <span className="sm:hidden">New</span>
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-[100rem] p-4 sm:p-6 lg:p-8 xl:p-9">{children}</div>
      </div>
      <AiAssistantPanel organizationId={organization.id} orgSlug={orgSlug} />
    </div>
  );
}
