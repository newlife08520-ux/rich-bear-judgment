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
  type RefreshJob,
  type RefreshJobErrorStage,
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
import { prisma } from "./db";

const DATA_DIR = path.join(process.cwd(), ".data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

/** 用於比對「欄位值是否變更」的指紋，不存實際密文 */
function valueFingerprint(value: string): string {
  const s = (value ?? "").trim();
  if (!s) return "";
  return `${s.length}:${s.slice(0, 2)}:${s.slice(-2)}`;
}

function parseDefaultProductScopeFromDb(raw: string | null | undefined): string[] | null {
  if (raw == null || raw === "") return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return null;
    const names = j
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((s) => s.trim());
    return names.length > 0 ? names : null;
  } catch {
    return null;
  }
}

const DEFAULT_VERIFICATION = {
  fbStatus: "idle" as const,
  gaStatus: "idle" as const,
  aiStatus: "idle" as const,
  fbVerifiedAt: null as string | null,
  gaVerifiedAt: null as string | null,
  aiVerifiedAt: null as string | null,
  fbLastError: null as string | null,
  gaLastError: null as string | null,
  aiLastError: null as string | null,
  fbValidatedValueHash: null as string | null,
  gaValidatedValueHash: null as string | null,
  aiValidatedValueHash: null as string | null,
};

function withVerificationDefaults(s: Partial<UserSettings> & { userId: string }): UserSettings {
  return {
    ...s,
    fbStatus: s.fbStatus ?? DEFAULT_VERIFICATION.fbStatus,
    gaStatus: s.gaStatus ?? DEFAULT_VERIFICATION.gaStatus,
    aiStatus: s.aiStatus ?? DEFAULT_VERIFICATION.aiStatus,
    fbVerifiedAt: s.fbVerifiedAt ?? DEFAULT_VERIFICATION.fbVerifiedAt,
    gaVerifiedAt: s.gaVerifiedAt ?? DEFAULT_VERIFICATION.gaVerifiedAt,
    aiVerifiedAt: s.aiVerifiedAt ?? DEFAULT_VERIFICATION.aiVerifiedAt,
    fbLastError: s.fbLastError ?? DEFAULT_VERIFICATION.fbLastError,
    gaLastError: s.gaLastError ?? DEFAULT_VERIFICATION.gaLastError,
    aiLastError: s.aiLastError ?? DEFAULT_VERIFICATION.aiLastError,
    fbValidatedValueHash: s.fbValidatedValueHash ?? DEFAULT_VERIFICATION.fbValidatedValueHash,
    gaValidatedValueHash: s.gaValidatedValueHash ?? DEFAULT_VERIFICATION.gaValidatedValueHash,
    aiValidatedValueHash: s.aiValidatedValueHash ?? DEFAULT_VERIFICATION.aiValidatedValueHash,
  } as UserSettings;
}
const SYNCED_ACCOUNTS_FILE = path.join(DATA_DIR, "synced-accounts.json");
const FAVORITES_FILE = path.join(DATA_DIR, "favorites.json");
const BATCH_FILE = path.join(DATA_DIR, "latest-batch.json");
const REVIEW_SESSIONS_FILE = path.join(DATA_DIR, "review-sessions.json");
const WORKBENCH_OWNERS_FILE = path.join(DATA_DIR, "workbench-owners.json");
const WORKBENCH_TASKS_FILE = path.join(DATA_DIR, "workbench-tasks.json");
const WORKBENCH_AUDIT_FILE = path.join(DATA_DIR, "workbench-audit.json");
const WORKBENCH_MAPPING_FILE = path.join(DATA_DIR, "workbench-mapping.json");
const REFRESH_JOBS_FILE = path.join(DATA_DIR, "refresh-jobs.json");

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
  updateUserPasswordHash(userId: string, passwordHash: string): Promise<void>;
  updateUserDefaultProductScope(userId: string, productNames: string[] | null): Promise<User | undefined>;
  storeJudgmentReport(report: JudgmentReport, input: JudgmentInput): void;
  getJudgmentHistory(userId: string): JudgmentRecord[];
  getJudgmentReport(id: string): JudgmentReport | undefined;
  getSettings(userId: string): UserSettings;
  saveSettings(userId: string, settings: SettingsInput): Promise<UserSettings>;
  patchVerificationStatus(userId: string, type: "fb" | "ga4" | "ai", payload: { status: "success" | "error"; verifiedAt: string; lastError?: string | null }, value: string): Promise<UserSettings>;
  getReviewSessions(userId: string): ReviewSession[];
  getReviewSession(id: string): ReviewSession | undefined;
  saveReviewSession(session: ReviewSession): Promise<ReviewSession>;
  getFbFavoriteAccounts(userId: string): string[];
  saveFbFavoriteAccounts(userId: string, accountIds: string[]): string[];
  getSyncedAccounts(userId: string): SyncedAccount[];
  saveSyncedAccounts(userId: string, accounts: SyncedAccount[]): Promise<void>;
  getLatestBatch(userId: string, scopeKey?: string): AnalysisBatch | null;
  getBatchForScope(
    userId: string,
    accountIds: string[],
    propertyIds: string[],
    datePreset: string,
    customStart?: string,
    customEnd?: string
  ): AnalysisBatch | null;
  saveBatch(userId: string, batch: AnalysisBatch): Promise<void>;
  getRefreshStatus(userId: string): RefreshStatus;
  setRefreshStatus(userId: string, status: Partial<RefreshStatus>): void;
  createRefreshJob(job: RefreshJob): Promise<void>;
  getRefreshJob(jobId: string): RefreshJob | null;
  updateRefreshJob(jobId: string, updates: Partial<RefreshJob>): Promise<void>;
  listRefreshJobsByUser(userId: string): RefreshJob[];
  getRunningJobByScopeKey(scopeKey: string): RefreshJob | null;
  persistRefreshJobs(): Promise<void>;
  loadRefreshJobs(): void;
  hydratePersistentStoresFromDatabase(): Promise<void>;
}



export class MemStorage implements IStorage {
  private judgments: Map<string, JudgmentReport>;
  private judgmentRecords: JudgmentRecord[];
  private settingsStore: Map<string, UserSettings>;
  private fbFavoriteAccounts: Map<string, string[]>;
  private syncedAccountsStore: Map<string, SyncedAccount[]>;
  private batchStore: Map<string, AnalysisBatch>;
  private refreshStatusStore: Map<string, RefreshStatus>;
  private refreshJobsStore: Map<string, RefreshJob>;
  private reviewSessionsStore: Map<string, ReviewSession>;
  private workbenchOwners: WorkbenchProductOwners;
  private workbenchTasks: WorkbenchTask[];
  private workbenchAudit: WorkbenchAuditEntry[];
  private workbenchMapping: Record<string, string>; // campaignId -> productName

  constructor() {
    this.judgments = new Map();
    this.judgmentRecords = [];
    this.settingsStore = new Map();
    this.fbFavoriteAccounts = new Map();
    this.syncedAccountsStore = new Map();
    this.batchStore = new Map();
    this.refreshStatusStore = new Map();
    this.refreshJobsStore = new Map();
    this.reviewSessionsStore = new Map();
    this.workbenchOwners = {};
    this.workbenchTasks = [];
    this.workbenchAudit = [];
    this.workbenchMapping = {};

    this.loadPersistedData();
  }

  private loadPersistedData(): void {
    const settings = loadJsonFile<Record<string, UserSettings>>(SETTINGS_FILE, {});
    for (const [userId, s] of Object.entries(settings)) {
      const withSystemPrompt = { ...s, systemPrompt: (s as any).systemPrompt ?? "" };
      const withEnums = {
        ...withSystemPrompt,
        severity: (withSystemPrompt as any).severity ?? "moderate",
        outputLength: (withSystemPrompt as any).outputLength ?? "standard",
        brandTone: (withSystemPrompt as any).brandTone ?? "professional",
        analysisBias: (withSystemPrompt as any).analysisBias ?? "conversion",
      };
      this.settingsStore.set(userId, withVerificationDefaults({ ...withEnums, userId }) as UserSettings);
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
    // 確保 getLatestBatch(userId) 有 fallback：同一 userId 多筆 batch 時，選「latest」規則見 docs/precompute-path-verification.md
    const byUserId = new Map<string, AnalysisBatch>();
    for (const batch of Object.values(batches)) {
      const uid = batch?.userId;
      if (!uid) continue;
      const existing = byUserId.get(uid);
      const hasPre = batch.precomputedActionCenter != null && batch.precomputedScorecard != null;
      const existingHasPre = existing?.precomputedActionCenter != null && existing?.precomputedScorecard != null;
      const preAt = batch.precomputeCompletedAt ?? "";
      const existingPreAt = existing?.precomputeCompletedAt ?? "";
      const genAt = batch.generatedAt ?? "";
      const existingGenAt = existing?.generatedAt ?? "";
      const pickThis =
        !existing ||
        (hasPre && !existingHasPre) ||
        (hasPre === existingHasPre && (preAt > existingPreAt || (preAt === existingPreAt && genAt > existingGenAt)));
      if (pickThis) byUserId.set(uid, batch);
    }
    for (const [uid, batch] of byUserId) {
      if (!this.batchStore.has(uid)) this.batchStore.set(uid, batch);
    }

    if (rescoredCount > 0) {
      console.log(`[Storage] Rescored ${rescoredCount} batches in memory (batch JSON 寫入已停用)`);
    }

    this.workbenchOwners = loadJsonFile<WorkbenchProductOwners>(WORKBENCH_OWNERS_FILE, {});
    this.workbenchTasks = loadJsonFile<WorkbenchTask[]>(WORKBENCH_TASKS_FILE, []);
    this.workbenchAudit = loadJsonFile<WorkbenchAuditEntry[]>(WORKBENCH_AUDIT_FILE, []);
    this.workbenchMapping = loadJsonFile<Record<string, string>>(WORKBENCH_MAPPING_FILE, {});

    const settingsCount = Object.keys(settings).length;
    const accountsCount = Object.keys(syncedAccounts).length;
    const batchCount = Object.keys(batches).length;
    this.loadRefreshJobs();
    if (settingsCount > 0 || accountsCount > 0 || batchCount > 0) {
      console.log(`[Storage] Loaded persisted data: ${settingsCount} settings, ${accountsCount} synced account sets, ${batchCount} batches (${rescoredCount} rescored)`);
    }
  }

  loadRefreshJobs(): void {
    const jobs = loadJsonFile<Record<string, RefreshJob>>(REFRESH_JOBS_FILE, {});
    let recovered = 0;
    for (const [id, job] of Object.entries(jobs)) {
      if (job.status === "running") {
        (job as RefreshJob).status = "failed";
        (job as RefreshJob).finishedAt = new Date().toISOString();
        (job as RefreshJob).errorStage = "recovery" as RefreshJobErrorStage;
        (job as RefreshJob).errorMessage = "服務重啟中斷，job 無法恢復";
        recovered++;
      }
      this.refreshJobsStore.set(id, job as RefreshJob);
    }
    if (recovered > 0) {
      void this.persistRefreshJobs().catch((e) => console.error("[Storage] persistRefreshJobs after recovery:", e));
      console.log(`[Storage] 將 ${recovered} 個殘留 running refresh job 標記為 failed (recovery)`);
    }
  }

  async persistRefreshJobs(): Promise<void> {
    for (const [jobId, job] of this.refreshJobsStore) {
      await prisma.memRefreshJob.upsert({
        where: { jobId },
        update: { userId: job.userId, jobJson: JSON.stringify(job), updatedAt: new Date() },
        create: { jobId, userId: job.userId, jobJson: JSON.stringify(job) },
      });
    }
  }

  async createRefreshJob(job: RefreshJob): Promise<void> {
    this.refreshJobsStore.set(job.jobId, job);
    await this.persistRefreshJobs();
  }

  getRefreshJob(jobId: string): RefreshJob | null {
    return this.refreshJobsStore.get(jobId) ?? null;
  }

  async updateRefreshJob(jobId: string, updates: Partial<RefreshJob>): Promise<void> {
    const job = this.refreshJobsStore.get(jobId);
    if (!job) return;
    const next = { ...job, ...updates };
    this.refreshJobsStore.set(jobId, next);
    await this.persistRefreshJobs();
  }

  listRefreshJobsByUser(userId: string): RefreshJob[] {
    return Array.from(this.refreshJobsStore.values())
      .filter((j) => j.userId === userId)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  getRunningJobByScopeKey(scopeKey: string): RefreshJob | null {
    for (const job of this.refreshJobsStore.values()) {
      if (job.lockKey === scopeKey && (job.status === "pending" || job.status === "running")) return job;
    }
    return null;
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

  private persistFavorites(): void {
    const obj: Record<string, string[]> = {};
    this.fbFavoriteAccounts.forEach((v, k) => { obj[k] = v; });
    saveJsonFile(FAVORITES_FILE, obj);
  }

  async getUser(id: string): Promise<User | undefined> {
    const row = await prisma.user.findUnique({ where: { id } });
    if (!row) return undefined;
    return {
      id: row.id,
      username: row.username,
      password: "",
      passwordHash: row.passwordHash,
      role: row.role as User["role"],
      displayName: row.displayName,
      defaultProductScope: parseDefaultProductScopeFromDb(row.defaultProductScope),
    };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const row = await prisma.user.findUnique({ where: { username } });
    if (!row) return undefined;
    return {
      id: row.id,
      username: row.username,
      password: "",
      passwordHash: row.passwordHash,
      role: row.role as User["role"],
      displayName: row.displayName,
      defaultProductScope: parseDefaultProductScopeFromDb(row.defaultProductScope),
    };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const { hashPassword } = await import("./auth/passwords");
    const hash = insertUser.password ? await hashPassword(insertUser.password) : "";
    const created = await prisma.user.create({
      data: {
        id,
        username: insertUser.username,
        passwordHash: hash,
        role: insertUser.role ?? "user",
        displayName: insertUser.displayName ?? "",
      },
    });
    return {
      id: created.id,
      username: created.username,
      password: "",
      passwordHash: created.passwordHash,
      role: created.role as User["role"],
      displayName: created.displayName,
    };
  }

  async updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async updateUserDefaultProductScope(userId: string, productNames: string[] | null): Promise<User | undefined> {
    const json =
      productNames == null || productNames.length === 0
        ? null
        : JSON.stringify([...new Set(productNames.map((s) => s.trim()).filter(Boolean))]);
    await prisma.user.updateMany({
      where: { id: userId },
      data: { defaultProductScope: json },
    });
    return this.getUser(userId);
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
    if (!existing) {
      return withVerificationDefaults({
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
      });
    }
    const withEnums = {
      ...existing,
      userId,
      severity: (existing.severity ?? "moderate") as UserSettings["severity"],
      outputLength: (existing.outputLength ?? "standard") as UserSettings["outputLength"],
      brandTone: (existing.brandTone ?? "professional") as UserSettings["brandTone"],
      analysisBias: (existing.analysisBias ?? "conversion") as UserSettings["analysisBias"],
    };
    return withVerificationDefaults(withEnums) as UserSettings;
  }

  async saveSettings(userId: string, input: SettingsInput): Promise<UserSettings> {
    const existing = this.settingsStore.get(userId);
    const nextFb = input.fbAccessToken ?? existing?.fbAccessToken ?? "";
    const nextGa = input.ga4PropertyId ?? existing?.ga4PropertyId ?? "";
    const nextAi = input.aiApiKey ?? existing?.aiApiKey ?? "";
    const fbFp = valueFingerprint(nextFb);
    const gaFp = valueFingerprint(nextGa);
    const aiFp = valueFingerprint(nextAi);
    const clearFbVerification = existing && fbFp && existing.fbValidatedValueHash !== fbFp;
    const clearGaVerification = existing && gaFp && existing.gaValidatedValueHash !== gaFp;
    const clearAiVerification = existing && aiFp && existing.aiValidatedValueHash !== aiFp;
    const settings: UserSettings = withVerificationDefaults({
      userId,
      ga4PropertyId: nextGa,
      fbAccessToken: nextFb,
      aiApiKey: nextAi,
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
      fbStatus: clearFbVerification ? "idle" : (existing?.fbStatus ?? "idle"),
      gaStatus: clearGaVerification ? "idle" : (existing?.gaStatus ?? "idle"),
      aiStatus: clearAiVerification ? "idle" : (existing?.aiStatus ?? "idle"),
      fbVerifiedAt: clearFbVerification ? null : (existing?.fbVerifiedAt ?? null),
      gaVerifiedAt: clearGaVerification ? null : (existing?.gaVerifiedAt ?? null),
      aiVerifiedAt: clearAiVerification ? null : (existing?.aiVerifiedAt ?? null),
      fbLastError: clearFbVerification ? null : (existing?.fbLastError ?? null),
      gaLastError: clearGaVerification ? null : (existing?.gaLastError ?? null),
      aiLastError: clearAiVerification ? null : (existing?.aiLastError ?? null),
      fbValidatedValueHash: clearFbVerification ? null : (existing?.fbValidatedValueHash ?? null),
      gaValidatedValueHash: clearGaVerification ? null : (existing?.gaValidatedValueHash ?? null),
      aiValidatedValueHash: clearAiVerification ? null : (existing?.aiValidatedValueHash ?? null),
    });
    this.settingsStore.set(userId, settings);
    await prisma.userSettingsRecord.upsert({
      where: { userId },
      update: { settingsJson: JSON.stringify(settings) },
      create: { userId, settingsJson: JSON.stringify(settings) },
    });
    return settings;
  }

  /** 更新單一連線類型的驗證狀態（由 test-connection 呼叫後寫入）；value 用於計算 fingerprint，欄位變更時 saveSettings 會失效 */
  async patchVerificationStatus(
    userId: string,
    type: "fb" | "ga4" | "ai",
    payload: { status: "success" | "error"; verifiedAt: string; lastError?: string | null },
    value: string
  ): Promise<UserSettings> {
    const existing = this.getSettings(userId);
    const next: UserSettings = { ...existing };
    const valueHash = valueFingerprint(value);
    if (type === "fb") {
      next.fbStatus = payload.status;
      next.fbVerifiedAt = payload.verifiedAt;
      next.fbLastError = payload.lastError ?? null;
      next.fbValidatedValueHash = payload.status === "success" ? valueHash : null;
    } else if (type === "ga4") {
      next.gaStatus = payload.status;
      next.gaVerifiedAt = payload.verifiedAt;
      next.gaLastError = payload.lastError ?? null;
      next.gaValidatedValueHash = payload.status === "success" ? valueHash : null;
    } else {
      next.aiStatus = payload.status;
      next.aiVerifiedAt = payload.verifiedAt;
      next.aiLastError = payload.lastError ?? null;
      next.aiValidatedValueHash = payload.status === "success" ? valueHash : null;
    }
    this.settingsStore.set(userId, next);
    await prisma.userSettingsRecord.upsert({
      where: { userId },
      update: { settingsJson: JSON.stringify(next) },
      create: { userId, settingsJson: JSON.stringify(next) },
    });
    return next;
  }

  getReviewSessions(userId: string): ReviewSession[] {
    const all = Array.from(this.reviewSessionsStore.values()).filter((s) => s.userId === userId);
    return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getReviewSession(id: string): ReviewSession | undefined {
    return this.reviewSessionsStore.get(id);
  }

  async saveReviewSession(session: ReviewSession): Promise<ReviewSession> {
    this.reviewSessionsStore.set(session.id, session);
    await prisma.reviewSessionRecord.upsert({
      where: { id: session.id },
      update: {
        userId: session.userId,
        sessionJson: JSON.stringify(session),
        updatedAt: new Date(),
      },
      create: {
        id: session.id,
        userId: session.userId,
        sessionJson: JSON.stringify(session),
      },
    });
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

  async saveSyncedAccounts(userId: string, accounts: SyncedAccount[]): Promise<void> {
    this.syncedAccountsStore.set(userId, accounts);
    await prisma.memSyncedAccounts.upsert({
      where: { userId },
      update: { accountsJson: JSON.stringify(accounts), updatedAt: new Date() },
      create: { userId, accountsJson: JSON.stringify(accounts) },
    });
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
    datePreset: string,
    customStart?: string,
    customEnd?: string
  ): AnalysisBatch | null {
    const key = buildScopeKey(
      userId,
      accountIds,
      propertyIds,
      datePreset,
      datePreset === "custom" ? customStart : undefined,
      datePreset === "custom" ? customEnd : undefined
    );
    return this.batchStore.get(key) || null;
  }

  async saveBatch(userId: string, batch: AnalysisBatch): Promise<void> {
    const scopeKey = buildScopeKey(
      userId,
      batch.selectedAccountIds || [],
      batch.selectedPropertyIds || [],
      batch.dateRange.preset,
      batch.dateRange.preset === "custom" ? batch.dateRange.startDate : undefined,
      batch.dateRange.preset === "custom" ? batch.dateRange.endDate : undefined
    );
    this.batchStore.set(scopeKey, batch);
    this.batchStore.set(userId, batch);

    const allKeys = Array.from(this.batchStore.keys()).filter((k) => k.startsWith(`${userId}::`));
    const removedKeys: string[] = [];
    if (allKeys.length > 10) {
      const sorted = allKeys
        .map((k) => ({ key: k, time: this.batchStore.get(k)!.generatedAt }))
        .sort((a, b) => a.time.localeCompare(b.time));
      for (let i = 0; i < sorted.length - 10; i++) {
        const k = sorted[i]!.key;
        this.batchStore.delete(k);
        removedKeys.push(k);
      }
    }

    if (removedKeys.length > 0) {
      await prisma.memAnalysisBatch.deleteMany({ where: { storageKey: { in: removedKeys } } });
    }
    const now = new Date();
    const upsertOne = async (key: string, b: AnalysisBatch) => {
      await prisma.memAnalysisBatch.upsert({
        where: { storageKey: key },
        update: { userId, batchJson: JSON.stringify(b), updatedAt: now },
        create: { storageKey: key, userId, batchJson: JSON.stringify(b) },
      });
    };
    await upsertOne(scopeKey, batch);
    await upsertOne(userId, batch);
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

  async hydratePersistentStoresFromDatabase(): Promise<void> {
    const settingsRows = await prisma.userSettingsRecord.findMany();
    for (const row of settingsRows) {
      try {
        const parsed = JSON.parse(row.settingsJson) as Partial<UserSettings> & { userId?: string };
        const withEnums = {
          ...parsed,
          userId: row.userId,
          severity: (parsed.severity ?? "moderate") as UserSettings["severity"],
          outputLength: (parsed.outputLength ?? "standard") as UserSettings["outputLength"],
          brandTone: (parsed.brandTone ?? "professional") as UserSettings["brandTone"],
          analysisBias: (parsed.analysisBias ?? "conversion") as UserSettings["analysisBias"],
        };
        this.settingsStore.set(row.userId, withVerificationDefaults(withEnums as UserSettings) as UserSettings);
      } catch (e) {
        console.error(`[Storage] hydrate settings userId=${row.userId}:`, (e as Error).message);
      }
    }

    const sessionRows = await prisma.reviewSessionRecord.findMany();
    for (const row of sessionRows) {
      try {
        const session = JSON.parse(row.sessionJson) as ReviewSession;
        this.reviewSessionsStore.set(session.id, session);
      } catch (e) {
        console.error(`[Storage] hydrate review session id=${row.id}:`, (e as Error).message);
      }
    }

    const syncedRows = await prisma.memSyncedAccounts.findMany();
    for (const row of syncedRows) {
      try {
        const accounts = JSON.parse(row.accountsJson) as SyncedAccount[];
        this.syncedAccountsStore.set(row.userId, Array.isArray(accounts) ? accounts : []);
      } catch (e) {
        console.error(`[Storage] hydrate synced userId=${row.userId}:`, (e as Error).message);
      }
    }

    const batchRows = await prisma.memAnalysisBatch.findMany();
    for (const row of batchRows) {
      try {
        const batch = JSON.parse(row.batchJson) as AnalysisBatch;
        this.batchStore.set(row.storageKey, batch);
      } catch (e) {
        console.error(`[Storage] hydrate batch key=${row.storageKey}:`, (e as Error).message);
      }
    }

    const jobRows = await prisma.memRefreshJob.findMany();
    for (const row of jobRows) {
      try {
        let job = JSON.parse(row.jobJson) as RefreshJob;
        if (job.status === "running") {
          job = {
            ...job,
            status: "failed",
            finishedAt: new Date().toISOString(),
            errorStage: "recovery" as RefreshJobErrorStage,
            errorMessage: "服務重啟中斷，job 無法恢復",
          };
        }
        this.refreshJobsStore.set(job.jobId, job);
      } catch (e) {
        console.error(`[Storage] hydrate refresh job id=${row.jobId}:`, (e as Error).message);
      }
    }

    if (batchRows.length > 0) {
      const byUserId = new Map<string, AnalysisBatch>();
      for (const batch of this.batchStore.values()) {
        const uid = batch?.userId;
        if (!uid) continue;
        const existing = byUserId.get(uid);
        const hasPre = batch.precomputedActionCenter != null && batch.precomputedScorecard != null;
        const existingHasPre = existing?.precomputedActionCenter != null && existing?.precomputedScorecard != null;
        const preAt = batch.precomputeCompletedAt ?? "";
        const existingPreAt = existing?.precomputeCompletedAt ?? "";
        const genAt = batch.generatedAt ?? "";
        const existingGenAt = existing?.generatedAt ?? "";
        const pickThis =
          !existing ||
          (hasPre && !existingHasPre) ||
          (hasPre === existingHasPre && (preAt > existingPreAt || (preAt === existingPreAt && genAt > existingGenAt)));
        if (pickThis) byUserId.set(uid, batch);
      }
      for (const [uid, batch] of byUserId) {
        if (!this.batchStore.has(uid)) this.batchStore.set(uid, batch);
      }
    }

    console.log(
      `[Storage] Hydrated from DB: ${settingsRows.length} settings, ${sessionRows.length} review sessions, ${syncedRows.length} synced-account rows, ${batchRows.length} batch rows, ${jobRows.length} refresh jobs`
    );
  }
}

export const storage = new MemStorage();
