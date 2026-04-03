import type { PublishTemplate } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const TEMPLATES_FILE = path.join(DATA_DIR, "publish-templates.json");

type Store = Record<string, PublishTemplate[]>;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): Store {
  try {
    if (fs.existsSync(TEMPLATES_FILE)) {
      return JSON.parse(fs.readFileSync(TEMPLATES_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[PublishTemplateRepository] Failed to load:", (e as Error).message);
  }
  return {};
}

function saveStore(store: Store): void {
  try {
    ensureDataDir();
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("[PublishTemplateRepository] Failed to save:", (e as Error).message);
  }
}

function getList(userId: string): PublishTemplate[] {
  return loadStore()[userId] ?? [];
}

function setList(userId: string, list: PublishTemplate[]): void {
  const store = loadStore();
  store[userId] = list;
  saveStore(store);
}

export function listByUserId(userId: string): PublishTemplate[] {
  return getList(userId);
}

export function getById(userId: string, id: string): PublishTemplate | null {
  return getList(userId).find((t) => t.id === id) ?? null;
}

export function create(userId: string, template: PublishTemplate): PublishTemplate {
  const list = getList(userId);
  if (list.some((t) => t.id === template.id)) {
    throw new Error("TEMPLATE_ID_EXISTS");
  }
  list.push(template);
  setList(userId, list);
  return template;
}

export function remove(userId: string, id: string): boolean {
  const list = getList(userId).filter((t) => t.id !== id);
  if (list.length === getList(userId).length) return false;
  setList(userId, list);
  return true;
}
