"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  title,
  description,
  children,
  onOpenChange,
  className
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onOpenChange, open]);

  if (!open) return null;

  function closeFromBackdrop(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onOpenChange(false);
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={closeFromBackdrop}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-md animate-fade-up rounded-xl border border-slate-200 bg-white p-6 shadow-lift outline-none",
          className
        )}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={() => onOpenChange(false)}
          className="focus-ring absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <h2
          id={titleId}
          className="pr-10 font-display text-xl font-semibold tracking-[-0.02em] text-slate-950"
        >
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onOpenChange
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onOpenChange={loading ? () => undefined : onOpenChange}
    >
      {destructive ? (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-3 text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-xs leading-5">This action takes effect immediately.</p>
        </div>
      ) : null}
      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          onClick={() => void onConfirm()}
          loading={loading}
          loadingLabel="Working…"
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
