import { cn } from "@/lib/utils";

export type ReportGradeLetter = "S" | "A" | "B" | "C" | "D" | "F";

export function scoreToGradeLetter(score: number): ReportGradeLetter {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function gradeTone(g: ReportGradeLetter): string {
  if (g === "S" || g === "A") return "text-emerald-600 dark:text-emerald-400";
  if (g === "B") return "text-sky-600 dark:text-sky-400";
  if (g === "C") return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function gradeBarColor(g: ReportGradeLetter): string {
  if (g === "S" || g === "A") return "bg-emerald-500";
  if (g === "B") return "bg-sky-500";
  if (g === "C") return "bg-amber-500";
  return "bg-red-500";
}

export function ScoreBar({
  score,
  className,
  grade: gradeOverride,
}: {
  score: number;
  className?: string;
  grade?: ReportGradeLetter;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const grade = gradeOverride ?? scoreToGradeLetter(clamped);
  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <span
        className={cn("text-2xl font-black tabular-nums leading-none w-9 text-center shrink-0", gradeTone(grade))}
        data-testid="score-bar-grade"
      >
        {grade}
      </span>
      <div className="flex-1 min-w-0 h-2.5 rounded-full bg-muted overflow-hidden border border-border/50">
        <div
          className={cn("h-full rounded-full transition-all duration-500", gradeBarColor(grade))}
          style={{ width: `${clamped}%` }}
          data-testid="score-bar-fill"
        />
      </div>
      <span className="text-sm font-semibold tabular-nums text-muted-foreground w-10 text-right shrink-0">{clamped}</span>
    </div>
  );
}
