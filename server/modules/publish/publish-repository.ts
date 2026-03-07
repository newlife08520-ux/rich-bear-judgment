import type { PublishDraft, PublishLog } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DRAFTS_FILE = path.join(DATA_DIR, "publish-drafts.json");
const LOGS_FILE = path.join(DATA_DIR, "publish-logs.json");

type DraftsStore = Record<string, PublishDraft[]>;
type LogsStore = Record<string, PublishLog[]>;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDraftsStore(): DraftsStore {
  try {
    if (fs.existsSync(DRAFTS_FILE)) {
      return JSON.parse(fs.readFileSync(DRAFTS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[PublishRepository] Failed to load drafts:", (e as Error).message);
  }
  return {};
}

function saveDraftsStore(store: DraftsStore): void {
  try {
    ensureDataDir();
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("[PublishRepository] Failed to save drafts:", (e as Error).message);
  }
}

function loadLogsStore(): LogsStore {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(LOGS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[PublishRepository] Failed to load logs:", (e as Error).message);
  }
  return {};
}

function saveLogsStore(store: LogsStore): void {
  try {
    ensureDataDir();
    fs.writeFileSync(LOGS_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("[PublishRepository] Failed to save logs:", (e as Error).message);
  }
}

function getDraftsList(userId: string): PublishDraft[] {
  return loadDraftsStore()[userId] ?? [];
}

function setDraftsList(userId: string, list: PublishDraft[]): void {
  const store = loadDraftsStore();
  store[userId] = list;
  saveDraftsStore(store);
}

function getLogsList(userId: string): PublishLog[] {
  return loadLogsStore()[userId] ?? [];
}

function setLogsList(userId: string, list: PublishLog[]): void {
  const store = loadLogsStore();
  store[userId] = list;
  saveLogsStore(store);
}

// ---------- Drafts ----------

export function listDraftsByUserId(userId: string): PublishDraft[] {
  return getDraftsList(userId);
}

export function getDraftById(userId: string, id: string): PublishDraft | null {
  const list = getDraftsList(userId);
  return list.find((d) => d.id === id) ?? null;
}

export function createDraft(userId: string, draft: PublishDraft): PublishDraft {
  const list = getDraftsList(userId);
  if (list.some((d) => d.id === draft.id)) {
    throw new Error("DRAFT_ID_EXISTS");
  }
  list.push(draft);
  setDraftsList(userId, list);
  return draft;
}

export function updateDraft(
  userId: string,
  id: string,
  patch: Partial<Omit<PublishDraft, "id" | "userId" | "createdAt">>
): PublishDraft | null {
  const list = getDraftsList(userId);
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, id: list[idx].id, userId, createdAt: list[idx].createdAt };
  setDraftsList(userId, list);
  return list[idx];
}

// ---------- Logs ----------

export function listLogsByUserId(userId: string): PublishLog[] {
  return getLogsList(userId);
}

export function appendLog(userId: string, log: PublishLog): PublishLog {
  const list = getLogsList(userId);
  list.push(log);
  setLogsList(userId, list);
  return log;
}
