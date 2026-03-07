import { Badge } from "@/components/ui/badge";

export type SeverityLevel = "critical" | "high" | "medium";

const severityStyles: Record<SeverityLevel, string> = {
  critical: "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800",
  high: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800",
  medium: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800",
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
