import type { AssetVersion } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE_PATH = path.join(DATA_DIR, "asset-versions.json");

/** 依 userId 隔離：版本隸屬使用者的某個 package，查詢時一律帶 userId 以確保權限 */
type Store = Record<string, AssetVersion[]>;

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
    console.error("[AssetVersionRepository] Failed to load:", (e as Error).message);
  }
  return {};
}

function saveStore(store: Store): void {
  try {
    ensureDataDir();
    fs.writeFileSync(FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("[AssetVersionRepository] Failed to save:", (e as Error).message);
  }
}

function getList(userId: string): AssetVersion[] {
  const store = loadStore();
  return store[userId] ?? [];
}

function setList(userId: string, list: AssetVersion[]): void {
  const store = loadStore();
  store[userId] = list;
  saveStore(store);
}

export function listByUserId(userId: string): AssetVersion[] {
  return getList(userId);
}

export function listByPackageId(userId: string, packageId: string): AssetVersion[] {
  return getList(userId).filter((v) => v.packageId === packageId);
}

export function getById(userId: string, id: string): AssetVersion | null {
  const list = getList(userId);
  return list.find((v) => v.id === id) ?? null;
}

/** 依 fileUrl 查詢版本，供 GET /api/uploads 解析用哪個 provider 讀檔 */
export function getByUserIdAndFileUrl(userId: string, fileUrl: string): AssetVersion | null {
  const list = getList(userId);
  return list.find((v) => v.fileUrl === fileUrl) ?? null;
}

export function create(userId: string, version: AssetVersion): AssetVersion {
  const list = getList(userId);
  if (list.some((v) => v.id === version.id)) {
    throw new Error("ASSET_VERSION_ID_EXISTS");
  }
  list.push(version);
  setList(userId, list);
  return version;
}

export function update(
  userId: string,
  id: string,
  patch: Partial<Omit<AssetVersion, "id" | "packageId" | "createdAt">>
): AssetVersion | null {
  const list = getList(userId);
  const idx = list.findIndex((v) => v.id === id);
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
  const next = list.filter((v) => v.id !== id);
  if (next.length === list.length) return false;
  setList(userId, next);
  return true;
}

/** 將同一個 package 底下除 exceptVersionId 外的所有版本設為 isPrimary: false */
export function setOthersNonPrimary(userId: string, packageId: string, exceptVersionId: string): void {
  const list = getList(userId);
  let changed = false;
  for (let i = 0; i < list.length; i++) {
    if (list[i].packageId === packageId && list[i].id !== exceptVersionId && list[i].isPrimary) {
      list[i] = { ...list[i], isPrimary: false };
      changed = true;
    }
  }
  if (changed) setList(userId, list);
}
