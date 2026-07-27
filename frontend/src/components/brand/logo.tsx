import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * BrandIcon — the standalone mark (ticket shape with spark)
 * Uses deep navy fill + amber accent, scales cleanly at any size.
 */
export function BrandMark({
  className,
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 44 44"
      role="img"
      aria-label="Hostly AI mark"
      className={cn("h-9 w-9 shrink-0", className)}
      fill="none"
    >
      {/* Rounded-square ticket body */}
      <rect
        x="2"
        y="2"
        width="40"
        height="40"
        rx="13"
        fill={inverse ? "#ffffff" : "#10172a"}
      />
      {/* Ticket notch — left */}
      <circle cx="2" cy="22" r="5" fill={inverse ? "#bca7ff" : "#fbfaf6"} />
      {/* Ticket notch — right */}
      <circle cx="42" cy="22" r="5" fill={inverse ? "#bca7ff" : "#fbfaf6"} />
      {/* Horizontal perforation line */}
      <line
        x1="8"
        y1="22"
        x2="36"
        y2="22"
        stroke={inverse ? "#10172a" : "#ffffff"}
        strokeWidth="1.25"
        strokeDasharray="3 3"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* Spark / star — amber accent */}
      <path
        d="M22 10 L23.4 15.6 L28 14 L24.8 18 L28 22 L22.6 20.4 L22 26 L21.4 20.4 L16 22 L19.2 18 L16 14 L20.6 15.6 Z"
        fill={inverse ? "#10172a" : "#ffd95a"}
        opacity="0.95"
      />
    </svg>
  );
}

/**
 * Logo — full lockup: BrandMark + wordmark "Hostly" + superscript "AI"
 */
export function Logo({
  compact = false,
  inverse = false,
  href = "/",
  className,
}: {
  compact?: boolean;
  inverse?: boolean;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Hostly home"
      className={cn(
        "group focus-ring inline-flex items-center gap-2.5 rounded-lg",
        inverse ? "text-white" : "text-ink",
        className,
      )}
    >
      <BrandMark
        inverse={inverse}
        className="transition-[box-shadow,transform] duration-200 group-hover:shadow-glow group-hover:-rotate-3"
      />
      {!compact ? (
        <span className="inline-flex items-baseline font-display leading-none">
          <span
            className={cn(
              "text-[20px] font-bold tracking-[-0.055em]",
              inverse ? "text-white" : "text-ink",
            )}
          >
            Hostly
          </span>
          <span
            className={cn(
              "ml-1.5 translate-y-[-0.1em] rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em]",
              inverse
                ? "bg-white/15 text-white"
                : "bg-butter text-ink",
            )}
          >
            AI
          </span>
        </span>
      ) : null}
    </Link>
  );
}
