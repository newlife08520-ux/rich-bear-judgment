/**
 * 以 puppeteer-core + 本機 Chrome 擷取真實頁面 PNG → docs/PAGE-STATE-SCREENSHOTS/
 *
 * 需已安裝 Chrome；可設 CHROME_PATH。
 * 內建建立暫時使用者並注入與 capture 腳本相同之 donor batch（記憶體內）。
 *
 * npm run screenshots:page-states
 */
import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import { registerRoutes } from "../server/routes";
import { storage } from "../server/storage";

/** 與正式 dev 相同：需掛 Vite，否則 /login 等 SPA 路由無前端 bundle。 */
async function attachClientSpa(server: http.Server, app: express.Express): Promise<void> {
  const { setupVite } = await import("../server/vite");
  await setupVite(server, app);
}
import type { AnalysisBatch, SyncedAccount } from "@shared/schema";

type StoreHack = { batchStore: Map<string, AnalysisBatch>; syncedAccountsStore: Map<string, SyncedAccount[]> };

function defaultChrome(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === "win32") {
    const p = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    if (fs.existsSync(p)) return p;
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return "/usr/bin/google-chrome";
}

function findDonor(hack: StoreHack): AnalysisBatch | null {
  for (const id of ["1", "2", "3"]) {
    const b = storage.getLatestBatch(id);
    if (b?.campaignMetrics?.length) return JSON.parse(JSON.stringify(b)) as AnalysisBatch;
  }
  for (const [, b] of hack.batchStore) {
    if (b?.campaignMetrics?.length) return JSON.parse(JSON.stringify(b)) as AnalysisBatch;
  }
  return null;
}

async function shot(page: puppeteer.Page, name: string) {
  const dir = path.join(process.cwd(), "docs", "PAGE-STATE-SCREENSHOTS");
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, name);
  await page.screenshot({ path: fp, fullPage: true });
  console.log("[screenshot]", fp);
}

async function main(): Promise<void> {
  process.env.NODE_ENV = "development";
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || "screenshot-session-secret-32chars!!";

  const exe = defaultChrome();
  if (!exe || !fs.existsSync(exe)) {
    console.error("[screenshot] 找不到 Chrome，請設定 CHROME_PATH");
    process.exit(1);
  }

  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  await registerRoutes(server, app);
  // 與 server/index 開發模式一致：否則 GET /login 不會回 SPA，無法出現 data-testid
  const { setupVite } = await import("../server/vite");
  await setupVite(server, app);

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr && "port" in addr ? addr.port : 5000;
  const base = `http://127.0.0.1:${port}`;

  const username = `shot_${Date.now()}`;
  const password = "ShotState!12345";
  const user = await storage.createUser({
    username,
    password,
    role: "user",
    displayName: "Screenshot",
  });
  const uid = user.id;
  const hack = storage as unknown as StoreHack;
  const metaAcct: SyncedAccount = {
    id: "sa_shot",
    userId: uid,
    platform: "meta",
    accountId: "act_shot",
    accountName: "Shot Account",
    status: "active",
    lastSyncedAt: new Date().toISOString(),
    isDefault: true,
  };

  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const navWait = { waitUntil: "load" as const, timeout: 120000 };

  async function login() {
    await page.goto(`${base}/login`, navWait);
    await page.waitForSelector('[data-testid="input-username"]', { timeout: 60000 });
    await page.click('[data-testid="input-username"]');
    await page.keyboard.type(username);
    await page.click('[data-testid="input-password"]');
    await page.keyboard.type(password);
    await page.click('[data-testid="button-login"]');
    await page.waitForNavigation(navWait).catch(() => {});
  }

  await login();

  const donor = findDonor(hack);

  if (donor) {
    donor.userId = uid;
    hack.batchStore.set(uid, donor);
    hack.syncedAccountsStore.set(uid, [metaAcct]);
    await page.goto(`${base}/`, navWait);
    await new Promise((r) => setTimeout(r, 800));
    await shot(page, "dashboard-has-data.png");
    await shot(page, "dashboard-command-panel-has-data.png");
    await shot(page, "dashboard-command-panel-v4-has-data.png");
    await shot(page, "dashboard-command-panel-v5-has-data.png");
    await shot(page, "dashboard-command-panel-v6-has-data.png");
    await shot(page, "dashboard-command-panel-v7-has-data.png");
    await shot(page, "dashboard-command-panel-v8-has-data.png");
    await shot(page, "dashboard-command-panel-v9-has-data.png");
    await shot(page, "dashboard-command-panel-v10-has-data.png");
    await shot(page, "dashboard-command-panel-v11-has-data.png");
    await shot(page, "dashboard-command-panel-v12-has-data.png");

    const partial = JSON.parse(JSON.stringify(donor)) as AnalysisBatch;
    delete partial.summary;
    hack.batchStore.set(uid, partial);
    await page.goto(`${base}/`, navWait);
    await new Promise((r) => setTimeout(r, 800));
    await shot(page, "dashboard-partial-data.png");
    await shot(page, "dashboard-command-panel-partial-data.png");
    await shot(page, "dashboard-command-panel-v4-partial-data.png");
    await shot(page, "dashboard-command-panel-v5-partial-data.png");
    await shot(page, "dashboard-command-panel-v6-partial-data.png");
    await shot(page, "dashboard-command-panel-v7-partial-data.png");
    await shot(page, "dashboard-command-panel-v8-partial-data.png");
    await shot(page, "dashboard-command-panel-v9-partial-data.png");
    await shot(page, "dashboard-command-panel-v10-partial-data.png");
    await shot(page, "dashboard-command-panel-v11-partial-data.png");
  }

  hack.batchStore.delete(uid);
  hack.syncedAccountsStore.set(uid, []);
  await page.goto(`${base}/`, navWait);
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "dashboard-no-data.png");
  await shot(page, "dashboard-command-panel-no-data.png");

  if (donor) {
    donor.userId = uid;
    hack.batchStore.set(uid, donor);
    hack.syncedAccountsStore.set(uid, [metaAcct]);
  }

  await page.goto(`${base}/products`, navWait);
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "products-main-list.png");
  await shot(page, "products-main-list-v6.png");

  await page.evaluate(() => {
    const el = document.querySelector("[data-testid='products-dormant-gems-section']");
    el?.scrollIntoView({ block: "start" });
  });
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, "products-dormant-gems-v4.png");
  await shot(page, "products-dormant-gems-v5.png");
  await shot(page, "products-dormant-operational-v7.png");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 500));
  await shot(page, "products-zero-spend-diagnostics.png");

  await page.goto(`${base}/judgment`, navWait);
  await new Promise((r) => setTimeout(r, 600));
  await shot(page, "judgment-focus-mode.png");
  await shot(page, "judgment-focus-mode-v2.png");
  await shot(page, "judgment-focus-mode-v5.png");
  await shot(page, "judgment-focus-mode-v6.png");
  await shot(page, "judgment-focus-mode-v7.png");
  await shot(page, "judgment-focus-mode-v8.png");
  await shot(page, "judgment-focus-mode-v10.png");
  await shot(page, "judgment-focus-mode-v11.png");
  await shot(page, "judgment-focus-mode-v12.png");

  await page
    .evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const op = buttons.find((b) => b.textContent?.includes("營運工作台"));
      op?.click();
    })
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  await shot(page, "judgment-operator-mode.png");
  await shot(page, "judgment-operator-mode-v2.png");
  await shot(page, "judgment-operator-mode-v5.png");
  await shot(page, "judgment-operator-mode-v6.png");
  await shot(page, "judgment-operator-mode-v7.png");
  await shot(page, "judgment-operator-mode-v8.png");
  await shot(page, "judgment-operator-mode-v10.png");
  await shot(page, "judgment-operator-mode-v11.png");

  await page.goto(`${base}/creative-intelligence`, navWait);
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "creative-intelligence-main.png");
  await shot(page, "creative-intelligence-main-v6.png");

  await page.goto(`${base}/fb-ads`, navWait);
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "fb-ads-main.png");
  await shot(page, "fb-ads-main-v6.png");
  await page.evaluate(() => {
    const el = document.querySelector("[data-testid='fb-ads-dormant-gems-section']");
    el?.scrollIntoView({ block: "start" });
  });
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, "fb-ads-dormant-gems.png");
  await shot(page, "fb-ads-dormant-gems-v2.png");
  await shot(page, "fb-ads-dormant-gems-v3.png");
  await shot(page, "fb-ads-dormant-gems-v4.png");
  await shot(page, "fb-ads-dormant-gems-v5.png");

  await page.goto(`${base}/creative-intelligence`, navWait);
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(() => {
    const el = document.querySelector("[data-testid='creative-intelligence-dormant-gems-section']");
    el?.scrollIntoView({ block: "start" });
  });
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, "creative-intelligence-dormant-gems.png");
  await shot(page, "creative-intelligence-dormant-gems-v2.png");
  await shot(page, "creative-intelligence-dormant-gems-v3.png");
  await shot(page, "creative-intelligence-dormant-gems-v4.png");
  await shot(page, "creative-intelligence-dormant-gems-v5.png");
  await shot(page, "creative-intelligence-dormant-gems-v6.png");
  await shot(page, "creative-intelligence-dormant-operational-v7.png");

  await browser.close();
  hack.batchStore.delete(uid);
  hack.syncedAccountsStore.delete(uid);
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  console.log("[take-page-state-screenshots] done");
  // Vite dev middleware may leave WS/HMR handles open; force exit so npm chains continue.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
;
