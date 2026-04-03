/**
 * Batch 9.7 / 10.9：首頁統一指揮語 digest（與 COMMAND-LANGUAGE-MATRIX／引擎動詞對齊）。
 */

/** Batch 10.9 v6：與 COMMAND-LANGUAGE-MATRIX 動詞對齊的極短籌碼（矩陣完整詞：救援、觀察、不碰、繼續收集證據 — 見 rules） */
const DIGEST = [
  { key: "scale", label: "放大" },
  { key: "hold", label: "守住" },
  { key: "rescue", label: "救" },
  { key: "revive", label: "復活" },
  { key: "rules", label: "補規則" },
  { key: "evidence", label: "等證據" },
] as const;

export function HomepageCommandDigest() {
  return (
    <section data-testid="section-homepage-command-digest" aria-label="指揮語摘要">
      <div className="rounded-lg border border-dashed border-primary/35 bg-gradient-to-r from-primary/[0.06] to-transparent px-3 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground shrink-0">指揮語</span>
          <div className="flex flex-wrap gap-1.5" data-testid="block-homepage-command-digest-pills">
            {DIGEST.map((d) => (
              <span
                key={d.key}
                data-testid={`command-digest-${d.key}`}
                className="rounded-full border border-primary/20 bg-background/95 px-2 py-0.5 text-[11px] font-medium text-foreground"
              >
                {d.label}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            口徑以「今日戰略指令」為準 ·{" "}
            <span className="font-mono text-[9px]">docs/HOMEPAGE-COMMAND-DIGEST-RULES.md</span>
          </span>
        </div>
      </div>
    </section>
  );
}
