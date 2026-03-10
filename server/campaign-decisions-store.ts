/**
 * 第一次決策點寫回：依 campaignId 存 開/拉高/維持/關閉/進延伸池，供成功率頁與團隊追蹤讀取
 */
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "campaign-decisions.json");

export type DecisionAction = "開" | "拉高" | "維持" | "關閉" | "進延伸池";

export interface CampaignDecision {
  decision: DecisionAction;
  updatedAt: string;
}

export type CampaignDecisionsMap = Record<string, CampaignDecision>;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getCampaignDecisions(): CampaignDecisionsMap {
  try {
    if (fs.existsSync(FILE)) {
      return JSON.parse(fs.readFileSync(FILE, "utf-8")) as CampaignDecisionsMap;
    }
  } catch (e) {
    console.error("[CampaignDecisions] load failed:", (e as Error).message);
  }
  return {};
}

export function getCampaignDecision(campaignId: string): CampaignDecision | null {
  const map = getCampaignDecisions();
  return map[campaignId] ?? null;
}

export function setCampaignDecision(campaignId: string, decision: DecisionAction): void {
  const map = getCampaignDecisions();
  map[campaignId] = {
    decision,
    updatedAt: new Date().toISOString(),
  };
  try {
    ensureDir();
    fs.writeFileSync(FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (e) {
    console.error("[CampaignDecisions] save failed:", (e as Error).message);
    throw e;
  }
}
