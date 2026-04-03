/**
 * 7.0：Creative Intelligence Workbench 擴充欄位（與 patterns 分檔，避免單檔過長）。
 */
import type {
  CreativeExperimentLink,
  CreativeOutcomeSnapshot,
  CreativePatternTag,
  CreativeReviewRecord,
} from "@prisma/client";

const TAG_FAMILIES = [
  "hook",
  "pain",
  "proof",
  "cta",
  "format",
  "angle",
  "scene",
  "visual",
  "visual_motif",
  "pacing",
  "pacing_motif",
  "brand",
] as const;
export type TagFamily = (typeof TAG_FAMILIES)[number];

function isWinLife(s?: string | null) {
  return s === "WINNER" || s === "UNDERFUNDED_GOOD";
}
function isLoseLife(s?: string | null) {
  return s === "LOSING" || s === "RETIRED";
}

export function buildTagFamilyWorkbench(params: {
  tags: CreativePatternTag[];
  reviews: CreativeReviewRecord[];
  versionLatest: Map<string, CreativeOutcomeSnapshot>;
}) {
  const { tags, reviews, versionLatest } = params;
  const reviewById = new Map(reviews.map((r) => [r.id, r]));

  type Row = { tagType: string; tagValue: string; lifecycleLabel?: string };
  const rows: Row[] = [];
  for (const t of tags) {
    const rev = reviewById.get(t.creativeReviewId);
    const snap = rev ? versionLatest.get(rev.assetVersionId) : undefined;
    const ok = snap && !snap.ambiguousAttribution;
    rows.push({
      tagType: t.tagType,
      tagValue: t.tagValue,
      lifecycleLabel: ok ? snap!.lifecycleLabel ?? undefined : undefined,
    });
  }

  const byFamily: Record<
    string,
    { winners: { key: string; count: number }[]; losers: { key: string; count: number }[] }
  > = {};

  for (const fam of TAG_FAMILIES) {
    const win = new Map<string, number>();
    const lose = new Map<string, number>();
    for (const r of rows) {
      if (r.tagType !== fam) continue;
      const k = `${r.tagType}:${r.tagValue}`;
      if (isWinLife(r.lifecycleLabel)) win.set(k, (win.get(k) ?? 0) + 1);
      if (isLoseLife(r.lifecycleLabel)) lose.set(k, (lose.get(k) ?? 0) + 1);
    }
    const top = (m: Map<string, number>, n: number) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));
    byFamily[fam] = { winners: top(win, 8), losers: top(lose, 8) };
  }

  return { tagFamilies: byFamily, tagFamilyOrder: [...TAG_FAMILIES] };
}

export function buildHiddenDiamondEvidenceList(snaps: CreativeOutcomeSnapshot[], limit = 24) {
  const snapOk = (s: CreativeOutcomeSnapshot) => !s.ambiguousAttribution;
  const filtered = snaps.filter(
    (s) => snapOk(s) && ((s.qualityScore ?? 0) >= 70 || (s.roas >= 2.5 && s.spend < 300))
  );
  return filtered.slice(0, limit).map((s) => {
    let evidenceSnippet = "";
    try {
      const j = s.evidenceJson ? JSON.parse(s.evidenceJson) : null;
      if (j && typeof j === "object") evidenceSnippet = JSON.stringify(j).slice(0, 280);
    } catch {
      evidenceSnippet = (s.evidenceJson ?? "").slice(0, 280);
    }
    return {
      assetVersionId: s.assetVersionId,
      productName: s.productName,
      roas: s.roas,
      spend: s.spend,
      lifecycleLabel: s.lifecycleLabel,
      ambiguousAttribution: s.ambiguousAttribution,
      evidenceSnippet: evidenceSnippet || undefined,
    };
  });
}

export function buildVersionTimelineEntries(
  reviews: CreativeReviewRecord[],
  snaps: CreativeOutcomeSnapshot[],
  links: Pick<CreativeExperimentLink, "linkedAt" | "isActive" | "publishDraftId">[]
) {
  const events: { at: string; kind: string; label: string }[] = [];
  for (const r of reviews) {
    events.push({
      at: r.createdAt.toISOString(),
      kind: "review",
      label: `審判 ${r.reviewStatus} · ${r.workflow}`,
    });
  }
  for (const s of snaps) {
    events.push({
      at: s.snapshotDate.toISOString(),
      kind: "snapshot",
      label: `Outcome 快照 · ${s.lifecycleLabel ?? "—"} · ambiguous=${s.ambiguousAttribution}`,
    });
  }
  for (const l of links) {
    events.push({
      at: l.linkedAt.toISOString(),
      kind: "link",
      label: `Experiment link · draft=${l.publishDraftId ?? "—"} · active=${l.isActive}`,
    });
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  return events.slice(0, 40);
}

export function listProductNamesFromReviews(reviews: CreativeReviewRecord[]): string[] {
  const s = new Set<string>();
  for (const r of reviews) {
    if (r.productName?.trim()) s.add(r.productName.trim());
  }
  return [...s].sort();
}
