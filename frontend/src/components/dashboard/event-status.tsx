import type { EventStatus } from "@/types";
import { cn } from "@/lib/utils";

const styles: Record<EventStatus, string> = {
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700"
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em]",
        styles[status]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.toLowerCase()}
    </span>
  );
}
