/**
 * 對 .data/latest-batch.json 內既有 batch 補上 precomputedActionCenter / precomputedScorecard（與 refresh 同邏輯）。
 * 用於在無法執行完整 refresh 時仍能產生具預計算的 batch，供 verify:precompute 與 headers 驗證。
 * 執行：npx tsx script/backfill-precompute.ts
 */
import * as fs from "fs";
import * as path from "path";
import type { AnalysisBatch } from "../shared/schema";
import { BATCH_COMPUTATION_VERSION } from "../shared/schema";
import { buildActionCenterPayload } from "../server/build-action-center-payload";
import { buildScorecardPayload } from "../server/build-scorecard-payload";

const DATA_DIR = path.join(process.cwd(), ".data");
const BATCH_FILE = path.join(DATA_DIR, "latest-batch.json");

async function main(): Promise<void> {
  if (!fs.existsSync(BATCH_FILE)) {
    console.error("未找到 .data/latest-batch.json");
    process.exit(1);
  }
  const raw = fs.readFileSync(BATCH_FILE, "utf-8");
  const batches = JSON.parse(raw) as Record<string, AnalysisBatch>;
  let updated = 0;
  for (const [key, batch] of Object.entries(batches)) {
    if (!batch?.campaignMetrics?.length) continue;
    try {
      const nextActionCenter = await buildActionCenterPayload(batch, { useOverrides: true });
      const nextScorecard = await buildScorecardPayload(batch);
      batch.precomputedActionCenter = nextActionCenter;
      batch.precomputedScorecard = nextScorecard;
      batch.precomputeCompletedAt = new Date().toISOString();
      batch.computationVersion = BATCH_COMPUTATION_VERSION;
      updated++;
      console.log(`Backfilled precompute for batch: ${key.slice(0, 40)}...`);
    } catch (e) {
      console.warn(`Skip batch ${key}: ${(e as Error).message}`);
    }
  }
  const firstPrecomputedKey = Object.entries(batches).find(
    ([_, b]) => b?.precomputedActionCenter != null && b?.precomputedScorecard != null
  )?.[0];
  if (firstPrecomputedKey) {
    const uid = (batches[firstPrecomputedKey] as AnalysisBatch).userId;
    if (uid) (batches as Record<string, AnalysisBatch>)[uid] = batches[firstPrecomputedKey] as AnalysisBatch;
  }
  if (updated > 0) {
    fs.writeFileSync(BATCH_FILE, JSON.stringify(batches, null, 2), "utf-8");
    console.log(`已寫回 ${BATCH_FILE}，共 ${updated} 個 batch 具預計算。`);
  } else if (firstPrecomputedKey) {
    fs.writeFileSync(BATCH_FILE, JSON.stringify(batches, null, 2), "utf-8");
    console.log(`已寫回 ${BATCH_FILE}（補上 userId 鍵供 getLatestBatch(userId) 使用）。`);
  } else {
    console.log("無需 backfill（無具 campaignMetrics 的 batch 或全部已具預計算）。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
