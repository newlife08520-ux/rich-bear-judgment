/**
 * 預計算「完整性保護」檢查（非完整持久化成功驗證）：
 * (1) 有 precomputeCompletedAt/computationVersion 的 batch 必有完整兩份 payload；
 * (2) 不會出現「只寫入 version 但 payload 不完整或不存在」的假完成狀態；
 * (3) 不會出現「只有 precomputedActionCenter 或只有 precomputedScorecard」的部分污染狀態。
 * 注意：本腳本不證明「refresh 成功後真的寫入、重啟後真的讀到、API 真的走 precomputed」；那是持久化成功驗證，需配合實跑 refresh + 讀檔/打 API 驗證。
 * 執行：npx tsx script/verify-precompute-persistence.ts
 */
import * as fs from "fs";
import * as path from "path";
import type { AnalysisBatch } from "../shared/schema";

const DATA_DIR = path.join(process.cwd(), ".data");
const BATCH_FILE = path.join(DATA_DIR, "latest-batch.json");

function run(): void {
  console.log("=== 預計算完整性保護檢查 ===\n");

  if (!fs.existsSync(BATCH_FILE)) {
    console.log("未找到 .data/latest-batch.json，無 batch 可驗證。");
    process.exit(0);
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
  const errors: string[] = [];

  for (const [key, batch] of entries) {
    const hasVersion = !!(batch as Record<string, unknown>).precomputeCompletedAt || !!(batch as Record<string, unknown>).computationVersion;
    const hasAc = batch.precomputedActionCenter != null;
    const hasSc = batch.precomputedScorecard != null;

    // 部分污染：不可只有其中一份 payload（refresh 失敗時不應留下半成品）
    if (hasAc && !hasSc) {
      errors.push(`Batch "${key}": 僅有 precomputedActionCenter，缺少 precomputedScorecard（部分污染）`);
    }
    if (!hasAc && hasSc) {
      errors.push(`Batch "${key}": 僅有 precomputedScorecard，缺少 precomputedActionCenter（部分污染）`);
    }

    // 若有 precomputeCompletedAt 或 computationVersion，則兩份 payload 都必須存在且有效
    if (hasVersion) {
      if (!hasAc) {
        errors.push(`Batch "${key}": 有 precomputeCompletedAt/computationVersion 但 precomputedActionCenter 缺失`);
      }
      if (!hasSc) {
        errors.push(`Batch "${key}": 有 precomputeCompletedAt/computationVersion 但 precomputedScorecard 缺失`);
      }
      if (hasAc) {
        const ac = batch.precomputedActionCenter as Record<string, unknown> | undefined;
        const hasProductLevel = Array.isArray(ac?.productLevel);
        const hasBudgetActionTable = Array.isArray(ac?.budgetActionTable);
        if (!hasProductLevel || !hasBudgetActionTable) {
          errors.push(`Batch "${key}": precomputedActionCenter 存在但結構不完整 (productLevel/budgetActionTable)`);
        }
      }
      if (hasSc) {
        const sc = batch.precomputedScorecard as { product?: { items?: unknown[] }; person?: { itemsByBuyer?: unknown[]; itemsByCreative?: unknown[] } } | undefined;
        const hasProduct = Array.isArray(sc?.product?.items);
        const hasPerson = Array.isArray(sc?.person?.itemsByBuyer) && Array.isArray(sc?.person?.itemsByCreative);
        if (!hasProduct || !hasPerson) {
          errors.push(`Batch "${key}": precomputedScorecard 存在但結構不完整 (product.items / person.itemsByBuyer|itemsByCreative)`);
        }
      }
    }

    // 反過來：若有任一份 payload 但沒有 version，屬於舊資料或半成品，不視為錯誤；但若「只有 version 沒有 payload」已在上面檢查。
  }

  if (errors.length > 0) {
    console.error("持久化驗證失敗：");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }

  const withVersion = entries.filter(
    ([_, b]) => !!(b as Record<string, unknown>).precomputeCompletedAt || !!(b as Record<string, unknown>).computationVersion
  );
  console.log(`已檢查 ${entries.length} 個 batch，其中 ${withVersion.length} 個具 precompute 標記且結構完整。`);
  console.log("完整性保護檢查通過：無假完成、無部分污染、無 payload 結構不完整。");
  process.exit(0);
}

run();
