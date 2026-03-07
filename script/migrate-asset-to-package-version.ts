/**
 * Phase 4 Migration: 舊 assets.json → asset-packages.json + asset-versions.json
 * 並更新 publish-drafts.json（assetIds → selectedVersionIds，補 assetPackageId）
 *
 * 執行方式：手動執行，不在 server 啟動時跑。
 *   npx tsx script/migrate-asset-to-package-version.ts           # 正式執行
 *   npx tsx script/migrate-asset-to-package-version.ts --dry-run # 僅驗證與預覽，不寫入
 *
 * 備份目錄：.data/backups/
 * 驗證失敗時不覆寫任何既有資料，並輸出錯誤與備份路徑提示。
 */

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), ".data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const ASSETS_FILE = path.join(DATA_DIR, "assets.json");
const DRAFTS_FILE = path.join(DATA_DIR, "publish-drafts.json");
const PACKAGES_FILE = path.join(DATA_DIR, "asset-packages.json");
const VERSIONS_FILE = path.join(DATA_DIR, "asset-versions.json");

type AssetsStore = Record<string, unknown[]>;
type DraftsStore = Record<string, unknown[]>;
type PackagesStore = Record<string, unknown[]>;
type VersionsStore = Record<string, unknown[]>;

function log(msg: string): void {
  console.log(`[migrate] ${msg}`);
}

function err(msg: string): void {
  console.error(`[migrate] ERROR: ${msg}`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function backupPath(baseName: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(BACKUP_DIR, `${baseName}.${ts}`);
}

/** 備份單一檔案；若不存在則跳過並回傳 false */
function backupFile(sourcePath: string, baseName: string): boolean {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }
  ensureDir(BACKUP_DIR);
  const dest = backupPath(baseName);
  fs.copyFileSync(sourcePath, dest);
  log(`備份: ${sourcePath} → ${dest}`);
  return true;
}

/** 驗證 assets.json 結構與必要欄位 */
function validateAssets(store: unknown): { ok: true; data: AssetsStore } | { ok: false; message: string } {
  if (store === null || typeof store !== "object" || Array.isArray(store)) {
    return { ok: false, message: "assets.json 必須是物件 (Record<userId, Asset[]>)" };
  }
  const data = store as Record<string, unknown>;
  for (const userId of Object.keys(data)) {
    const list = data[userId];
    if (!Array.isArray(list)) {
      return { ok: false, message: `assets.json["${userId}"] 必須是陣列` };
    }
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a === null || typeof a !== "object") {
        return { ok: false, message: `assets.json["${userId}"][${i}] 必須是物件` };
      }
      const o = a as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.userId !== "string" || typeof o.name !== "string") {
        return { ok: false, message: `assets.json["${userId}"][${i}] 缺少 id / userId / name` };
      }
      if (typeof o.assetType !== "string" || typeof o.aspectRatio !== "string" || typeof o.status !== "string") {
        return { ok: false, message: `assets.json["${userId}"][${i}] 缺少 assetType / aspectRatio / status` };
      }
    }
  }
  return { ok: true, data: data as AssetsStore };
}

/** 驗證 publish-drafts.json 結構 */
function validateDrafts(store: unknown): { ok: true; data: DraftsStore } | { ok: false; message: string } {
  if (store === null || typeof store !== "object" || Array.isArray(store)) {
    return { ok: false, message: "publish-drafts.json 必須是物件 (Record<userId, PublishDraft[]>)" };
  }
  const data = store as Record<string, unknown>;
  for (const userId of Object.keys(data)) {
    const list = data[userId];
    if (!Array.isArray(list)) {
      return { ok: false, message: `publish-drafts.json["${userId}"] 必須是陣列` };
    }
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (d === null || typeof d !== "object") {
        return { ok: false, message: `publish-drafts.json["${userId}"][${i}] 必須是物件` };
      }
      const o = d as Record<string, unknown>;
      if (!Array.isArray(o.assetIds)) {
        return { ok: false, message: `publish-drafts.json["${userId}"][${i}] 缺少 assetIds 陣列` };
      }
    }
  }
  return { ok: true, data: data as DraftsStore };
}

/** 從 assets 產生 packages 與 versions；version.id = 舊 Asset.id */
function transformAssetsToPackagesAndVersions(
  assetsStore: AssetsStore
): { packages: PackagesStore; versions: VersionsStore; versionToPackage: Map<string, string> } {
  const packages: PackagesStore = {};
  const versions: VersionsStore = {};
  const versionToPackage = new Map<string, string>();

  for (const userId of Object.keys(assetsStore)) {
    const list = assetsStore[userId] as Record<string, unknown>[];
    const pkgList: unknown[] = [];
    const verList: unknown[] = [];

    for (const a of list) {
      const assetId = a.id as string;
      const now = (a.updatedAt as string) || (a.createdAt as string) || new Date().toISOString();
      const pkgId = randomUUID();

      const pkg = {
        id: pkgId,
        userId,
        name: a.name,
        brandProductName: a.brandProductName,
        adObjective: a.adObjective,
        primaryCopy: a.primaryCopy,
        headline: a.headline,
        cta: a.cta,
        landingPageUrl: a.landingPageUrl ?? "",
        status: a.status,
        note: a.note,
        tags: undefined,
        createdAt: (a.createdAt as string) || now,
        updatedAt: (a.updatedAt as string) || now,
      };
      pkgList.push(pkg);

      const ver = {
        id: assetId,
        packageId: pkgId,
        assetType: a.assetType,
        aspectRatio: a.aspectRatio,
        fileName: (a.fileName as string) ?? "",
        fileUrl: (a.fileUrl as string) ?? "",
        fileType: (a.fileType as string) ?? "",
        versionNote: a.note,
        isPrimary: true,
        thumbnailUrl: undefined,
        durationSeconds: undefined,
        fileSizeBytes: undefined,
        createdAt: (a.createdAt as string) || now,
      };
      verList.push(ver);
      versionToPackage.set(assetId, pkgId);
    }

    if (pkgList.length > 0) packages[userId] = pkgList;
    if (verList.length > 0) versions[userId] = verList;
  }

  return { packages, versions, versionToPackage };
}

/** 更新 drafts：assetIds → selectedVersionIds（僅含已遷移的 version id），補 assetPackageId */
function transformDrafts(
  draftsStore: DraftsStore,
  versionToPackage: Map<string, string>
): DraftsStore {
  const out: DraftsStore = {};
  for (const userId of Object.keys(draftsStore)) {
    const list = (draftsStore[userId] as Record<string, unknown>[]) || [];
    out[userId] = list.map((draft) => {
      const assetIds = (draft.assetIds as string[]) || [];
      const selectedVersionIds = assetIds.filter((id) => versionToPackage.has(id));
      const firstNewId = selectedVersionIds[0];
      const assetPackageId = firstNewId ? versionToPackage.get(firstNewId) ?? undefined : undefined;
      return {
        ...draft,
        assetPackageId: assetPackageId ?? (draft.assetPackageId as string | undefined),
        selectedVersionIds: selectedVersionIds.length > 0 ? selectedVersionIds : (draft.selectedVersionIds as string[] | undefined) ?? [],
        assetIds: draft.assetIds,
      };
    });
  }
  return out;
}

/** migration 後驗證：draft 的 selectedVersionIds / assetPackageId 在對應 store 存在 */
function postValidate(
  draftsStore: DraftsStore,
  packagesStore: PackagesStore,
  versionsStore: VersionsStore
): { ok: true } | { ok: false; message: string } {
  const pkgIdsByUser = new Map<string, Set<string>>();
  const verIdsByUser = new Map<string, Set<string>>();
  for (const userId of Object.keys(packagesStore)) {
    const list = (packagesStore[userId] as { id: string }[]) || [];
    pkgIdsByUser.set(userId, new Set(list.map((p) => p.id)));
  }
  for (const userId of Object.keys(versionsStore)) {
    const list = (versionsStore[userId] as { id: string }[]) || [];
    verIdsByUser.set(userId, new Set(list.map((v) => v.id)));
  }

  for (const userId of Object.keys(draftsStore)) {
    const list = (draftsStore[userId] as Record<string, unknown>[]) || [];
    const verSet = verIdsByUser.get(userId);
    const pkgSet = pkgIdsByUser.get(userId);
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const selectedVersionIds = (d.selectedVersionIds as string[]) || [];
      const assetPackageId = d.assetPackageId as string | undefined;
      for (const vid of selectedVersionIds) {
        if (verSet && !verSet.has(vid)) {
          return { ok: false, message: `draft[${userId}][${i}] selectedVersionIds 含不存在的版本: ${vid}` };
        }
      }
      if (assetPackageId && pkgSet && !pkgSet.has(assetPackageId)) {
        return { ok: false, message: `draft[${userId}][${i}] assetPackageId 不存在: ${assetPackageId}` };
      }
    }
  }
  return { ok: true };
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    log("--- DRY RUN：僅驗證與預覽，不寫入任何檔案 ---");
  }

  if (!fs.existsSync(ASSETS_FILE)) {
    err("找不到 " + ASSETS_FILE + "，無法執行 migration。");
    log("備份目錄（若已手動備份）: " + BACKUP_DIR);
    process.exit(1);
  }

  ensureDir(DATA_DIR);
  ensureDir(BACKUP_DIR);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  log("步驟 1：備份");
  const backedAssets = backupFile(ASSETS_FILE, "assets.json");
  const backedDrafts = backupFile(DRAFTS_FILE, "publish-drafts.json");
  if (!backedAssets) {
    err("未備份到 assets.json（檔案不存在？）");
    process.exit(1);
  }
  log("備份完成。路徑: " + BACKUP_DIR);

  log("步驟 2：讀取並驗證");
  let assetsRaw: string;
  let draftsRaw: string;
  try {
    assetsRaw = fs.readFileSync(ASSETS_FILE, "utf-8");
  } catch (e) {
    err("讀取 assets.json 失敗: " + (e as Error).message);
    log("請從備份還原: " + backupPath("assets.json"));
    process.exit(1);
  }
  let assetsStore: AssetsStore;
  try {
    const parsed = JSON.parse(assetsRaw) as unknown;
    const v = validateAssets(parsed);
    if (!v.ok) {
      err("assets.json 驗證失敗: " + v.message);
      log("請修正資料或從備份還原: " + BACKUP_DIR);
      process.exit(1);
    }
    assetsStore = v.data;
  } catch (e) {
    err("assets.json 解析失敗: " + (e as Error).message);
    log("備份路徑: " + BACKUP_DIR);
    process.exit(1);
  }

  let draftsStore: DraftsStore;
  if (fs.existsSync(DRAFTS_FILE)) {
    try {
      draftsRaw = fs.readFileSync(DRAFTS_FILE, "utf-8");
      const parsed = JSON.parse(draftsRaw) as unknown;
      const v = validateDrafts(parsed);
      if (!v.ok) {
        err("publish-drafts.json 驗證失敗: " + v.message);
        log("請修正資料或從備份還原: " + BACKUP_DIR);
        process.exit(1);
      }
      draftsStore = v.data;
    } catch (e) {
      err("publish-drafts.json 讀取/解析失敗: " + (e as Error).message);
      log("備份路徑: " + BACKUP_DIR);
      process.exit(1);
    }
  } else {
    draftsStore = {};
    log("publish-drafts.json 不存在，drafts 將維持空物件。");
  }

  log("步驟 3：轉換 assets → packages + versions");
  const { packages, versions, versionToPackage } = transformAssetsToPackagesAndVersions(assetsStore);
  const newDrafts = transformDrafts(draftsStore, versionToPackage);

  log("步驟 4：migration 後驗證");
  const pv = postValidate(newDrafts, packages, versions);
  if (!pv.ok) {
    err("migration 後驗證失敗: " + pv.message);
    log("未寫入任何檔案。請檢查資料或從備份還原: " + BACKUP_DIR);
    process.exit(1);
  }

  if (dryRun) {
    log("DRY RUN 通過。將寫入:");
    log("  - " + PACKAGES_FILE + " (" + Object.keys(packages).length + " users)");
    log("  - " + VERSIONS_FILE + " (" + Object.keys(versions).length + " users)");
    log("  - " + DRAFTS_FILE + " (更新 selectedVersionIds / assetPackageId)");
    log("正式執行請去掉 --dry-run 後再跑一次。");
    process.exit(0);
  }

  log("步驟 5：寫入新檔與更新 drafts");
  if (fs.existsSync(PACKAGES_FILE)) {
    backupFile(PACKAGES_FILE, "asset-packages.json");
  }
  if (fs.existsSync(VERSIONS_FILE)) {
    backupFile(VERSIONS_FILE, "asset-versions.json");
  }
  try {
    fs.writeFileSync(PACKAGES_FILE, JSON.stringify(packages, null, 2), "utf-8");
    log("已寫入 " + PACKAGES_FILE);
    fs.writeFileSync(VERSIONS_FILE, JSON.stringify(versions, null, 2), "utf-8");
    log("已寫入 " + VERSIONS_FILE);
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(newDrafts, null, 2), "utf-8");
    log("已更新 " + DRAFTS_FILE);
  } catch (e) {
    err("寫入失敗: " + (e as Error).message);
    log("請從備份還原: " + BACKUP_DIR);
    process.exit(1);
  }

  log("migration 完成。舊 assets.json 未刪除，可手動保留或於收尾階段移除。");
}

main();
