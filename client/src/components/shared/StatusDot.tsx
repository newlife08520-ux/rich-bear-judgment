import { cn } from "@/lib/utils";
import type { StatusSemantic } from "./status-colors";
import { statusClasses } from "./status-colors";

const SIZE_MAP = { sm: "w-1.5 h-1.5", md: "w-2 h-2", lg: "w-2.5 h-2.5" } as const;

export function StatusDot({
  semantic,
  size = "md",
  className,
}: {
  semantic: StatusSemantic;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}) {
  const { dot } = statusClasses(semantic);
  return <span className={cn("rounded-full shrink-0", dot, SIZE_MAP[size], className)} aria-hidden />;
}
