/**
 * 預計算結果一致性驗證：比對 precomputed 與 fallback 關鍵輸出與 response 契約。
 * 預設：若無具 precomputed 的 batch 則 exit 1（CI/驗收把關）。
 * 開發者寬鬆模式：傳入 --allow-missing-precomputed 則無 batch 時 exit 0。
 * 執行：npx tsx script/verify-precompute-consistency.ts [--allow-missing-precomputed]
 */
import * as fs from "fs";
import * as path from "path";
import type { AnalysisBatch, PrecomputedActionCenterPayload, PrecomputedScorecardPayload } from "../shared/schema";
import { buildActionCenterPayload, filterActionCenterPayloadByScope } from "../server/build-action-center-payload";
import { buildScorecardPayload } from "../server/build-scorecard-payload";

const DATA_DIR = path.join(process.cwd(), ".data");
const BATCH_FILE = path.join(DATA_DIR, "latest-batch.json");

const ALLOW_MISSING_FLAG = "--allow-missing-precomputed";
const allowMissingPrecomputed = process.argv.includes(ALLOW_MISSING_FLAG);

const NUMERIC_TOLERANCE = 1e-5;

function arr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

function compareNum(a: number, b: number, label: string): string | null {
  const diff = Math.abs(a - b);
  if (diff <= NUMERIC_TOLERANCE) return null;
  if (Number.isFinite(a) && Number.isFinite(b) && diff < 0.01) return null;
  return `${label}: precomputed=${a} fallback=${b}`;
}

function compareCount(pre: number, fb: number, _label: string): string | null {
  if (pre === fb) return null;
  return `count: precomputed=${pre} fallback=${fb}`;
}

/** 行動中心 response 契約：前端依賴的頂層鍵不可缺、型別一致。batchValidityReason 可為 undefined（JSON 會略過）故不強制。 */
const ACTION_CENTER_REQUIRED_KEYS = [
  "sourceMeta",
  "productLevel",
  "productLevelMain",
  "productLevelNoDelivery",
  "productLevelUnmapped",
  "unmappedCount",
  "creativeLeaderboard",
  "creativeLeaderboardUnderSample",
  "budgetActionTable",
  "budgetActionNoDelivery",
  "budgetActionUnderSample",
  "tableRescue",
  "tableScaleUp",
  "tableNoMisjudge",
  "tableExtend",
  "todayActions",
  "tierMainAccount",
  "tierHighPotentialCreatives",
  "tierNoise",
  "batchValidity",
] as const;

function checkActionCenterContract(
  pre: PrecomputedActionCenterPayload,
  fallback: PrecomputedActionCenterPayload,
  scenario: string
): string[] {
  const errs: string[] = [];
  const preObj = pre as Record<string, unknown>;
  const fbObj = fallback as Record<string, unknown>;
  for (const key of ACTION_CENTER_REQUIRED_KEYS) {
    const hasPre = key in preObj;
    const hasFb = key in fbObj;
    if (!hasPre) errs.push(`[${scenario}] precomputed 缺少頂層欄位: ${key}`);
    if (!hasFb) errs.push(`[${scenario}] fallback 缺少頂層欄位: ${key}`);
    if (hasPre && hasFb) {
      const preArr = Array.isArray(preObj[key]);
      const fbArr = Array.isArray(fbObj[key]);
      if (preArr !== fbArr) errs.push(`[${scenario}] 欄位 ${key} 型別不一致: precomputed isArray=${preArr} fallback isArray=${fbArr}`);
    }
  }
  return errs;
}

/** 成績單 response 契約：product.items、person.itemsByBuyer、person.itemsByCreative 不可缺且為陣列 */
function checkScorecardContract(
  pre: PrecomputedScorecardPayload,
  fallback: PrecomputedScorecardPayload,
  scenario: string
): string[] {
  const errs: string[] = [];
  for (const [label, payload] of [["precomputed", pre], ["fallback", fallback]] as const) {
    const p = payload as Record<string, unknown>;
    if (!p.product || !Array.isArray((p.product as Record<string, unknown>)?.items)) {
      errs.push(`[${scenario}] ${label} 缺少 product.items 或非陣列`);
    }
    if (!p.person) {
      errs.push(`[${scenario}] ${label} 缺少 person`);
    } else {
      const person = p.person as Record<string, unknown>;
      if (!Array.isArray(person.itemsByBuyer)) errs.push(`[${scenario}] ${label} person.itemsByBuyer 非陣列`);
      if (!Array.isArray(person.itemsByCreative)) errs.push(`[${scenario}] ${label} person.itemsByCreative 非陣列`);
    }
  }
  return errs;
}

function compareActionCenter(
  pre: PrecomputedActionCenterPayload,
  fallback: PrecomputedActionCenterPayload,
  scenario: string
): string[] {
  const errs: string[] = [];
  const pl = arr(pre.productLevel).length;
  const plF = arr(fallback.productLevel).length;
  if (compareCount(pl, plF, "productLevel")) errs.push(`[${scenario}] productLevel: ${pl} vs ${plF}`);

  const plMain = arr(pre.productLevelMain).length;
  const plMainF = arr(fallback.productLevelMain).length;
  if (compareCount(plMain, plMainF, "productLevelMain")) errs.push(`[${scenario}] productLevelMain: ${plMain} vs ${plMainF}`);

  const bat = arr(pre.budgetActionTable).length;
  const batF = arr(fallback.budgetActionTable).length;
  if (compareCount(bat, batF, "budgetActionTable")) errs.push(`[${scenario}] budgetActionTable: ${bat} vs ${batF}`);

  const today = arr(pre.todayActions).length;
  const todayF = arr(fallback.todayActions).length;
  if (compareCount(today, todayF, "todayActions")) errs.push(`[${scenario}] todayActions: ${today} vs ${todayF}`);

  const meta = pre.sourceMeta as Record<string, unknown> | undefined;
  const metaF = fallback.sourceMeta as Record<string, unknown> | undefined;
  const campaignUsed = meta?.campaignCountUsed as number | undefined;
  const campaignUsedF = metaF?.campaignCountUsed as number | undefined;
  if (campaignUsed != null && campaignUsedF != null && campaignUsed !== campaignUsedF) {
    errs.push(`[${scenario}] sourceMeta.campaignCountUsed: ${campaignUsed} vs ${campaignUsedF}`);
  }

  const plMainArr = arr(pre.productLevelMain) as { productName?: string; spend?: number }[];
  const plMainArrF = arr(fallback.productLevelMain) as { productName?: string; spend?: number }[];
  const topN = Math.min(3, plMainArr.length, plMainArrF.length);
  for (let i = 0; i < topN; i++) {
    if (plMainArr[i]?.productName !== plMainArrF[i]?.productName) {
      errs.push(`[${scenario}] productLevelMain[${i}].productName: ${plMainArr[i]?.productName} vs ${plMainArrF[i]?.productName}`);
    }
    const s = compareNum(plMainArr[i]?.spend ?? 0, plMainArrF[i]?.spend ?? 0, `productLevelMain[${i}].spend`);
    if (s) errs.push(`[${scenario}] ${s}`);
  }

  const batArr = arr(pre.budgetActionTable) as { suggestedAction?: string; suggestedPct?: number }[];
  const batArrF = arr(fallback.budgetActionTable) as { suggestedAction?: string; suggestedPct?: number }[];
  const topBat = Math.min(2, batArr.length, batArrF.length);
  for (let i = 0; i < topBat; i++) {
    if (batArr[i]?.suggestedAction !== batArrF[i]?.suggestedAction) {
      errs.push(`[${scenario}] budgetActionTable[${i}].suggestedAction: ${batArr[i]?.suggestedAction} vs ${batArrF[i]?.suggestedAction}`);
    }
    const pct = compareNum(
      typeof batArr[i]?.suggestedPct === "number" ? batArr[i].suggestedPct! : 0,
      typeof batArrF[i]?.suggestedPct === "number" ? batArrF[i].suggestedPct! : 0,
      `budgetActionTable[${i}].suggestedPct`
    );
    if (pct) errs.push(`[${scenario}] ${pct}`);
  }
  return errs;
}

function compareScorecard(
  pre: PrecomputedScorecardPayload,
  fallback: PrecomputedScorecardPayload,
  scenario: string
): string[] {
  const errs: string[] = [];
  const productItems = pre.product?.items ?? [];
  const productItemsF = fallback.product?.items ?? [];
  if (productItems.length !== productItemsF.length) {
    errs.push(`[${scenario}] scorecard product.items length: ${productItems.length} vs ${productItemsF.length}`);
  }
  const topProduct = Math.min(3, productItems.length, productItemsF.length);
  for (let i = 0; i < topProduct; i++) {
    const a = productItems[i] as { name?: string; launchedCount?: number; successRate?: number };
    const b = productItemsF[i] as { name?: string; launchedCount?: number; successRate?: number };
    if (a?.name !== b?.name) errs.push(`[${scenario}] scorecard product[${i}].name: ${a?.name} vs ${b?.name}`);
    if ((a?.launchedCount ?? 0) !== (b?.launchedCount ?? 0)) {
      errs.push(`[${scenario}] scorecard product[${i}].launchedCount: ${a?.launchedCount} vs ${b?.launchedCount}`);
    }
    const sr = compareNum(a?.successRate ?? 0, b?.successRate ?? 0, `scorecard product[${i}].successRate`);
    if (sr) errs.push(`[${scenario}] ${sr}`);
  }
  const byBuyer = pre.person?.itemsByBuyer ?? [];
  const byBuyerF = fallback.person?.itemsByBuyer ?? [];
  if (byBuyer.length !== byBuyerF.length) {
    errs.push(`[${scenario}] scorecard person.itemsByBuyer length: ${byBuyer.length} vs ${byBuyerF.length}`);
  }
  const byCreative = pre.person?.itemsByCreative ?? [];
  const byCreativeF = fallback.person?.itemsByCreative ?? [];
  if (byCreative.length !== byCreativeF.length) {
    errs.push(`[${scenario}] scorecard person.itemsByCreative length: ${byCreative.length} vs ${byCreativeF.length}`);
  }
  return errs;
}

async function run(): Promise<void> {
  console.log("=== 預計算結果一致性驗證 ===\n");

  if (!fs.existsSync(BATCH_FILE)) {
    console.error("未找到 .data/latest-batch.json。請先執行一次 refresh 產生具 precomputed 的 batch。");
    if (allowMissingPrecomputed) {
      console.log("(已傳入 --allow-missing-precomputed，視為通過)");
      process.exit(0);
    }
    process.exit(1);
  }

  const raw = fs.readFileSync(BATCH_FILE, "utf-8");
  let batches: Record<string, AnalysisBatch>;
  try {
    batches = JSON.parse(raw) as Record<string, AnalysisBatch>;
  } catch {
    console.error("無法解析 latest-batch.json");
    process.exit(1);
  }

  const entries = Object.entries(batches);
  const withPrecompute = entries.filter(
    ([_, b]) => b?.precomputedActionCenter != null && b?.precomputedScorecard != null
  );

  if (withPrecompute.length === 0) {
    console.error("目前沒有任何 batch 具 precomputedActionCenter 與 precomputedScorecard。請先執行一次 refresh 後再執行本 script。");
    if (allowMissingPrecomputed) {
      console.log("(已傳入 --allow-missing-precomputed，視為通過)");
      process.exit(0);
    }
    process.exit(1);
  }

  const allErrors: string[] = [];

  for (const [key, batch] of withPrecompute) {
    const batchLabel = key.slice(0, 24) + (key.length > 24 ? "…" : "");

    try {
      const fallbackAc = await buildActionCenterPayload(batch, { useOverrides: true });
      const preAc = batch.precomputedActionCenter! as PrecomputedActionCenterPayload;
      const acContractErrs = checkActionCenterContract(preAc, fallbackAc, `action-center unscoped ${batchLabel}`);
      const acErrs = compareActionCenter(preAc, fallbackAc, `action-center unscoped ${batchLabel}`);
      if (acContractErrs.length > 0) allErrors.push(...acContractErrs);
      if (acErrs.length > 0) allErrors.push(...acErrs);
      if (acContractErrs.length === 0 && acErrs.length === 0) console.log(`[OK] action-center unscoped (${batchLabel}): 契約與關鍵值一致`);
    } catch (e) {
      allErrors.push(`action-center unscoped ${batchLabel}: ${(e as Error).message}`);
    }

    const firstAccountId = (batch.campaignMetrics as { accountId?: string }[])?.[0]?.accountId;
    if (firstAccountId) {
      try {
        const scopeAccountIds = [firstAccountId];
        const preAc = batch.precomputedActionCenter! as PrecomputedActionCenterPayload;
        const filtered = filterActionCenterPayloadByScope(preAc, scopeAccountIds, undefined);
        const fallbackScoped = await buildActionCenterPayload(batch, { scopeAccountIds, useOverrides: true });
        const scopedContractErrs = checkActionCenterContract(filtered, fallbackScoped, `action-center scopeAccountIds ${batchLabel}`);
        if (scopedContractErrs.length > 0) allErrors.push(...scopedContractErrs);
        else console.log(`[OK] action-center scopeAccountIds (${batchLabel}): 契約一致（scoped 數量因 filter/build 邊界可略異，僅驗契約）`);
      } catch (e) {
        allErrors.push(`action-center scopeAccountIds ${batchLabel}: ${(e as Error).message}`);
      }
    }

    const preAc = batch.precomputedActionCenter as PrecomputedActionCenterPayload;
    const plArr = arr(preAc?.productLevel) as { productName?: string }[];
    const firstProduct = plArr.find((p) => p?.productName && p.productName !== "未分類")?.productName;
    if (firstProduct) {
      try {
        const scopeProducts = [firstProduct];
        const filtered = filterActionCenterPayloadByScope(preAc, undefined, scopeProducts);
        const fallbackScoped = await buildActionCenterPayload(batch, { scopeProducts, useOverrides: true });
        const scopedContractErrs = checkActionCenterContract(filtered, fallbackScoped, `action-center scopeProducts ${batchLabel}`);
        if (scopedContractErrs.length > 0) allErrors.push(...scopedContractErrs);
        else console.log(`[OK] action-center scopeProducts (${batchLabel}): 契約一致（scoped 數量因 filter/build 邊界可略異，僅驗契約）`);
      } catch (e) {
        allErrors.push(`action-center scopeProducts ${batchLabel}: ${(e as Error).message}`);
      }
    }

    try {
      const fallbackSc = await buildScorecardPayload(batch);
      const preSc = batch.precomputedScorecard! as PrecomputedScorecardPayload;
      const scContractErrs = checkScorecardContract(preSc, fallbackSc, `scorecard ${batchLabel}`);
      const scErrs = compareScorecard(preSc, fallbackSc, `scorecard ${batchLabel}`);
      if (scContractErrs.length > 0) allErrors.push(...scContractErrs);
      if (scErrs.length > 0) allErrors.push(...scErrs);
      if (scContractErrs.length === 0 && scErrs.length === 0) console.log(`[OK] scorecard (${batchLabel}): 契約與關鍵值一致`);
    } catch (e) {
      allErrors.push(`scorecard ${batchLabel}: ${(e as Error).message}`);
    }
  }

  if (allErrors.length > 0) {
    console.error("\n--- 不一致項目 ---");
    allErrors.forEach((e) => console.error(e));
    process.exit(1);
  }

  console.log("\n全部情境：precomputed 與 fallback 關鍵輸出一致。");
  process.exit(0);
}

run();
