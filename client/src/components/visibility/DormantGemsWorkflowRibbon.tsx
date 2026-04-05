import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import type { DormantGemCandidateItem } from "@/pages/dashboard/dashboard-types";
import type { DormantGemsSurface } from "./DormantGemsSurfaceSection";
import { sortDormantGemCandidatesByRevivalValue } from "@shared/visibility-policy";

/**
 * Batch 11.4：products / fb-ads / CI 頂層—主工作物件濃縮列（P 分排序與下方名單一致）。
 */
export function DormantGemsWorkflowRibbon({
  surface,
  candidates,
}: {
  surface: DormantGemsSurface;
  candidates: DormantGemCandidateItem[];
}) {
  const top = sortDormantGemCandidatesByRevivalValue(candidates ?? []).slice(0, 3);
  if (!top.length) return null;
  const tid = `dormant-gems-workflow-ribbon-${surface}`;
  return (
    <section
      data-testid={tid}
      aria-label="沉睡復活主工作物件 Top 3"
      className="rounded-xl border border-slate-200 bg-white border-l-4 border-l-indigo-500 px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 shadow-sm dark:border-border dark:bg-card"
    >
      <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-100 shrink-0">
        主工作物件 · 復活排序 Top 3（P 分）
      </span>
      {top.map((c) => (
        <div key={c.campaignId} className="flex items-center gap-1.5 min-w-0 max-w-full">
          <Badge variant="outline" className="text-xs font-mono shrink-0 tabular-nums">
            P{c.revivalPriorityScore ?? "—"}
          </Badge>
          <span className="text-xs font-medium truncate max-w-[220px]">{c.campaignName}</span>
          <span className="text-xs text-muted-foreground truncate hidden sm:inline max-w-[120px]">{c.productName}</span>
        </div>
      ))}
      <Link
        href="/fb-ads"
        className="text-xs text-primary ml-auto underline-offset-2 hover:underline shrink-0"
        data-testid={`dormant-gems-workflow-ribbon-link-${surface}`}
      >
        至預算控制操作
      </Link>
    </section>
  );
}
