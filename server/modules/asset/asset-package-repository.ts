import type { AssetPackage } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE_PATH = path.join(DATA_DIR, "asset-packages.json");

type Store = Record<string, AssetPackage[]>;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): Store {
  try {
    if (fs.existsSync(FILE_PATH)) {
      return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("[AssetPackageRepository] Failed to load:", (e as Error).message);
  }
  return {};
}

function saveStore(store: Store): void {
  try {
    ensureDataDir();
    fs.writeFileSync(FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("[AssetPackageRepository] Failed to save:", (e as Error).message);
  }
}

function getList(userId: string): AssetPackage[] {
  const store = loadStore();
  return store[userId] ?? [];
}

function setList(userId: string, list: AssetPackage[]): void {
  const store = loadStore();
  store[userId] = list;
  saveStore(store);
}

export function listByUserId(userId: string): AssetPackage[] {
  return getList(userId);
}

export function getById(userId: string, id: string): AssetPackage | null {
  const list = getList(userId);
  return list.find((p) => p.id === id) ?? null;
}

export function create(userId: string, pkg: AssetPackage): AssetPackage {
  const list = getList(userId);
  if (list.some((p) => p.id === pkg.id)) {
    throw new Error("ASSET_PACKAGE_ID_EXISTS");
  }
  list.push(pkg);
  setList(userId, list);
  return pkg;
}

export function update(
  userId: string,
  id: string,
  patch: Partial<Omit<AssetPackage, "id" | "userId" | "createdAt">>
): AssetPackage | null {
  const list = getList(userId);
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    ...patch,
    id: list[idx].id,
    userId,
    createdAt: list[idx].createdAt,
  };
  setList(userId, list);
  return list[idx];
}

export function remove(userId: string, id: string): boolean {
  const list = getList(userId);
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) return false;
  setList(userId, next);
  return true;
}
