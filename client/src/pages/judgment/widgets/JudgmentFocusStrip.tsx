import type { DecisionCardBlock } from "@shared/decision-cards-engine";
import type { GoalPacingEvaluation } from "@shared/goal-pacing-engine";

/**
 * Batch 15.7 v12：Focus 決策面 — 主結論／下一步／信任／單條證據；其餘一律營運工作台。
 */
export function JudgmentFocusStrip({
  decisionCards,
  goalPacingByProduct: _goalPacingByProduct,
  onOpenOperatorBlocks: _onOpenOperatorBlocks,
}: {
  decisionCards: DecisionCardBlock[];
  goalPacingByProduct: Record<string, GoalPacingEvaluation>;
  onOpenOperatorBlocks: () => void;
}) {
  const summaryCard = decisionCards.find((c) => c.key === "summary");

  const conclusion =
    summaryCard?.conclusion ??
    (decisionCards.length === 0
      ? "尚無決策卡資料，請先同步廣告並重新整理。"
      : decisionCards[0]?.conclusion ?? "—");

  const nextAction =
    summaryCard?.suggestedAction ||
    decisionCards.find((c) => c.suggestedAction && c.key !== "summary")?.suggestedAction ||
    "請在下方輸入情境，或用頂欄「營運工作台」取得完整營運卡。";

  let evidenceHint = summaryCard?.evidenceMetrics?.trim() || summaryCard?.triggerRule?.trim() || "";

  const confidence = summaryCard?.confidence;
  const confidenceShort =
    confidence === "high"
      ? "信心高"
      : confidence === "medium"
        ? "信心中"
        : confidence === "low"
          ? "信心低"
          : confidence === "data_insufficient"
            ? "證據不足"
            : "";

  const evidenceOneLine =
    evidenceHint.length > 160 ? `${evidenceHint.slice(0, 160)}…` : evidenceHint;

  return (
    <div data-testid="judgment-focus-v12-executive-shell" className="space-y-1 max-w-3xl">
      <div
        className="rounded-md border-l-4 border-l-primary/60 bg-primary/[0.03] pl-3 py-2 space-y-1"
        data-testid="judgment-focus-strip-v12"
      >
        <p className="text-sm font-semibold text-foreground leading-snug tracking-tight">{conclusion}</p>
        <p className="text-[11px] text-emerald-800 dark:text-emerald-200 leading-snug">
          <span className="font-semibold">下一步 · </span>
          {nextAction}
        </p>
        {confidenceShort ? (
          <p className="text-[10px] text-muted-foreground leading-snug" data-testid="judgment-focus-trust-line-v12">
            信任／風險 · {confidenceShort}
          </p>
        ) : null}
        {evidenceOneLine ? (
          <p
            className="text-[10px] text-muted-foreground leading-snug line-clamp-2"
            data-testid="judgment-focus-evidence-single-v12"
          >
            證據：<span data-testid="judgment-focus-evidence-hint-v12">{evidenceOneLine}</span>
          </p>
        ) : null}
      </div>
      <p className="text-[9px] text-muted-foreground px-0.5" data-testid="judgment-focus-operator-path-v12">
        決策卡全文／節奏／執行閘門 → 頂欄「營運工作台」。
      </p>
    </div>
  );
}
