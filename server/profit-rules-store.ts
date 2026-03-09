/**
 * 獲利規則中心：依商品名稱儲存成本比、目標淨利率、樣本門檻
 */
import * as fs from "fs";
import * as path from "path";
import type { ProductProfitRule } from "@shared/schema";
import { DEFAULT_PROFIT_RULE } from "@shared/schema";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "product-profit-rules.json");

export type ProductProfitRulesMap = Record<string, ProductProfitRule>;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getProductProfitRules(): ProductProfitRulesMap {
  try {
    if (fs.existsSync(FILE)) {
      return JSON.parse(fs.readFileSync(FILE, "utf-8")) as ProductProfitRulesMap;
    }
  } catch (e) {
    console.error("[ProfitRules] load failed:", (e as Error).message);
  }
  return {};
}

export function getProductProfitRule(productName: string): ProductProfitRule {
  const map = getProductProfitRules();
  return map[productName] ?? { ...DEFAULT_PROFIT_RULE };
}

export function saveProductProfitRules(map: ProductProfitRulesMap): void {
  try {
    ensureDir();
    fs.writeFileSync(FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (e) {
    console.error("[ProfitRules] save failed:", (e as Error).message);
    throw e;
  }
}

export function setProductProfitRule(productName: string, rule: Partial<ProductProfitRule>): ProductProfitRule {
  const map = getProductProfitRules();
  const current = map[productName] ?? { ...DEFAULT_PROFIT_RULE };
  const next: ProductProfitRule = {
    costRatio: rule.costRatio ?? current.costRatio,
    targetNetMargin: rule.targetNetMargin ?? current.targetNetMargin,
    minSpend: rule.minSpend ?? current.minSpend,
    minClicks: rule.minClicks ?? current.minClicks,
    minATC: rule.minATC ?? current.minATC,
    minPurchases: rule.minPurchases ?? current.minPurchases,
  };
  map[productName] = next;
  saveProductProfitRules(map);
  return next;
}
