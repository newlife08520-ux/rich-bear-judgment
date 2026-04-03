/**
 * 驗收：AI 契約統一 — parseStructuredJudgmentFromResponse 與 gemini 同一套 extract + schema。
 * 依 cursor_acceptance_gap_closure 清單 Step 4.1。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function main() {
  let failed = 0;

  const extractPath = "server/lib/extract-json.ts";
  if (!fs.existsSync(path.join(root, extractPath))) {
    console.error("[FAIL] shared extract missing:", extractPath);
    failed++;
  } else {
    console.log("[OK] shared extract exists:", extractPath);
  }

  const parsePath = path.join(root, "server/parse-structured-judgment.ts");
  const parseContent = fs.readFileSync(parsePath, "utf-8");
  if (!parseContent.includes('from "./lib/extract-json"') && !parseContent.includes("from './lib/extract-json'")) {
    console.error("[FAIL] parse-structured-judgment must import extractJsonFromText from server/lib/extract-json");
    failed++;
  } else {
    console.log("[OK] parse-structured-judgment uses extract from lib/extract-json");
  }
  if (!parseContent.includes("StructuredJudgmentSchema")) {
    console.error("[FAIL] parse-structured-judgment must use StructuredJudgmentSchema for validation");
    failed++;
  } else {
    console.log("[OK] parse-structured-judgment uses StructuredJudgmentSchema");
  }

  const geminiPath = path.join(root, "server/gemini.ts");
  const geminiContent = fs.readFileSync(geminiPath, "utf-8");
  if (!geminiContent.includes("extractJsonFromText") || !geminiContent.includes("extract-json")) {
    console.error("[FAIL] gemini must import and use extractJsonFromText from lib/extract-json");
    failed++;
  } else {
    console.log("[OK] gemini uses extract from lib/extract-json");
  }

  const schemaPath = path.join(root, "server/gemini-response-schema.ts");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  if (!schemaContent.includes("StructuredJudgmentSchema")) {
    console.error("[FAIL] gemini-response-schema must export StructuredJudgmentSchema");
    failed++;
  } else {
    console.log("[OK] StructuredJudgmentSchema defined in gemini-response-schema");
  }

  console.log("\n[verify-ai-contract-unification] failed:", failed);
  process.exit(failed > 0 ? 1 : 0);
}

main();
