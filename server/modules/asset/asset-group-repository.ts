import type { AssetGroup } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE_PATH = path.join(DATA_DIR, "asset-groups.json");

type Store = Record<string, AssetGroup[]>;

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
    console.error("[AssetGroupRepository] Failed to load:", (e as Error).message);
  }
  return {};
}

function saveStore(store: Store): void {
  try {
    ensureDataDir();
    fs.writeFileSync(FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("[AssetGroupRepository] Failed to save:", (e as Error).message);
  }
}

function getList(userId: string): AssetGroup[] {
  const store = loadStore();
  return store[userId] ?? [];
}

function setList(userId: string, list: AssetGroup[]): void {
  const store = loadStore();
  store[userId] = list;
  saveStore(store);
}

export function listByPackageId(userId: string, packageId: string): AssetGroup[] {
  const list = getList(userId).filter((g) => g.packageId === packageId);
  list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  return list;
}

export function getById(userId: string, id: string): AssetGroup | null {
  const list = getList(userId);
  return list.find((g) => g.id === id) ?? null;
}

export function create(userId: string, group: AssetGroup): AssetGroup {
  const list = getList(userId);
  if (list.some((g) => g.id === group.id)) {
    throw new Error("ASSET_GROUP_ID_EXISTS");
  }
  list.push(group);
  setList(userId, list);
  return group;
}

export function update(
  userId: string,
  id: string,
  patch: Partial<Omit<AssetGroup, "id" | "packageId" | "createdAt">>
): AssetGroup | null {
  const list = getList(userId);
  const idx = list.findIndex((g) => g.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    ...patch,
    id: list[idx].id,
    packageId: list[idx].packageId,
    createdAt: list[idx].createdAt,
  };
  setList(userId, list);
  return list[idx];
}

export function remove(userId: string, id: string): boolean {
  const list = getList(userId);
  const next = list.filter((g) => g.id !== id);
  if (next.length === list.length) return false;
  setList(userId, next);
  return true;
}

/** 刪除某素材包底下所有主素材組（刪除素材包時呼叫） */
export function removeByPackageId(userId: string, packageId: string): number {
  const list = getList(userId);
  const next = list.filter((g) => g.packageId !== packageId);
  const removed = list.length - next.length;
  if (removed > 0) setList(userId, next);
  return removed;
}
