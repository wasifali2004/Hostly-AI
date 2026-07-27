import { cn } from "@/lib/utils";

export function Card({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("workspace-panel", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  eyebrow,
  title,
  action,
  className
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-4", className)}>
      <div>
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      {action}
    </header>
  );
}
