import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type VersionPayload = {
  attribution?: {
    ambiguityReasons?: string[];
    snapshotConfidence?: { level?: string; summary?: string; ambiguityExplanation?: string };
    linkSummary?: { lines?: string[] };
    whyWinning?: string;
    whyLosing?: string;
  };
};

/** 7.3：單版本 drilldown；7.8：補齊 link 摘要與信心敘述 */
export function AttributionVersionProbe() {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VersionPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setData(null);
    const v = id.trim();
    if (!v) {
      setErr("請輸入 assetVersionId");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/creative-intelligence/version/${encodeURIComponent(v)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setErr(`HTTP ${res.status}`);
        return;
      }
      const j = (await res.json()) as VersionPayload;
      setData(j);
    } catch {
      setErr("fetch 失敗");
    } finally {
      setLoading(false);
    }
  }

  const reasons = data?.attribution?.ambiguityReasons ?? [];
  const conf = data?.attribution?.snapshotConfidence;
  const level = conf?.level ?? "—";
  const linkLines = data?.attribution?.linkSummary?.lines ?? [];

  return (
    <div className="space-y-3" data-testid="ci-attribution-version-probe">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="assetVersionId"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="max-w-md"
          data-testid="ci-attribution-version-input"
        />
        <Button type="button" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? "載入…" : "載入歸因"}
        </Button>
        <Badge variant="secondary" data-testid="ci-attribution-confidence-badge">
          信心：{level}
        </Badge>
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {conf?.summary ? (
        <p className="text-sm text-muted-foreground" data-testid="ci-attribution-confidence-summary">
          {conf.summary}
        </p>
      ) : null}
      {conf?.ambiguityExplanation ? (
        <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="ci-attribution-ambiguity-explanation">
          {conf.ambiguityExplanation}
        </p>
      ) : null}
      {linkLines.length > 0 ? (
        <ul className="text-xs list-disc pl-5 space-y-0.5 text-muted-foreground" data-testid="ci-attribution-link-summary">
          {linkLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {data?.attribution?.whyWinning ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400" data-testid="ci-attribution-why-winning">
          {data.attribution.whyWinning}
        </p>
      ) : null}
      {data?.attribution?.whyLosing ? (
        <p className="text-xs text-rose-700 dark:text-rose-400" data-testid="ci-attribution-why-losing">
          {data.attribution.whyLosing}
        </p>
      ) : null}
      {reasons.length > 0 ? (
        <ul className="text-sm list-disc pl-5 space-y-1" data-testid="ci-ambiguity-reason-lines">
          {reasons.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
