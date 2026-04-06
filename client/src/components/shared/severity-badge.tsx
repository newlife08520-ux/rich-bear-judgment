import { Badge } from "@/components/ui/badge";

export type SeverityLevel = "critical" | "high" | "medium";

const severityStyles: Record<SeverityLevel, string> = {
  critical:
    "bg-[var(--status-loss-surface)] text-[var(--status-loss)] border border-[var(--status-loss-light)] px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-none",
  high:
    "bg-[var(--status-watch-surface)] text-[var(--status-watch)] border border-[var(--status-watch-light)] px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-none",
  medium:
    "bg-[var(--status-dormant-surface)] text-[var(--status-dormant)] border border-[var(--status-dormant-light)] px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-none",
};

const severityLabels: Record<SeverityLevel, string> = {
  critical: "嚴重",
  high: "高",
  medium: "中",
};

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return (
    <Badge variant="outline" className={severityStyles[severity]} data-testid={`badge-severity-${severity}`}>
      {severityLabels[severity]}
    </Badge>
  );
}

export { severityStyles, severityLabels };
