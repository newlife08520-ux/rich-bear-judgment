/**
 * 初審判決儲存：依 campaignId 存初審分數、一句判決、是否建議進測試池、簡短原因
 */
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "initial-verdicts.json");

export interface InitialVerdict {
  score: number;
  summary: string;
  recommendTest: boolean;
  reason: string;
  updatedAt: string;
}

export type InitialVerdictsMap = Record<string, InitialVerdict>;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getInitialVerdicts(): InitialVerdictsMap {
  try {
    if (fs.existsSync(FILE)) {
      return JSON.parse(fs.readFileSync(FILE, "utf-8")) as InitialVerdictsMap;
    }
  } catch (e) {
    console.error("[InitialVerdicts] load failed:", (e as Error).message);
  }
  return {};
}

export function getInitialVerdict(campaignId: string): InitialVerdict | null {
  const map = getInitialVerdicts();
  return map[campaignId] ?? null;
}

export function setInitialVerdict(campaignId: string, verdict: Omit<InitialVerdict, "updatedAt">): void {
  const map = getInitialVerdicts();
  map[campaignId] = {
    ...verdict,
    updatedAt: new Date().toISOString(),
  };
  try {
    ensureDir();
    fs.writeFileSync(FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (e) {
    console.error("[InitialVerdicts] save failed:", (e as Error).message);
    throw e;
  }
}
