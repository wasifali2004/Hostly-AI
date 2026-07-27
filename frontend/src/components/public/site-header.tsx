"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";

const links = [
  { href: "/events", label: "Discover" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#platform", label: "Platform" },
  { href: "/#operations", label: "Use cases" }
];

export function SiteHeader({
  dark = false,
  floating = false
}: {
  dark?: boolean;
  floating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const managementMembership = user?.memberships.find(
    (membership) => membership.role !== "ATTENDEE"
  );
  const accountHref = managementMembership
    ? `/org/${managementMembership.organization.slug}/dashboard`
    : "/dashboard";

  return (
    <header
      className={[
        "relative z-30 transition-[background-color,border-color,box-shadow] duration-300",
        dark
          ? "border-b border-white/10 bg-midnight text-white"
          : scrolled || !floating
            ? "border-b border-ink/8 bg-paper/96 text-ink backdrop-blur-md shadow-[0_2px_16px_rgba(18,18,18,0.06)]"
            : "border-b border-transparent bg-paper text-ink"
      ].join(" ")}
    >
      <div className="page-shell flex h-[4.25rem] items-center justify-between gap-4">
        {/* Logo */}
        <Logo inverse={dark} />

        {/* Desktop pill nav */}
        <nav
          className={[
            "hidden items-center md:flex",
            "rounded-full px-2 py-1.5",
            dark
              ? "border border-white/10 bg-white/5"
              : "border border-ink/8 bg-white/80 backdrop-blur"
          ].join(" ")}
          aria-label="Main navigation"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-150",
                dark
                  ? "text-white/60 hover:bg-white/10 hover:text-white"
                  : "text-ink/55 hover:bg-ink/5 hover:text-ink"
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA buttons */}
        <div className="hidden items-center gap-2 md:flex">
          {!loading && user ? (
            <>
              <span
                className={`mr-1 max-w-36 truncate text-xs font-bold ${
                  dark ? "text-white/50" : "text-ink/45"
                }`}
              >
                {user.name}
              </span>
              <ButtonLink href={accountHref} variant={dark ? "inverse" : "primary"} size="sm">
                {managementMembership ? "Workspace" : "My events"}
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink
                href="/login"
                variant="ghost"
                size="sm"
                className={dark ? "text-white/70 hover:bg-white/10 hover:text-white" : ""}
              >
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" variant={dark ? "inverse" : "primary"} size="sm">
                Host an event
              </ButtonLink>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={[
            "focus-ring grid h-10 w-10 place-items-center rounded-full border transition-colors md:hidden",
            dark
              ? "border-white/15 bg-white/10 hover:bg-white/15"
              : "border-ink/10 bg-white hover:bg-fog"
          ].join(" ")}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div
          className={[
            "mx-auto mb-3 mt-1 w-[calc(100%-2rem)] rounded-[1.75rem] border px-5 pb-6 pt-4 shadow-deep md:hidden",
            dark ? "border-white/10 bg-midnight" : "border-ink/8 bg-white"
          ].join(" ")}
        >
          <nav className="grid" aria-label="Mobile navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={[
                  "border-b py-3.5 text-sm font-semibold",
                  dark ? "border-white/10 text-white/75" : "border-ink/[0.07] text-ink/70"
                ].join(" ")}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <ButtonLink
            href={user ? accountHref : "/signup"}
            variant={dark ? "inverse" : "primary"}
            className="mt-5 w-full"
          >
            {user
              ? managementMembership
                ? "Open workspace"
                : "View my events"
              : "Create workspace"}
          </ButtonLink>
        </div>
      ) : null}
    </header>
  );
}
