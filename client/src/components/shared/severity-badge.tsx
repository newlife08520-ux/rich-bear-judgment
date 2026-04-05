import { Badge } from "@/components/ui/badge";

export type SeverityLevel = "critical" | "high" | "medium";

const severityStyles: Record<SeverityLevel, string> = {
  critical:
    "text-rose-700 bg-rose-50 border border-rose-200 dark:text-rose-300 dark:bg-rose-950 dark:border-rose-800/50",
  high: "text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-300 dark:bg-amber-950 dark:border-amber-800/50",
  medium:
    "text-indigo-700 bg-indigo-50 border border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950 dark:border-indigo-800/50",
};

const severityLabels: Record<SeverityLevel, string> = {
  critical: "嚴重",
  high: "高",
  medium: "中",
};

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return (
    <Badge variant="outline" className={`text-xs ${severityStyles[severity]}`} data-testid={`badge-severity-${severity}`}>
      {severityLabels[severity]}
    </Badge>
  );
}

export { severityStyles, severityLabels };
