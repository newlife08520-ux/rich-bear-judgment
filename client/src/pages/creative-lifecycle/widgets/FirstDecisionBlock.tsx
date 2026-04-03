import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DECISION_ACTIONS } from "../lifecycle-constants";

/** 第一次決策點：五選一寫回系統狀態 */
export function FirstDecisionBlock({
  campaignId,
  suggestedAction,
  suggestedPct,
  savedDecision,
  firstDecisionMin,
  firstDecisionMax,
  onDecisionSaved,
}: {
  campaignId: string;
  name?: string;
  suggestedAction?: string;
  suggestedPct?: number | "關閉";
  savedDecision?: string | null;
  firstDecisionMin: number;
  firstDecisionMax: number;
  onDecisionSaved: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();
  const handleDecision = async (decision: string) => {
    setSaving(decision);
    try {
      const res = await fetch("/api/dashboard/creative-lifecycle/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ campaignId, decision }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || "寫回失敗");
      }
      toast({ title: `已決策：${decision}`, duration: 2000 });
      onDecisionSaved();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "寫回失敗", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };
  return (
    <div className="rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2 text-xs">
      <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">第一次決策點（花費 {firstDecisionMin}–{firstDecisionMax}）</p>
      <p>建議：<strong>{suggestedAction ?? "—"}</strong>{" "}
        {suggestedPct === "關閉" ? "關閉" : typeof suggestedPct === "number" ? (suggestedPct > 0 ? `+${suggestedPct}%` : `${suggestedPct}%`) : ""}
      </p>
      {savedDecision && <p className="text-muted-foreground mt-0.5 mb-1.5">已決策：<strong>{savedDecision}</strong></p>}
      <div className="flex flex-wrap gap-1 mt-1">
        {DECISION_ACTIONS.map((d) => (
          <Button
            key={d}
            size="sm"
            variant={savedDecision === d ? "default" : "outline"}
            className="h-7 text-[11px]"
            onClick={() => handleDecision(d)}
            disabled={saving !== null}
          >
            {saving === d ? "…" : d}
          </Button>
        ))}
      </div>
    </div>
  );
}
