"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

type ToastOptions = {
  description?: string;
  duration?: number;
};

type ToastItem = ToastOptions & {
  id: number;
  title: string;
  tone: ToastTone;
};

type ToastApi = {
  success: (title: string, options?: ToastOptions) => void;
  error: (title: string, options?: ToastOptions) => void;
  info: (title: string, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const toneStyles: Record<
  ToastTone,
  { icon: typeof CheckCircle2; iconClassName: string; barClassName: string }
> = {
  success: {
    icon: CheckCircle2,
    iconClassName: "text-emerald-600",
    barClassName: "bg-emerald-500"
  },
  error: {
    icon: AlertCircle,
    iconClassName: "text-red-600",
    barClassName: "bg-red-500"
  },
  info: {
    icon: Info,
    iconClassName: "text-blue-600",
    barClassName: "bg-blue-500"
  }
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (tone: ToastTone, title: string, options: ToastOptions = {}) => {
      const id = ++nextId.current;
      const duration = options.duration ?? (tone === "error" ? 6500 : 4200);

      setItems((current) => [
        ...current.slice(-3),
        { id, tone, title, description: options.description, duration }
      ]);

      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, options) => show("success", title, options),
      error: (title, options) => show("error", title, options),
      info: (title, options) => show("info", title, options),
      dismiss
    }),
    [dismiss, show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 top-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[24rem]"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => {
          const style = toneStyles[item.tone];
          const Icon = style.icon;
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto relative w-full animate-toast-in overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 p-4 pr-11 shadow-lift backdrop-blur-xl"
            >
              <span className={cn("absolute inset-y-0 left-0 w-1", style.barClassName)} />
              <div className="flex gap-3">
                <Icon
                  className={cn("mt-0.5 h-5 w-5 shrink-0", style.iconClassName)}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="focus-ring absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              {item.duration && item.duration > 0 ? (
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-0.5 origin-left",
                    style.barClassName
                  )}
                  style={{
                    animation: `toastProgress ${item.duration}ms linear forwards`
                  }}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }
  return context;
}
