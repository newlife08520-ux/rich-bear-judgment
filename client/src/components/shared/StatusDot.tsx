import { cn } from "@/lib/utils";
import type { StatusSemantic } from "./status-colors";
import { statusClasses } from "./status-colors";

const SIZE_MAP = { sm: "w-2 h-2", md: "w-3 h-3", lg: "w-4 h-4" } as const;

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
