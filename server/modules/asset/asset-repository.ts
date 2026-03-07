import type { Asset } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const ASSETS_FILE = path.join(DATA_DIR, "assets.json");

/** 檔案結構：依 userId 隔離 */
type AssetsStore = Record<string, Asset[]>;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): AssetsStore {
  try {
    if (fs.existsSync(ASSETS_FILE)) {
      return JSON.parse(fs.readFileSync(ASSETS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[AssetRepository] Failed to load:", (e as Error).message);
  }
  return {};
}

function saveStore(store: AssetsStore): void {
  try {
    ensureDataDir();
    fs.writeFileSync(ASSETS_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("[AssetRepository] Failed to save:", (e as Error).message);
  }
}

function getList(userId: string): Asset[] {
  const store = loadStore();
  return store[userId] ?? [];
}

function setList(userId: string, list: Asset[]): void {
  const store = loadStore();
  store[userId] = list;
  saveStore(store);
}

export function listByUserId(userId: string): Asset[] {
  return getList(userId);
}

export function getById(userId: string, id: string): Asset | null {
  const list = getList(userId);
  return list.find((a) => a.id === id) ?? null;
}

export function create(userId: string, asset: Asset): Asset {
  const list = getList(userId);
  if (list.some((a) => a.id === asset.id)) {
    throw new Error("ASSET_ID_EXISTS");
  }
  list.push(asset);
  setList(userId, list);
  return asset;
}

export function update(userId: string, id: string, patch: Partial<Omit<Asset, "id" | "userId" | "createdAt">>): Asset | null {
  const list = getList(userId);
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, id: list[idx].id, userId, createdAt: list[idx].createdAt };
  setList(userId, list);
  return list[idx];
}

export function remove(userId: string, id: string): boolean {
  const list = getList(userId);
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  setList(userId, next);
  return true;
}
