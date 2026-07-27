import { AlertCircle, Inbox, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-medium text-ink/55">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({
  title = "We couldn’t load this",
  message = "The service may be temporarily unavailable. Please try again.",
  onRetry
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
      <AlertCircle className="mx-auto h-6 w-6 text-red-600" />
      <h3 className="mt-3 text-sm font-bold text-red-950">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-red-800/75">{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} variant="secondary" size="sm" className="mt-4 bg-white">
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <Inbox className="mx-auto h-6 w-6 text-ink/35" />
      <h3 className="mt-3 text-sm font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink/55">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
