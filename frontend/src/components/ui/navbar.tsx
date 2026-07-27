import Link from "next/link";
import { cn } from "@/lib/utils";

export function Navbar({
  items,
  className,
  linkClassName
}: {
  items: Array<{ href: string; label: string }>;
  className?: string;
  linkClassName?: string;
}) {
  return (
    <nav className={cn("flex items-center", className)} aria-label="Main navigation">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn("focus-ring rounded text-xs font-bold transition", linkClassName)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
