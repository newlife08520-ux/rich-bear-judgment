/**
 * 6.2-C：由 DB review tags + outcome snapshots 做第一版模式彙總（可再 hydrate 快照）。
 * 6.4-C：snapshot 歸因防呆（ambiguousAttribution）；6.5-B：workbench 擴充欄位。
 */
import { prisma } from "../../db";
import { getCreativeReviewQueueStats } from "./creative-review-job-prisma";
import {
  buildHiddenDiamondEvidenceList,
  buildTagFamilyWorkbench,
  listProductNamesFromReviews,
} from "./creative-patterns-workbench";

function countTags(rows: { tagType: string; tagValue: string; lifecycleLabel?: string | null }[]) {
  const win = new Map<string, number>();
  const lose = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.tagType}:${r.tagValue}`;
    /** 7.8：LUCKY／WATCH 不當 pattern 贏家側；HIDDEN_DIAMOND／WINNER／UNDERFUNDED_GOOD 可計入 */
    const lab = r.lifecycleLabel ?? "";
    const isWin =
      lab !== "LUCKY" &&
      lab !== "WATCH" &&
      (lab === "WINNER" || lab === "UNDERFUNDED_GOOD" || lab === "HIDDEN_DIAMOND");
    const isLose = lab === "RETIRED" || lab === "LOSING";
    if (isWin) win.set(k, (win.get(k) ?? 0) + 1);
    if (isLose) lose.set(k, (lose.get(k) ?? 0) + 1);
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([tag, count]) => ({ tag, count }));
  return { hookWinners: top(win, 10), hookLosers: top(lose, 10) };
}

const EMPTY_FORMAT_SUMMARY: {
  hook: { tag: string; count: number }[];
  pain: string[];
  proof: string[];
  cta: string[];
  format: string[];
  angle: string[];
  scene: string[];
  visual_motif: string[];
  pacing_motif: string[];
  visual: string[];
  pacing: string[];
} = {
  hook: [],
  pain: [],
  proof: [],
  cta: [],
  format: [],
  angle: [],
  scene: [],
  visual_motif: [],
  pacing_motif: [],
  visual: [],
  pacing: [],
};

/** DB／schema 異常時仍回 200，避免 reviewer 看到「整包 500」而失信任 */
export async function buildDegradedCreativePatternsPayload(userId: string, reason: string) {
  let reviewQueue = {
    queued: 0,
    processing: 0,
    failed: 0,
    succeeded: 0,
    pending: 0,
    running: 0,
    completed: 0,
  };
  try {
    reviewQueue = await getCreativeReviewQueueStats(userId);
  } catch {
    /* ignore */
  }
  const { tagFamilies, tagFamilyOrder } = buildTagFamilyWorkbench({
    tags: [],
    reviews: [],
    versionLatest: new Map(),
  });
  return {
    generatedAt: new Date().toISOString(),
    patternTaxonomyVersion: "7.9-phase4",
    hookTopWinners: [] as { tag: string; count: number }[],
    hookTopLosers: [] as { tag: string; count: number }[],
    productWinningPatterns: {} as Record<string, { tag: string; count: number }[]>,
    productLosingHooks: {} as Record<string, { tag: string; count: number }[]>,
    formatSummary: EMPTY_FORMAT_SUMMARY,
    losingMotifs: [] as { tag: string; count: number }[],
    hiddenDiamondVersionIds: [] as string[],
    luckyVersionIds: [] as string[],
    ambiguousSnapshotCount: 0,
    snapshotCount: 0,
    reviewCount: 0,
    reviewQueue,
    attributionNote:
      "Experiment link：僅 isPrimary 且 isActive 的連結會優先承載 Meta campaign 歸因；多版本同 campaign 時 snapshot 標為 ambiguous。",
    tagFamilies,
    tagFamilyOrder,
    hiddenDiamondEvidence: [] as ReturnType<typeof buildHiddenDiamondEvidenceList>,
    workbenchProducts: [] as string[],
    degraded: true as const,
    degradedReason: reason.slice(0, 500),
  };
}

export async function buildCreativePatternsPayload(userId: string) {
  const reviews = await prisma.creativeReviewRecord.findMany({
    where: { userId, reviewStatus: "completed" },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const reviewIds = reviews.map((r) => r.id);
  const tags = await prisma.creativePatternTag.findMany({
    where: { creativeReviewId: { in: reviewIds } },
  });
  const snapshots = await prisma.creativeOutcomeSnapshot.findMany({
    where: { userId },
    orderBy: { snapshotDate: "desc" },
    take: 800,
  });

  const versionLatest = new Map<string, (typeof snapshots)[0]>();
  for (const s of snapshots) {
    if (!versionLatest.has(s.assetVersionId)) versionLatest.set(s.assetVersionId, s);
  }

  const tagRows = tags.map((t) => {
    const rev = reviews.find((r) => r.id === t.creativeReviewId);
    const snap = rev ? versionLatest.get(rev.assetVersionId) : undefined;
    const ok = snap && !snap.ambiguousAttribution;
    return {
      tagType: t.tagType,
      tagValue: t.tagValue,
      lifecycleLabel: ok ? snap!.lifecycleLabel : undefined,
    };
  });

  const { hookWinners, hookLosers } = countTags(tagRows);

  const snapOk = (s: (typeof snapshots)[0]) => !s.ambiguousAttribution;

  const hiddenDiamond = snapshots.filter(
    (s) => snapOk(s) && ((s.qualityScore ?? 0) >= 70 || (s.roas >= 2.5 && s.spend < 300))
  );
  const lucky = snapshots.filter(
    (s) => snapOk(s) && s.spend < 150 && s.roas >= 2.5 && s.purchases < 3
  );

  const losingMotifs = hookLosers.slice(0, 12);

  const byProduct = new Map<string, { tag: string; count: number }[]>();
  for (const r of reviews) {
    if (!r.productName) continue;
    const subTags = tags.filter((t) => t.creativeReviewId === r.id && t.tagType === "hook");
    if (!byProduct.has(r.productName)) byProduct.set(r.productName, []);
    for (const st of subTags) {
      const arr = byProduct.get(r.productName)!;
      const ex = arr.find((x) => x.tag === `hook:${st.tagValue}`);
      if (ex) ex.count += 1;
      else arr.push({ tag: `hook:${st.tagValue}`, count: 1 });
    }
  }

  const productWinningPatterns = Object.fromEntries(
    [...byProduct.entries()].map(([k, v]) => [k, v.sort((a, b) => b.count - a.count).slice(0, 8)])
  );

  const productLosingHooks: Record<string, { tag: string; count: number }[]> = {};
  for (const productName of byProduct.keys()) {
    const m = new Map<string, number>();
    for (const t of tags.filter((x) => x.tagType === "hook")) {
      const rev = reviews.find((rr) => rr.id === t.creativeReviewId);
      if (rev?.productName !== productName) continue;
      const snap = versionLatest.get(rev.assetVersionId);
      if (!snap || snap.ambiguousAttribution) continue;
      if (snap.lifecycleLabel !== "LOSING" && snap.lifecycleLabel !== "RETIRED") continue;
      const k = `hook:${t.tagValue}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    productLosingHooks[productName] = [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));
  }

  const tagSlice = (type: string, n: number) =>
    tags
      .filter((t) => t.tagType === type)
      .slice(0, n)
      .map((t) => `${t.tagType}:${t.tagValue}`);
  const formatSummary = {
    hook: hookWinners.filter((x) => x.tag.startsWith("hook:")).slice(0, 5),
    pain: tagSlice("pain", 12),
    proof: tagSlice("proof", 12),
    cta: tagSlice("cta", 15),
    format: tagSlice("format", 20),
    angle: tagSlice("angle", 12),
    scene: tagSlice("scene", 12),
    visual_motif: tagSlice("visual_motif", 12),
    pacing_motif: tagSlice("pacing_motif", 12),
    visual: tagSlice("visual", 10),
    pacing: tagSlice("pacing", 10),
  };

  const reviewQueue = await getCreativeReviewQueueStats(userId);

  const { tagFamilies, tagFamilyOrder } = buildTagFamilyWorkbench({ tags, reviews, versionLatest });
  const hiddenDiamondEvidence = buildHiddenDiamondEvidenceList(snapshots);
  const workbenchProducts = listProductNamesFromReviews(reviews);

  return {
    generatedAt: new Date().toISOString(),
    patternTaxonomyVersion: "7.9-phase4",
    hookTopWinners: hookWinners,
    hookTopLosers: hookLosers,
    productWinningPatterns,
    productLosingHooks,
    formatSummary,
    losingMotifs,
    hiddenDiamondVersionIds: [...new Set(hiddenDiamond.map((s) => s.assetVersionId))].slice(0, 30),
    luckyVersionIds: [...new Set(lucky.map((s) => s.assetVersionId))].slice(0, 30),
    ambiguousSnapshotCount: snapshots.filter((s) => s.ambiguousAttribution).length,
    snapshotCount: snapshots.length,
    reviewCount: reviews.length,
    reviewQueue,
    attributionNote:
      "Experiment link：僅 isPrimary 且 isActive 的連結會優先承載 Meta campaign 歸因；多版本同 campaign 時 snapshot 標為 ambiguous。",
    tagFamilies,
    tagFamilyOrder,
    hiddenDiamondEvidence,
    workbenchProducts,
  };
}

export async function syncOutcomeSnapshotsFromBatch(params: {
  userId: string;
  campaignMetrics: Array<{
    campaignId: string;
    spend: number;
    revenue: number;
    roas: number;
    clicks: number;
    conversions: number;
    addToCart?: number;
  }>;
}) {
  const campIds = [...new Set(params.campaignMetrics.map((c) => c.campaignId).filter(Boolean))];
  const links = await prisma.creativeExperimentLink.findMany({
    where: { userId: params.userId, campaignId: { in: campIds } },
  });
  const byCamp = new Map(params.campaignMetrics.map((c) => [c.campaignId, c]));
  const now = new Date();
  let n = 0;

  const byCampaignId = new Map<string, typeof links>();
  for (const link of links) {
    if (!link.campaignId) continue;
    const arr = byCampaignId.get(link.campaignId) ?? [];
    arr.push(link);
    byCampaignId.set(link.campaignId, arr);
  }

  for (const [campaignId, group] of byCampaignId) {
    const m = byCamp.get(campaignId);
    if (!m) continue;
    const sorted = [...group].sort((a, b) => a.linkedAt.getTime() - b.linkedAt.getTime());
    const activeLifecycle = sorted.filter((l) => l.isActive && l.linkLifecycleState === "active");
    const primaries = activeLifecycle.filter((l) => l.isPrimary);
    /** 7.3：多 active link、非唯一 primary、或 stale／superseded 仍帶同 campaign 與現行窗口重疊 */
    const staleOverlap =
      activeLifecycle.length > 0 &&
      sorted.some(
        (l) =>
          l.campaignId === campaignId &&
          (!l.isActive || l.linkLifecycleState !== "active")
      );
    const ambiguous =
      activeLifecycle.length > 1 || primaries.length !== 1 || staleOverlap;
    const primaryLink = primaries[0] ?? activeLifecycle[0] ?? sorted[0]!;

    let lifecycleLabel = "WATCH";
    if (m.spend < 120 && m.roas >= 2.5) lifecycleLabel = "UNDERFUNDED_GOOD";
    else if (m.spend < 100 && m.roas >= 3) lifecycleLabel = "HIDDEN_DIAMOND";
    else if (m.spend < 150 && m.roas >= 2.8 && m.conversions < 3) lifecycleLabel = "LUCKY";
    else if (m.roas < 1 && m.spend > 400) lifecycleLabel = "LOSING";
    else if (m.roas >= 2.2 && m.spend >= 500) lifecycleLabel = "WINNER";

    await prisma.creativeOutcomeSnapshot.create({
      data: {
        userId: params.userId,
        assetVersionId: primaryLink.assetVersionId,
        campaignId,
        productName: primaryLink.productName,
        spend: m.spend,
        revenue: m.revenue,
        roas: m.roas,
        clicks: Math.round(m.clicks),
        addToCart: Math.round(m.addToCart ?? 0),
        purchases: Math.round(m.conversions),
        confidenceLevel: ambiguous ? "low" : primaries.length === 1 ? "medium" : "low",
        lifecycleLabel,
        qualityScore: null,
        ambiguousAttribution: ambiguous,
        evidenceJson: JSON.stringify({
          source: "batch_sync",
          linkId: primaryLink.id,
          linkedVersionCount: group.length,
          activeLifecycleCount: activeLifecycle.length,
          staleOverlap,
        }),
        snapshotDate: now,
      },
    });
    n += 1;
  }
  return { created: n };
}
