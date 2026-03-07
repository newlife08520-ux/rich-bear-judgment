import {
  type User,
  type InsertUser,
  type JudgmentRecord,
  type JudgmentReport,
  type UserSettings,
  type SettingsInput,
  type JudgmentInput,
  type SyncedAccount,
  type RefreshStatus,
  type AnalysisBatch,
  type CampaignMetrics,
  type GA4PageMetricsDetailed,
  type AccountHealthScore,
  type ReviewSession,
  type ChatMessage,
  getRecommendationLevel,
  buildScopeKey,
} from "@shared/schema";
import {
  computeAccountAvg,
  calculateCampaignTriScore,
  classifyRiskLevel,
  evaluateStopLoss,
  classifyOpportunities,
  buildCampaignScoringResult,
  buildPageScoringResult,
  buildAccountScoringResult,
  calculatePageTriScore,
  classifyPageRiskLevel,
  buildBoardSet,
} from "./scoring-engine";
import { identifyRiskyCampaigns } from "./analysis-engine";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { WorkbenchProductOwners, WorkbenchTask, WorkbenchAuditEntry } from "@shared/workbench-types";

const DATA_DIR = path.join(process.cwd(), ".data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const SYNCED_ACCOUNTS_FILE = path.join(DATA_DIR, "synced-accounts.json");
const FAVORITES_FILE = path.join(DATA_DIR, "favorites.json");
const BATCH_FILE = path.join(DATA_DIR, "latest-batch.json");
const REVIEW_SESSIONS_FILE = path.join(DATA_DIR, "review-sessions.json");
const WORKBENCH_OWNERS_FILE = path.join(DATA_DIR, "workbench-owners.json");
const WORKBENCH_TASKS_FILE = path.join(DATA_DIR, "workbench-tasks.json");
const WORKBENCH_AUDIT_FILE = path.join(DATA_DIR, "workbench-audit.json");
const WORKBENCH_MAPPING_FILE = path.join(DATA_DIR, "workbench-mapping.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.error(`[Storage] Failed to load ${filePath}:`, (e as Error).message);
  }
  return fallback;
}

function saveJsonFile(filePath: string, data: any): void {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`[Storage] Failed to save ${filePath}:`, (e as Error).message);
  }
}

function rescoreBatch(batch: AnalysisBatch): { rescored: boolean; stats: { campaigns: number; triScore: number; riskLevel: number; stopLoss: number; multiWindow: number; opportunities: number; ga4PageMetrics: number } } {
  const campaigns = batch.campaignMetrics || [];
  const stats = {
    campaigns: campaigns.length,
    triScore: 0,
    riskLevel: 0,
    stopLoss: 0,
    multiWindow: 0,
    opportunities: (batch.opportunities || []).length,
    ga4PageMetrics: (batch.ga4PageMetrics || []).length,
  };

  if (campaigns.length === 0) {
    return { rescored: false, stats };
  }

  const needsScoring = campaigns.some(c => !c.triScore || !c.riskLevel || !c.stopLoss);
  const needsOpportunities = !batch.opportunities || batch.opportunities.length === 0;
  const needsV2 = campaigns.some(c => c.triScore && !c.scoring) || !batch.boards;

  if (!needsScoring && !needsOpportunities && !needsV2) {
    for (const c of campaigns) {
      if (c.triScore) stats.triScore++;
      if (c.riskLevel) stats.riskLevel++;
      if (c.stopLoss) stats.stopLoss++;
      if (c.multiWindow) stats.multiWindow++;
    }
    return { rescored: false, stats };
  }

  const accountGroups = new Map<string, CampaignMetrics[]>();
  for (const c of campaigns) {
    if (!accountGroups.has(c.accountId)) accountGroups.set(c.accountId, []);
    accountGroups.get(c.accountId)!.push(c);
  }

  const accountAvgCache = new Map<string, ReturnType<typeof computeAccountAvg>>();
  for (const [acctId, acctCampaigns] of Array.from(accountGroups.entries())) {
    accountAvgCache.set(acctId, computeAccountAvg(acctCampaigns));
  }

  if (needsScoring) {
    for (const c of campaigns) {
      const acctAvg = accountAvgCache.get(c.accountId)!;
      const acctCampaigns = accountGroups.get(c.accountId)!;

      if (!c.triScore) {
        c.triScore = calculateCampaignTriScore(c, acctAvg);
      }
      if (!c.riskLevel) {
        c.riskLevel = classifyRiskLevel(c.triScore, c, acctAvg);
      }
      if (!c.stopLoss) {
        c.stopLoss = evaluateStopLoss(c, acctAvg, acctCampaigns);
      }
    }
  }

  for (const c of campaigns) {
    if (c.triScore) stats.triScore++;
    if (c.riskLevel) stats.riskLevel++;
    if (c.stopLoss) stats.stopLoss++;
    if (c.multiWindow) stats.multiWindow++;
  }

  if (needsOpportunities) {
    const globalAvg = computeAccountAvg(campaigns);
    const riskyCampaigns = identifyRiskyCampaigns(campaigns);
    const riskyCampaignIds = new Set(
      riskyCampaigns
        .filter(r => r.riskType !== "low_spend_high_potential")
        .map(r => r.campaignId)
    );
    batch.opportunities = classifyOpportunities(campaigns, globalAvg, riskyCampaignIds);
    stats.opportunities = batch.opportunities.length;
  }

  const needsV2Scoring = campaigns.some(c => c.triScore && !c.scoring);
  if (needsV2Scoring) {
    for (const c of campaigns) {
      if (c.triScore && c.riskLevel && !c.scoring) {
        const acctAvg = accountAvgCache.get(c.accountId) || computeAccountAvg(campaigns);
        c.scoring = buildCampaignScoringResult(c, acctAvg, c.triScore, c.riskLevel, c.stopLoss);
      }
    }
  }

  const pages = (batch.ga4PageMetrics || []) as GA4PageMetricsDetailed[];
  const needsPageV2 = pages.some(p => p.triScore && !p.scoring);
  if (needsPageV2 && pages.length > 0) {
    const siteAvg = {
      conversionRate: pages.reduce((s, p) => s + p.conversionRate, 0) / pages.length,
      bounceRate: pages.reduce((s, p) => s + p.bounceRate, 0) / pages.length,
      avgEngagementTime: pages.reduce((s, p) => s + p.avgEngagementTime, 0) / pages.length,
    };
    for (const page of pages) {
      if (page.triScore && page.riskLevel && !page.scoring) {
        page.scoring = buildPageScoringResult(page, siteAvg, page.triScore, page.riskLevel);
      }
    }
  }

  const accounts = (batch.accountRankings || []) as AccountHealthScore[];
  const needsAccountV2 = accounts.some(a => a.triScore && !a.scoring);
  if (needsAccountV2) {
    for (const a of accounts) {
      if (a.triScore && !a.scoring) {
        const acctCampaigns = accountGroups.get(a.accountId) || [];
        const acctAnomalies = (batch.anomalies || []).filter(an => an.accountId === a.accountId);
        const acctAvg = accountAvgCache.get(a.accountId) || computeAccountAvg(acctCampaigns);
        a.scoring = buildAccountScoringResult(a.triScore, a.riskLevel || "stable", acctCampaigns, acctAnomalies, acctAvg);
      }
    }
  }

  if (!batch.boards && (campaigns.some(c => c.scoring) || pages.some(p => p.scoring))) {
    batch.boards = buildBoardSet(campaigns, pages, accounts);
  }

  return { rescored: true, stats };
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  storeJudgmentReport(report: JudgmentReport, input: JudgmentInput): void;
  getJudgmentHistory(userId: string): JudgmentRecord[];
  getJudgmentReport(id: string): JudgmentReport | undefined;
  getSettings(userId: string): UserSettings;
  saveSettings(userId: string, settings: SettingsInput): UserSettings;
  getReviewSessions(userId: string): ReviewSession[];
  getReviewSession(id: string): ReviewSession | undefined;
  saveReviewSession(session: ReviewSession): ReviewSession;
  getFbFavoriteAccounts(userId: string): string[];
  saveFbFavoriteAccounts(userId: string, accountIds: string[]): string[];
  getSyncedAccounts(userId: string): SyncedAccount[];
  saveSyncedAccounts(userId: string, accounts: SyncedAccount[]): void;
  getLatestBatch(userId: string, scopeKey?: string): AnalysisBatch | null;
  getBatchForScope(userId: string, accountIds: string[], propertyIds: string[], datePreset: string): AnalysisBatch | null;
  saveBatch(userId: string, batch: AnalysisBatch): void;
  getRefreshStatus(userId: string): RefreshStatus;
  setRefreshStatus(userId: string, status: Partial<RefreshStatus>): void;
}



export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private judgments: Map<string, JudgmentReport>;
  private judgmentRecords: JudgmentRecord[];
  private settingsStore: Map<string, UserSettings>;
  private fbFavoriteAccounts: Map<string, string[]>;
  private syncedAccountsStore: Map<string, SyncedAccount[]>;
  private batchStore: Map<string, AnalysisBatch>;
  private refreshStatusStore: Map<string, RefreshStatus>;
  private reviewSessionsStore: Map<string, ReviewSession>;
  private workbenchOwners: WorkbenchProductOwners;
  private workbenchTasks: WorkbenchTask[];
  private workbenchAudit: WorkbenchAuditEntry[];
  private workbenchMapping: Record<string, string>; // campaignId -> productName

  constructor() {
    this.users = new Map();
    this.judgments = new Map();
    this.judgmentRecords = [];
    this.settingsStore = new Map();
    this.fbFavoriteAccounts = new Map();
    this.syncedAccountsStore = new Map();
    this.batchStore = new Map();
    this.refreshStatusStore = new Map();
    this.reviewSessionsStore = new Map();
    this.workbenchOwners = {};
    this.workbenchTasks = [];
    this.workbenchAudit = [];
    this.workbenchMapping = {};

    const mockUsers: User[] = [
      { id: "1", username: "admin", password: "admin123", role: "admin", displayName: "系統管理員" },
      { id: "2", username: "manager", password: "manager123", role: "manager", displayName: "行銷總監" },
      { id: "3", username: "user", password: "user123", role: "user", displayName: "行銷專員" },
    ];
    mockUsers.forEach((u) => this.users.set(u.id, u));
    this.loadPersistedData();
  }

  private loadPersistedData(): void {
    const settings = loadJsonFile<Record<string, UserSettings>>(SETTINGS_FILE, {});
    for (const [userId, s] of Object.entries(settings)) {
      const withSystemPrompt = { ...s, systemPrompt: (s as any).systemPrompt ?? "" };
      this.settingsStore.set(userId, withSystemPrompt as UserSettings);
    }

    const reviewSessions = loadJsonFile<ReviewSession[]>(REVIEW_SESSIONS_FILE, []);
    for (const session of reviewSessions) {
      this.reviewSessionsStore.set(session.id, session);
    }

    const syncedAccounts = loadJsonFile<Record<string, SyncedAccount[]>>(SYNCED_ACCOUNTS_FILE, {});
    for (const [userId, accounts] of Object.entries(syncedAccounts)) {
      this.syncedAccountsStore.set(userId, accounts);
    }

    const favorites = loadJsonFile<Record<string, string[]>>(FAVORITES_FILE, {});
    for (const [userId, favs] of Object.entries(favorites)) {
      this.fbFavoriteAccounts.set(userId, favs);
    }

    const batches = loadJsonFile<Record<string, AnalysisBatch>>(BATCH_FILE, {});
    let rescoredCount = 0;
    for (const [key, batch] of Object.entries(batches)) {
      const { rescored, stats } = rescoreBatch(batch);
      this.batchStore.set(key, batch);
      if (rescored) {
        rescoredCount++;
        console.log(`[Storage] Rescored batch "${key}": ${stats.campaigns} campaigns → triScore=${stats.triScore}, riskLevel=${stats.riskLevel}, stopLoss=${stats.stopLoss}, multiWindow=${stats.multiWindow}, opportunities=${stats.opportunities}, ga4PageMetrics=${stats.ga4PageMetrics}`);
      }
    }

    if (rescoredCount > 0) {
      const obj: Record<string, AnalysisBatch> = {};
      this.batchStore.forEach((v, k) => { obj[k] = v; });
      saveJsonFile(BATCH_FILE, obj);
      console.log(`[Storage] Persisted ${rescoredCount} rescored batches back to disk`);
    }

    this.workbenchOwners = loadJsonFile<WorkbenchProductOwners>(WORKBENCH_OWNERS_FILE, {});
    this.workbenchTasks = loadJsonFile<WorkbenchTask[]>(WORKBENCH_TASKS_FILE, []);
    this.workbenchAudit = loadJsonFile<WorkbenchAuditEntry[]>(WORKBENCH_AUDIT_FILE, []);
    this.workbenchMapping = loadJsonFile<Record<string, string>>(WORKBENCH_MAPPING_FILE, {});

    const settingsCount = Object.keys(settings).length;
    const accountsCount = Object.keys(syncedAccounts).length;
    const batchCount = Object.keys(batches).length;
    if (settingsCount > 0 || accountsCount > 0 || batchCount > 0) {
      console.log(`[Storage] Loaded persisted data: ${settingsCount} settings, ${accountsCount} synced account sets, ${batchCount} batches (${rescoredCount} rescored)`);
    }
  }

  private persistWorkbenchOwners(): void {
    saveJsonFile(WORKBENCH_OWNERS_FILE, this.workbenchOwners);
  }

  private persistWorkbenchTasks(): void {
    saveJsonFile(WORKBENCH_TASKS_FILE, this.workbenchTasks);
  }

  private persistWorkbenchAudit(): void {
    const tail = this.workbenchAudit.slice(-500);
    saveJsonFile(WORKBENCH_AUDIT_FILE, tail);
  }

  private persistWorkbenchMapping(): void {
    saveJsonFile(WORKBENCH_MAPPING_FILE, this.workbenchMapping);
  }

  private persistSettings(): void {
    const obj: Record<string, UserSettings> = {};
    this.settingsStore.forEach((v, k) => { obj[k] = v; });
    saveJsonFile(SETTINGS_FILE, obj);
  }

  private persistSyncedAccounts(): void {
    const obj: Record<string, SyncedAccount[]> = {};
    this.syncedAccountsStore.forEach((v, k) => { obj[k] = v; });
    saveJsonFile(SYNCED_ACCOUNTS_FILE, obj);
  }

  private persistFavorites(): void {
    const obj: Record<string, string[]> = {};
    this.fbFavoriteAccounts.forEach((v, k) => { obj[k] = v; });
    saveJsonFile(FAVORITES_FILE, obj);
  }

  private persistReviewSessions(): void {
    const arr = Array.from(this.reviewSessionsStore.values());
    saveJsonFile(REVIEW_SESSIONS_FILE, arr);
  }

  async getUser(id: string) { return this.users.get(id); }
  async getUserByUsername(username: string) { return Array.from(this.users.values()).find((u) => u.username === username); }
  async createUser(insertUser: InsertUser) {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  storeJudgmentReport(report: JudgmentReport, input: JudgmentInput): void {
    const oppScore = typeof report.summary.opportunityScore === "number" ? report.summary.opportunityScore : 0;
    report.summary.opportunityScore = oppScore;
    this.judgments.set(report.id, report);
    this.judgmentRecords.unshift({
      id: report.id,
      caseId: report.caseId,
      version: report.version,
      type: report.type,
      url: input.url || undefined,
      score: report.summary.score,
      grade: report.summary.grade,
      verdict: report.summary.verdict,
      recommendation: report.summary.recommendation,
      opportunityScore: oppScore,
      recommendationLevel: getRecommendationLevel(oppScore),
      createdAt: report.createdAt,
      status: "completed",
      userId: report.userId,
    });
  }

  getJudgmentHistory(_userId: string): JudgmentRecord[] { return this.judgmentRecords; }
  getJudgmentReport(id: string): JudgmentReport | undefined { return this.judgments.get(id); }

  getSettings(userId: string): UserSettings {
    const existing = this.settingsStore.get(userId);
    if (existing) return existing;
    return {
      userId,
      ga4PropertyId: "",
      fbAccessToken: "",
      aiApiKey: "",
      systemPrompt: "",
      coreMasterPrompt: "你是「AI 行銷審判官」，一位擁有 15 年實戰經驗的資深行銷策略總監。你的判斷標準嚴格但公正，風格直接但有建設性。你不會給出模糊的建議，每一條反饋都必須具體、可執行、有數據支撐。你的目標是幫助用戶提升行銷效能，而不是讓他們感覺良好。\n\n評分標準：普通素材通常在 30-55 分之間，70 分以上代表真正優秀。當評分低於 40 分時，語氣應更加直接且帶有急迫感。",
      modeAPrompt: "【素材煉金術模式】\n你正在審判一份行銷素材（圖片、影片、海報、Reel 等）。\n\n重點判斷維度：\n1. 鉤子強度 - 前 3 秒是否能抓住注意力\n2. 情緒張力 - 是否能引發目標受眾的情感共鳴\n3. 視覺記憶 - 畫面是否有記憶點，能否在滑動中被記住\n4. 轉換驅動 - 是否有明確的行動引導\n5. CTA 清晰度 - 行動呼籲是否明確、有力、可執行",
      modeBPrompt: "【轉單說服力模式】\n你正在審判一個銷售頁面或著陸頁。\n\n重點判斷維度：\n1. 說服流程 - 頁面是否按照「痛點→解方→證據→行動」的邏輯展開\n2. 信任信號 - 是否有足夠的社會認同、權威背書、客戶評價\n3. 價格支撐 - 價格呈現是否有價值拆解、比較基準\n4. 掉單風險 - 結帳流程是否過長、行動端體驗是否良好\n5. 行動裝置體驗 - 手機版是否好用，CTA 是否在拇指熱區",
      modeCPrompt: "【廣告投放判決模式】\n你正在審判一組 FB/Meta 廣告投放數據。\n\n重點判斷維度：\n1. 素材健康度 - CTR 是否達標，素材是否有吸引力\n2. 受眾匹配度 - 投放受眾是否正確，是否有錯位\n3. 疲勞度 - Frequency 是否過高，素材是否需要輪替\n4. 預算效率 - CPC/CPM 是否合理，ROAS 是否達標\n5. 擴量潛力 - 目前數據是否支持增加預算",
      modeDPrompt: "【漏斗斷點審判模式】\n你正在審判一組 GA4 轉換漏斗數據。\n\n重點判斷維度：\n1. 著陸頁效率 - 進站後是否有效引導到下一步\n2. 產品頁轉換 - 瀏覽到加入購物車的比例是否合理\n3. 購物車放棄 - 放棄率是否異常，原因分析\n4. 結帳摩擦 - 結帳流程是否有阻力\n5. 整體漏斗健康 - 各階段轉換率是否符合業界標準",
      severity: "moderate",
      outputLength: "standard",
      brandTone: "professional",
      analysisBias: "conversion",
    };
  }

  saveSettings(userId: string, input: SettingsInput): UserSettings {
    const existing = this.settingsStore.get(userId);
    const settings: UserSettings = {
      userId,
      ga4PropertyId: input.ga4PropertyId ?? existing?.ga4PropertyId ?? "",
      fbAccessToken: input.fbAccessToken ?? existing?.fbAccessToken ?? "",
      aiApiKey: input.aiApiKey ?? existing?.aiApiKey ?? "",
      systemPrompt: input.systemPrompt ?? existing?.systemPrompt ?? "",
      coreMasterPrompt: input.coreMasterPrompt ?? existing?.coreMasterPrompt ?? "",
      modeAPrompt: input.modeAPrompt ?? existing?.modeAPrompt ?? "",
      modeBPrompt: input.modeBPrompt ?? existing?.modeBPrompt ?? "",
      modeCPrompt: input.modeCPrompt ?? existing?.modeCPrompt ?? "",
      modeDPrompt: input.modeDPrompt ?? existing?.modeDPrompt ?? "",
      severity: input.severity ?? existing?.severity ?? "moderate",
      outputLength: input.outputLength ?? existing?.outputLength ?? "standard",
      brandTone: input.brandTone ?? existing?.brandTone ?? "professional",
      analysisBias: input.analysisBias ?? existing?.analysisBias ?? "conversion",
    };
    this.settingsStore.set(userId, settings);
    this.persistSettings();
    return settings;
  }

  getReviewSessions(userId: string): ReviewSession[] {
    const all = Array.from(this.reviewSessionsStore.values()).filter((s) => s.userId === userId);
    return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getReviewSession(id: string): ReviewSession | undefined {
    return this.reviewSessionsStore.get(id);
  }

  saveReviewSession(session: ReviewSession): ReviewSession {
    this.reviewSessionsStore.set(session.id, session);
    this.persistReviewSessions();
    return session;
  }

  getFbFavoriteAccounts(userId: string): string[] {
    return this.fbFavoriteAccounts.get(userId) || [];
  }

  saveFbFavoriteAccounts(userId: string, accountIds: string[]): string[] {
    this.fbFavoriteAccounts.set(userId, accountIds);
    this.persistFavorites();
    return accountIds;
  }

  getSyncedAccounts(userId: string): SyncedAccount[] {
    return this.syncedAccountsStore.get(userId) || [];
  }

  saveSyncedAccounts(userId: string, accounts: SyncedAccount[]): void {
    this.syncedAccountsStore.set(userId, accounts);
    this.persistSyncedAccounts();
  }

  getLatestBatch(userId: string, scopeKey?: string): AnalysisBatch | null {
    if (scopeKey) {
      const direct = this.batchStore.get(scopeKey);
      if (direct) return direct;
    }
    return this.batchStore.get(userId) || null;
  }

  getBatchForScope(
    userId: string,
    accountIds: string[],
    propertyIds: string[],
    datePreset: string
  ): AnalysisBatch | null {
    const key = buildScopeKey(userId, accountIds, propertyIds, datePreset);
    return this.batchStore.get(key) || null;
  }

  saveBatch(userId: string, batch: AnalysisBatch): void {
    const scopeKey = buildScopeKey(
      userId,
      batch.selectedAccountIds || [],
      batch.selectedPropertyIds || [],
      batch.dateRange.preset
    );
    this.batchStore.set(scopeKey, batch);
    this.batchStore.set(userId, batch);

    const allKeys = Array.from(this.batchStore.keys()).filter(k => k.startsWith(`${userId}::`));
    if (allKeys.length > 10) {
      const sorted = allKeys
        .map(k => ({ key: k, time: this.batchStore.get(k)!.generatedAt }))
        .sort((a, b) => a.time.localeCompare(b.time));
      for (let i = 0; i < sorted.length - 10; i++) {
        this.batchStore.delete(sorted[i].key);
      }
    }

    const obj: Record<string, AnalysisBatch> = {};
    this.batchStore.forEach((v, k) => { obj[k] = v; });
    saveJsonFile(BATCH_FILE, obj);
  }

  getRefreshStatus(userId: string): RefreshStatus {
    return this.refreshStatusStore.get(userId) || {
      isRefreshing: false,
      currentStep: "",
      progress: 0,
      lastRefreshedAt: null,
      lastAnalysisAt: null,
      lastAiSummaryAt: null,
    };
  }

  setRefreshStatus(userId: string, status: Partial<RefreshStatus>): void {
    const current = this.getRefreshStatus(userId);
    this.refreshStatusStore.set(userId, { ...current, ...status });
  }

  getWorkbenchOwners(): WorkbenchProductOwners {
    return { ...this.workbenchOwners };
  }

  saveWorkbenchOwners(data: WorkbenchProductOwners): void {
    this.workbenchOwners = { ...data };
    this.persistWorkbenchOwners();
  }

  patchWorkbenchProductOwner(productName: string, patch: Partial<WorkbenchProductOwners[string]>): void {
    const cur = this.workbenchOwners[productName] || { productOwnerId: "", mediaOwnerId: "", creativeOwnerId: "", taskStatus: "unassigned" };
    this.workbenchOwners[productName] = { ...cur, ...patch };
    this.persistWorkbenchOwners();
  }

  getWorkbenchTasks(): WorkbenchTask[] {
    return [...this.workbenchTasks];
  }

  createWorkbenchTask(input: Omit<WorkbenchTask, "id" | "createdAt" | "updatedAt">): WorkbenchTask {
    const now = new Date().toISOString();
    const task: WorkbenchTask = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.workbenchTasks.push(task);
    this.persistWorkbenchTasks();
    return task;
  }

  updateWorkbenchTask(id: string, patch: Partial<Pick<WorkbenchTask, "assigneeId" | "status" | "notes">>): WorkbenchTask | undefined {
    const idx = this.workbenchTasks.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    const updated = { ...this.workbenchTasks[idx]!, ...patch, updatedAt: new Date().toISOString() };
    this.workbenchTasks[idx] = updated;
    this.persistWorkbenchTasks();
    return updated;
  }

  getWorkbenchTask(id: string): WorkbenchTask | undefined {
    return this.workbenchTasks.find((t) => t.id === id);
  }

  getWorkbenchAuditLog(limit = 100): WorkbenchAuditEntry[] {
    return this.workbenchAudit.slice(-limit).reverse();
  }

  appendWorkbenchAudit(entry: Omit<WorkbenchAuditEntry, "id" | "at">): void {
    const full: WorkbenchAuditEntry = {
      ...entry,
      id: randomUUID(),
      at: new Date().toISOString(),
    };
    this.workbenchAudit.push(full);
    this.persistWorkbenchAudit();
  }

  getWorkbenchMapping(): Record<string, string> {
    return { ...this.workbenchMapping };
  }

  setWorkbenchMappingOverride(campaignId: string, productName: string): void {
    this.workbenchMapping[campaignId] = productName;
    this.persistWorkbenchMapping();
  }
}

export const storage = new MemStorage();
