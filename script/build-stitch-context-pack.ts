/**
 * 產出給 Google Stitch 的 context 包：14 個檔案 + 根目錄 stitch-context-pack.zip
 * 不含 secret／env／node_modules／dist。
 *
 * npm run stitch-context:pack
 */
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import express from "express";
import puppeteer from "puppeteer-core";
import { zipSync } from "fflate";
import { registerRoutes } from "../server/routes";
import { storage } from "../server/storage";

const root = process.cwd();
const OUT_DIR = path.join(root, "docs", "stitch-context-pack");
const ZIP_OUT = path.join(root, "stitch-context-pack.zip");

const SENSITIVE =
  /(password|secret|token|apiKey|api_key|Authorization|Bearer\s|setCookie|cookie\s*:|SESSION_SECRET|OPENAI|ANTHROPIC|GEMINI|privateKey|-----BEGIN|\.env\b|VITE_\w*KEY|DATABASE_URL)/i;

function readRel(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf-8");
}

function sanitizeSource(label: string, src: string, maxLines = 800): string {
  const lines = src.split("\n").filter((line) => !SENSITIVE.test(line));
  const trimmed = lines.slice(0, maxLines).join("\n");
  return `// === ${label} (sanitized excerpt, max ${maxLines} lines) ===\n${trimmed}\n`;
}

function concatSources(parts: Array<[string, string, number?]>): string {
  const header = [
    "/*",
    " * Stitch UI 參考用摘錄：已移除疑似敏感行，非可編譯單元。",
    " * 實作請以 repo 內原始檔為準。",
    " */",
    "",
  ].join("\n");
  return (
    header +
    parts.map(([rel, label, max]) => sanitizeSource(label, readRel(rel), max ?? 700)).join("\n")
  );
}

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

function writeMarkdownFiles(): void {
  const generatedAt = new Date().toISOString();

  fs.writeFileSync(
    path.join(OUT_DIR, "README.md"),
    `# Stitch Context Pack（AI 行銷總監）

產生時間（UTC）：\`${generatedAt}\`

## 用途

本壓縮包內 **14 個檔案** 專供 **Google Stitch**（或類似設計／原型工具）理解產品介面與資訊架構，**不可**當作含憑證或正式 API 契約的來源。

## 內容一覽

| 檔案 | 說明 |
|------|------|
| README.md | 本說明 |
| DESIGN.md | 設計語言與不可違反規則 |
| ROUTES.md | 前端路由對照 |
| TARGET-PAGES.md | 本包鎖定的目標頁 |
| judgment-home.md | 審判官首頁（/judgment）產品說明 |
| judgment-home-ui.txt | 審判官相關 UI 程式摘錄（已淨化） |
| support-workbench.md | 行動紀錄／支援工作台（/tasks） |
| support-workbench-ui.txt | 行動紀錄 UI 摘錄 |
| shared-ui.txt | 側欄與共用導航摘錄 |
| app-shell.txt | App 外殼版面摘錄 |
| *.png | 視窗首屏與第二摺截圖 |

## 安全聲明

- 已刻意 **不包含** \`.env\`、token、cookie、API key、資料庫連線字串。
- \`*-ui.txt\` 為自動過濾敏感關鍵字後的摘錄，若仍發現疑似敏感字串請勿外傳並回報。

## 重新產生

\`\`\`bash
npm run stitch-context:pack
\`\`\`

需本機安裝 **Google Chrome**（或可設 \`CHROME_PATH\`），用以擷取 PNG。
`,
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "DESIGN.md"),
    `# 設計語言與不可違反規則

## 品牌與語氣

- 產品對外名稱：**AI 行銷總監**；側欄副標：**你的數據幕僚**。
- 審判模組頁內標題為 **審判官**（與側欄主導航「審判官」一致），副標說明判讀範圍（素材、頁面、廣告、漏斗）。
- 介面文案預設 **繁體中文**；按鈕語氣偏行銷營運（簡潔、可執行）。

## 技術棧（UI）

- **React** + **wouter** 路由 + **TanStack Query**。
- **Tailwind CSS** + **shadcn/ui** 元件（\`client/src/components/ui/*\`）。
- **CSS 變數** 定義於 \`client/src/index.css\` 的 \`:root\`（HSL 色票）。

## 色彩（語意）

| Token | 用途 |
|-------|------|
| \`primary\` | 主行為、導航強調、連結（約藍 221°） |
| \`secondary\` | 次按鈕、弱背景 |
| \`muted\` / \`muted-foreground\` | 說明文字、邊界資訊 |
| \`destructive\` | 刪除、不可逆、錯誤破壞性操作 |
| \`card\` | 卡片表面與邊框 |
| \`sidebar-*\` | 左側欄專用色與 hover |
| \`border\` | 全區邊框預設 |

深色模式：與 shadcn 慣例一致，使用 \`dark:\` 前綴覆寫；審判區部分區塊仍使用 \`bg-gray-50\`／\`border-gray-200\` 形成 **紙張感對話區**，與全站 warm background 並存為 **刻意層次**，改版時需維持可讀對比。

## 字體

- \`--font-sans\`：Inter, system-ui
- \`--font-serif\`：Playfair Display（標題展示用 \`font-display\`）
- \`--font-mono\`：JetBrains Mono（程式／數據標籤）

## 圓角與陰影

- 全域 \`--radius\`：約 \`0.5rem\`；Tailwind 擴充 \`lg/md/sm\` 階梯。
- 陰影階層 \`shadow-xs\`～\`shadow-2xl\` 用於卡片、下拉、對話框；**不可**在一般列表列上疊過重陰影。

## 版面類型（utilities）

- \`.content-readable\`：閱讀／聊天／長文，max-width 約 900px 置中。
- \`.page-container-fluid\` / 全寬：儀表板、表格、多欄工作台。
- 審判官主內容區常用 \`max-w-6xl mx-auto px-4 py-6\`。

## 側欄導航規則（不可違反）

1. **主導航固定 5 項**（Batch 1 約定）：今日決策中心、商品中心、素材審判、預算控制、審判官。
2. 其餘入口收斂在 **「更多」** 群組，避免主欄膨脹。
3. 每個 \`SidebarMenuButton\` 使用 \`data-testid="nav-<path>"\`（\`/\` → \`dashboard\`）。
4. 側欄頁尾為使用者摘要 + **登出**，登出為 \`variant="ghost"\` \`size="icon"\`。

## 元件行為

- **Button**：主行為 \`default\`；次行為 \`outline\`／\`secondary\`；破壞性 \`destructive\`；導航式 \`ghost\`。
- **Card**：資訊分塊；左側色條（如 \`border-l-4 border-l-red-500/80\`）僅用於 **統計／警示語意**，勿濫用。
- **Dialog / Sheet**：需有明確標題與關閉路徑；執行類操作需二次確認（見審判官 ExecutionGate）。

## 無障礙與識別

- 重要互動控件保留 \`data-testid\`（驗收與自動化依賴）。
- 圖示按鈕需 \`aria-label\` 或鄰近文字（審判官 header 已部分採用）。

## 列印

- 類名 \`no-print\` 用於側欄開關、工具列等，列印報表時應隱藏（若 Stitch 產出列印樣式需遵守）。

## 禁止事項（給設計／原型）

1. **不得**移除主導航 5 項或將「審判官」改名為舊品牌詞。
2. **不得**將破壞性操作做成與主行為同色同重。
3. **不得**在無設計理由下縮小審判輸入區可點擊面積（營運常在行動裝置回覆）。
4. **不得**把機敏設定（金鑰、密碼）放在審判／行動紀錄主流程首屏。
`,
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "ROUTES.md"),
    `# 前端路由（已登入 \`AuthenticatedApp\`）

| Path | 頁面 | 備註 |
|------|------|------|
| \`/\` | 今日決策中心（Dashboard） | 主導航首項 |
| \`/products\` | 商品中心 | |
| \`/tasks\` | 行動紀錄（支援工作台） | **本包 TARGET** |
| \`/mapping\` | 商品對應 | |
| \`/judgment\` | 審判官 | **本包 TARGET** |
| \`/fb-ads\` | 預算控制 | |
| \`/ga4\` | 漏斗／站內證據 | |
| \`/history\` | 歷史紀錄 | |
| \`/assets\` | 素材中心 | |
| \`/creative-lifecycle\` | 素材生命週期 | |
| \`/creative-intelligence\` | Creative Intelligence | |
| \`/creatives\` | 素材審判 | |
| \`/scorecard\` | 素材工廠效率 | |
| \`/publish\` | 投放中心 | |
| \`/publish/history\` | 投放紀錄 | |
| \`/settings\` | 設定中心 | |
| \`/settings/team\` | 團隊設定 | |
| \`/settings/thresholds\` | 閾值 | |
| \`/settings/prompts\` | Prompt | |
| \`/settings/profit-rules\` | 獲利規則 | |
| \`*\` | 404 | |

未登入時僅 \`/login\`（由 \`AppRouter\` 控制，不經側欄）。
`,
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "TARGET-PAGES.md"),
    `# 本 Context Pack 目標頁

1. **審判官首頁** — 路由 \`/judgment\`  
   - 檔案：\`judgment-home.md\`、\`judgment-home-ui.txt\`、\`judgment-home-*.png\`

2. **支援工作台（行動紀錄）** — 路由 \`/tasks\`  
   - 側欄「更多」→ **行動紀錄**。  
   - 檔案：\`support-workbench.md\`、\`support-workbench-ui.txt\`、\`support-workbench-*.png\`

共用：**\`shared-ui.txt\`**（側欄）、**\`app-shell.txt\`**（外殼）、**\`DESIGN.md\`**。
`,
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "judgment-home.md"),
    `# 審判官首頁（/judgment）

## 用途

讓營運以 **對話式** 與「總監」互動，判讀素材／落地頁／廣告／漏斗，並可連動 **決策卡**、**目標節奏**、**證據側欄**；必要時 **匯出報告** 或 **從對話建立行動任務**（經執行門檻與稽核）。

## 首屏區塊（預設「聚焦審判」）

1. **頂部列（JudgmentHeader）**：側欄開關、歷史側欄開關、標題「審判官」、模式切換（聚焦審判 / 營運工作台）、匯出裁決報告、新對話、證據側欄開關。  
2. **可選左欄**：歷史對話列表與搜尋（開啟時）。  
3. **主內容**：  
   - **聚焦審判**：\`JudgmentFocusStrip\`（一句結論 + 節奏警示 + 「工作台」開進階摺疊）。  
   - 證據提示列（附件數、帳戶數、開合證據）。  
   - 無訊息時：**空狀態**（工作流／快速提示）。  
   - 訊息串：**使用者氣泡** / **審判回覆氣泡**（含結構化裁決、建立任務、單則匯出）。  
   - **進階摺疊**：決策卡 + 目標節奏（與營運工作台同源元件）。  
4. **右欄（可選）**：證據面板（附件與帳戶語境）。  
5. **底部固定**：\`JudgmentComposer\`（工作流切換、快速提示列、附件、輸入框、送出）。

**營運工作台**模式：主區直接堆疊 **決策卡區塊** + **目標節奏區塊**（較適合同時監看多品項）。

## 主操作

- 送出對話（Enter／按鈕）。  
- 切換 **聚焦審判** ↔ **營運工作台**。  
- 開合 **歷史**、**證據** 側欄。  
- **新對話**、選擇歷史 session。  
- **匯出裁決報告**（完整）。  
- 在氣泡上 **建立任務**（進入 dry-run／執行門檻流程）。

## 次操作

- 工作流類型切換（素材／頁面／廣告等，見 workflow chips）。  
- 快速提示按鈕（預填 prompt）。  
- 附件上傳／移除。  
- 單則訊息匯出。  
- 展開「進階：決策卡與目標節奏」摺疊。

## 危險操作

- **確認建立任務**（ExecutionGate）：寫入稽核並建立實際任務，需勾選確認；誤觸會增加錯誤工單與稽核噪音。  
- **匯出報告**：可能含營運敏感結論，外傳前應自行脫敏。

## 不可刪區塊

- **JudgmentHeader** 內之 **模式切換**（聚焦／營運）與 **data-testid="text-page-title"** 標題語意。  
- **JudgmentComposer** 底部固定輸入（營運主要互動點）。  
- **ExecutionGateDialog** 與其確認勾選（合規／稽核）。  
- **decision cards / goal pacing** 資料區與 API 契約對齊之 props（不可改欄位語意而不改後端）。
`,
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "support-workbench.md"),
    `# 支援工作台 — 行動紀錄（/tasks）

## 用途

集中管理 **行銷行動任務**：來源、優先級、截止日、影響金額、狀態、負責人；支援 **批次改狀態／批次指派**、**今日執行清單複製**（Slack／LINE），並與審判官「建立任務」連動（深連結 \`?highlight=\`）。

## 首屏區塊

1. **頁首列**：\`SidebarTrigger\`、標題「行動紀錄」、**複製為今日執行清單**、**建立任務**。  
2. **三張統計卡**：高優先、今日到期、高影響金額（左色條語意分類）。  
3. **摘要列卡片**：待分配／進行中／完成數字 + **只看我負責** 勾選。  
4. **錯誤狀態卡**（若 API 失敗）：提示檢查 migration／維運。  
5. **批次操作列**（有勾選時）：批次改狀態、批次指派、取消選取。  
6. **TasksDataTable**：可排序、可勾選、可深連結至商品／素材／審判／投放。  
7. **TasksDialogs**：建立／編輯／批次對話框（掛在頁底）。

## 主操作

- **建立任務**。  
- 在表格中 **編輯單筆**、**變更狀態**。  
- **批次改狀態**、**批次指派**。

## 次操作

- **複製今日執行清單**（純文字）。  
- **只看我負責** 篩選。  
- 表格排序／點連結跳轉其他模組。

## 危險操作

- **批次改狀態**／**批次指派**：影響多筆任務，錯誤操作難以還原，需清楚顯示已選筆數。  
- 在 dev **模擬身份** 與登入帳號不一致時，「只看我負責」可能與預期不符（頁面已提示）。

## 不可刪區塊

- 頁首 **建立任務** 與 **複製今日執行清單**（營運每日流程）。  
- 三張 **KPI 卡**（優先判斷入口）。  
- **只看我負責** 與統計列（責任制流程）。  
- **TasksDataTable** 的選取與批次列（效率核心）。
`,
    "utf-8"
  );
}

function writeUiTextFiles(): void {
  fs.writeFileSync(
    path.join(OUT_DIR, "judgment-home-ui.txt"),
    concatSources([
      ["client/src/pages/judgment.tsx", "pages/judgment.tsx", 220],
      ["client/src/pages/judgment/widgets/JudgmentHeader.tsx", "judgment/widgets/JudgmentHeader.tsx", 120],
      ["client/src/pages/judgment/widgets/JudgmentFocusStrip.tsx", "judgment/widgets/JudgmentFocusStrip.tsx", 80],
      ["client/src/pages/judgment/widgets/JudgmentComposer.tsx", "judgment/widgets/JudgmentComposer.tsx", 200],
    ]),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "support-workbench-ui.txt"),
    concatSources([
      ["client/src/pages/tasks.tsx", "pages/tasks.tsx", 40],
      ["client/src/pages/tasks/TasksPageView.tsx", "tasks/TasksPageView.tsx", 200],
      ["client/src/pages/tasks/widgets/TasksDataTable.tsx", "tasks/widgets/TasksDataTable.tsx", 250],
    ]),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "shared-ui.txt"),
    concatSources([
      ["client/src/components/app-sidebar.tsx", "components/app-sidebar.tsx", 200],
    ]) +
      "\n// Note: Buttons, Card, Sidebar primitives live under client/src/components/ui/ (shadcn).\n",
    "utf-8"
  );

  const appTsx = readRel("client/src/App.tsx");
  const shell = SENSITIVE.test(appTsx)
    ? appTsx
        .split("\n")
        .filter((l) => !SENSITIVE.test(l))
        .join("\n")
    : appTsx;
  fs.writeFileSync(
    path.join(OUT_DIR, "app-shell.txt"),
    [
      "/* AuthenticatedApp / App shell excerpt — sanitized */",
      "",
      shell.split("\n").slice(0, 140).join("\n"),
    ].join("\n"),
    "utf-8"
  );
}

async function captureScreenshots(): Promise<void> {
  const exe = defaultChrome();
  if (!exe || !fs.existsSync(exe)) {
    console.warn("[stitch-context:pack] 找不到 Chrome，略過 PNG（請安裝 Chrome 或設定 CHROME_PATH）");
    return;
  }

  process.env.NODE_ENV = "development";
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || "stitch-pack-session-secret-32chars!";

  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  await registerRoutes(server, app);
  const { setupVite } = await import("../server/vite");
  await setupVite(server, app);

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr && "port" in addr ? addr.port : 5000;
  const base = `http://127.0.0.1:${port}`;

  const username = `stitch_${Date.now()}`;
  const pwd = "StitchPack!23456";
  await storage.createUser({
    username,
    password: pwd,
    role: "user",
    displayName: "Stitch Pack",
  });

  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const vw = 1400;
  const vh = 900;
  await page.setViewport({ width: vw, height: vh });
  const navWait = { waitUntil: "load" as const, timeout: 120000 };

  async function login() {
    await page.goto(`${base}/login`, navWait);
    await page.waitForSelector('[data-testid="input-username"]', { timeout: 60000 });
    await page.click('[data-testid="input-username"]');
    await page.keyboard.type(username);
    await page.click('[data-testid="input-password"]');
    await page.keyboard.type(pwd);
    await page.click('[data-testid="button-login"]');
    await page.waitForNavigation(navWait).catch(() => {});
  }

  async function viewportShot(name: string) {
    const fp = path.join(OUT_DIR, name);
    await page.screenshot({ path: fp, type: "png", fullPage: false });
    console.log("[stitch-context:pack] screenshot", fp);
  }

  await login();

  await page.goto(`${base}/judgment`, navWait);
  await new Promise((r) => setTimeout(r, 700));
  await viewportShot("judgment-home-current.png");
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await new Promise((r) => setTimeout(r, 400));
  await viewportShot("judgment-home-fold1.png");

  await page.goto(`${base}/tasks`, navWait);
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => window.scrollTo(0, 0));
  await viewportShot("support-workbench-current.png");
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await new Promise((r) => setTimeout(r, 400));
  await viewportShot("support-workbench-fold1.png");

  await browser.close();
  server.close();
}

/** 若無 Chrome，寫入 1x1 透明 PNG 佔位，避免 zip 缺檔 */
function writePlaceholderPngs(): void {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const buf = Buffer.from(pngBase64, "base64");
  for (const name of [
    "judgment-home-current.png",
    "judgment-home-fold1.png",
    "support-workbench-current.png",
    "support-workbench-fold1.png",
  ]) {
    const p = path.join(OUT_DIR, name);
    if (!fs.existsSync(p)) fs.writeFileSync(p, buf);
  }
}

function writeZip(): void {
  const names = [
    "README.md",
    "DESIGN.md",
    "ROUTES.md",
    "TARGET-PAGES.md",
    "judgment-home.md",
    "judgment-home-ui.txt",
    "support-workbench.md",
    "support-workbench-ui.txt",
    "shared-ui.txt",
    "app-shell.txt",
    "judgment-home-current.png",
    "judgment-home-fold1.png",
    "support-workbench-current.png",
    "support-workbench-fold1.png",
  ];
  const out: Record<string, Uint8Array> = {};
  for (const n of names) {
    const fp = path.join(OUT_DIR, n);
    if (!fs.existsSync(fp)) throw new Error(`missing ${fp}`);
    out[n] = new Uint8Array(fs.readFileSync(fp));
  }
  const zipped = zipSync(out, { level: 6 });
  fs.writeFileSync(ZIP_OUT, zipped);
  console.log("[stitch-context:pack] zip ->", ZIP_OUT, "bytes", zipped.length);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeMarkdownFiles();
  writeUiTextFiles();
  await captureScreenshots().catch((e) => {
    console.warn("[stitch-context:pack] screenshot failed:", e?.message || e);
  });
  writePlaceholderPngs();
  writeZip();
  console.log("[stitch-context:pack] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
