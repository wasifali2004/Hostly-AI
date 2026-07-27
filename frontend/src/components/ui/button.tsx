import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link, { type LinkProps } from "next/link";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "border border-ink bg-ink text-white hover:bg-black disabled:bg-slate-400",
  coral:
    "border border-ink bg-ink text-white hover:bg-black disabled:opacity-50",
  secondary:
    "border border-ink/20 bg-white text-ink hover:border-ink hover:bg-white disabled:opacity-50",
  ghost:
    "text-ink/65 hover:bg-ink/5 hover:text-ink disabled:opacity-50",
  inverse:
    "border border-white bg-white text-ink hover:bg-white/90 disabled:bg-white/50",
  amber:
    "border border-ink/15 bg-butter text-ink hover:bg-[#f5ce48] disabled:opacity-50",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
};

const sizes = {
  sm: "h-10 px-4 text-xs",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-7 text-sm",
  icon: "h-10 w-10 p-0 text-sm"
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      type = "button",
      loading = false,
      loadingLabel,
      disabled,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "button-polish focus-ring inline-flex items-center justify-center gap-2 rounded-full font-bold",
        "transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out",
        "active:shadow-inner",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:shadow-none",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  )
);
Button.displayName = "Button";

type ButtonLinkProps = LinkProps & {
  children: React.ReactNode;
  className?: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "button-polish focus-ring inline-flex items-center justify-center gap-2 rounded-full font-bold",
        "transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out",
        "active:shadow-inner",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
