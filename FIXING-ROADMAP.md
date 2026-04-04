# 華麗熊審判官 — 商業化修正路線圖

> **本文件是外部 reviewer 審查後產出的修正指南。**
> **目標：讓系統從「高度完成的原型」變成「可以給真實客戶使用的產品」。**
> **原則：不加新功能、不改靈魂、只修地基和清除殘留。**

---

## 靈魂保護條款（修改時不可違反）

1. **五層 Prompt 架構不動**：Core Persona / Hidden Calibration / Mode Overlay / Workflow Overlay / Data Context，順序和分層不可改變
2. **華麗熊人格不動**：`server/prompts/rich-bear-core.ts` 是唯一真源，只讀不改
3. **Decision Cards 的 8 張卡邏輯不動**：summary / actions / product / creative / budget / owner / uncertain / checklist
4. **Goal Pacing 的 6 種 PacingLabel 不動**：UNDERSPENT_GOOD / UNDERSPENT_BAD / FULLY_SPENT_DEGRADING / HOLD_STABLE / LUCKY_NOISE / DO_NOT_TOUCH
5. **Dormant Gems 的雙桶分類不動**：paused_winner_bucket / dormant_gem_bucket
6. **Execution Layer 的 dry-run → apply 流程不動**：10 個 handler 的結構不動
7. **首頁 Command Panel v12 的層級不動**：CommandBand → TrustBand → CommandDigest → SpotlightRail → DormantActionStrip → 次級營運（收合）

---

## Phase 1：MemStorage → DB 持久化（最重要、最緊急）

### 背景
目前 `server/storage.ts` 第 282 行的 `class MemStorage` 把核心業務資料存在記憶體的 Map 裡。伺服器重啟 = 資料全部消失。這是整套系統最大的風險。

### 要做的事

#### 1.1 盤點 MemStorage 裡有哪些資料需要持久化

打開 `server/storage.ts`，找到 `class MemStorage` 裡的所有 `Map` 和陣列，列出每一個：

```
this.users = new Map()           → 需要持久化
this.judgments = new Map()       → 需要持久化
this.settingsStore = new Map()   → 需要持久化（目前部分已存 .data/settings.json）
this.fbFavoriteAccounts = new Map() → 需要持久化
this.syncedAccountsStore = new Map() → 需要持久化
this.batchStore = new Map()      → 需要持久化
this.refreshStatusStore = new Map() → 需要持久化
this.refreshJobsStore = new Map()   → 需要持久化
this.reviewSessionsStore = new Map() → 需要持久化
```

#### 1.2 新增 Prisma Model

在 `prisma/schema.prisma` 新增對應的 model。以下是建議的 schema（逐步加入，不要一次全改）：

**第一批（最重要）：User 和 Settings**

```prisma
model User {
  id           String   @id
  username     String   @unique
  passwordHash String
  role         String   @default("user")
  displayName  String   @default("")
  createdAt    DateTime @default(now())
}

model UserSettingsRecord {
  id                     String   @id @default(uuid())
  userId                 String   @unique
  fbAccessToken          String?
  fbAdAccountIds         String?  // JSON array
  gaPropertyId           String?
  geminiApiKey           String?
  systemPrompt           String   @default("")
  severity               String   @default("moderate")
  outputLength           String   @default("standard")
  brandTone              String   @default("professional")
  analysisBias           String   @default("conversion")
  fbStatus               String   @default("idle")
  gaStatus               String   @default("idle")
  aiStatus               String   @default("idle")
  fbVerifiedAt           String?
  gaVerifiedAt           String?
  aiVerifiedAt           String?
  fbLastError            String?
  gaLastError            String?
  aiLastError            String?
  updatedAt              DateTime @updatedAt
}
```

**第二批：SyncedAccount 和 RefreshJob**

```prisma
model SyncedAccountRecord {
  id          String   @id @default(uuid())
  userId      String
  accountId   String
  accountName String
  platform    String   // "meta" | "ga4"
  status      String
  syncedAt    DateTime @default(now())
  metaJson    String?  // 存放額外 Meta 資料
  
  @@unique([userId, accountId, platform])
  @@index([userId])
}

model RefreshJobRecord {
  id           String    @id @default(uuid())
  userId       String
  status       String    // queued | running | completed | failed
  errorStage   String?
  errorMessage String?
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime  @default(now())
  
  @@index([userId, createdAt])
}
```

**第三批：ReviewSession 和 Judgment**

```prisma
model ReviewSessionRecord {
  id         String   @id
  userId     String
  title      String   @default("")
  messagesJson String @default("[]")  // JSON array of ChatMessage
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  @@index([userId, createdAt])
}

model JudgmentRecord {
  id         String   @id @default(uuid())
  userId     String
  sessionId  String?
  inputJson  String   // JudgmentInput as JSON
  reportJson String   // JudgmentReport as JSON
  createdAt  DateTime @default(now())
  
  @@index([userId, createdAt])
}
```

#### 1.3 建立 Migration

每加一批 model，跑一次：
```bash
npx prisma migrate dev --name add_user_settings_persistence
```

#### 1.4 修改 Storage 實作

**不要一次把整個 MemStorage 刪掉。** 逐步替換：

1. 先把 User 相關方法改成讀寫 Prisma
2. 確認登入正常
3. 再把 Settings 改成讀寫 Prisma
4. 確認設定頁正常
5. 依序處理其他 store

每改一個 store，都要：
- 確認讀取正常
- 確認寫入正常
- 確認重啟後資料還在
- 不動 IStorage 的 interface 定義（其他地方都用這個 interface）

#### 1.5 驗收方式

1. 啟動系統，登入
2. 去設定頁設定 API key
3. 重啟伺服器（`Ctrl+C` 然後 `npm run dev`）
4. 重新登入，確認設定還在
5. 觸發資料同步，確認帳戶資料還在
6. 再重啟一次，確認都沒丟

### ⚠️ 注意事項
- 不要動 `server/storage.ts` 的 `IStorage` interface，只改 `MemStorage` class 的實作
- 保留 `loadPersistedData()` 裡讀 JSON 檔案的邏輯作為 fallback，直到完全遷移完
- 預設的三個 mock users（admin/manager/user）改成 seed script，不要寫死在 constructor 裡
- `.data/settings.json` 的讀取邏輯暫時保留，作為遷移過渡

---

## Phase 2：清除 Mock 殘留（第二重要）

### 2.1 清除 mock-cdn URL

**檔案**：`server/routes.ts` 第 512 行附近

找到：
```typescript
url: `https://mock-cdn.example.com/uploads/${id}/${fileName}`,
```

改成使用真實的 upload-provider URL，例如：
```typescript
url: `/api/uploads/${userId}/${fileName}`,
```

參考 `server/modules/asset/upload-provider.ts` 裡已有的真實 URL 生成邏輯。

### 2.2 清除 picsum.photos 假縮圖

**檔案 1**：`server/routes.ts` 第 2008 行附近
**檔案 2**：`server/build-action-center-payload.ts` 第 187 行附近

找到：
```typescript
const thumbnailUrl = `https://picsum.photos/seed/${seed}/120/90`;
```

改成：
```typescript
// 若有真實素材版本的 fileUrl，使用它；否則回傳 null
const thumbnailUrl = assetVersion?.fileUrl 
  ? `/api/uploads/${userId}/${parseFilename(assetVersion.fileUrl)}`
  : null;
```

如果無法對應到真實素材，thumbnailUrl 設為 `null`，前端顯示 placeholder icon（不是假圖片）。

### 2.3 前端處理 null thumbnailUrl

在 `client/src/components/AssetThumbnailImg.tsx`（或對應的縮圖元件）加入：
```typescript
if (!src) {
  return <div className="w-[120px] h-[90px] bg-muted rounded flex items-center justify-center">
    <ImageIcon className="w-6 h-6 text-muted-foreground" />
  </div>;
}
```

### 驗收方式
1. 全域搜尋 `mock-cdn` 和 `picsum.photos`，確認零結果
2. 打開首頁 Action Center，確認縮圖不是隨機圖片
3. 上傳一個素材，確認 URL 是真實路徑

---

## Phase 3：死碼清理（第三重要）

### 3.1 刪除 HomepageCommandPanel V7~V11

**要刪的檔案**：
```
client/src/pages/dashboard/widgets/HomepageCommandPanelV7.tsx
client/src/pages/dashboard/widgets/HomepageCommandPanelV8.tsx
client/src/pages/dashboard/widgets/HomepageCommandPanelV9.tsx
client/src/pages/dashboard/widgets/HomepageCommandPanelV10.tsx
client/src/pages/dashboard/widgets/HomepageCommandPanelV11.tsx
```

**要修改的檔案**：
`client/src/pages/dashboard/widgets/index.ts`

移除所有 V7~V11 的 export，只保留：
```typescript
export { HomepageCommandPanelV12Chrome } from "./HomepageCommandPanelV12";
```

**驗收**：
1. 確認 `dashboard.tsx` 裡只引用 V12
2. 全域搜尋 `CommandPanelV7`、`CommandPanelV8`... 到 `V11`，確認零引用
3. 啟動系統，首頁正常顯示

### 3.2 移除 Drizzle 殘留

**要刪的檔案**：
```
drizzle.config.ts
```

**要修改的檔案**：`package.json`

移除這些 dependencies（如果沒被其他地方用到的話）：
```
"drizzle-orm"
"drizzle-zod"
"drizzle-kit"
```

移除 scripts 裡的：
```
"db:push": "drizzle-kit push"
```

**驗收前先確認**：全域搜尋 `from "drizzle-orm"` 和 `from "drizzle-zod"`，如果有其他檔案在用，就先不刪 dependency，只刪 drizzle.config.ts。

### 3.3 清理 Storage 裡的 hardcoded mock users

`server/storage.ts` 第 314 行的 `mockUsers` 陣列應該改成 seed script：

建立 `script/seed-default-users.ts`：
```typescript
import { prisma } from "../server/db";
import bcrypt from "bcrypt";

async function seed() {
  const users = [
    { id: "1", username: "admin", password: "你的密碼", role: "admin", displayName: "系統管理員" },
    { id: "2", username: "manager", password: "你的密碼", role: "manager", displayName: "行銷總監" },
    { id: "3", username: "user", password: "你的密碼", role: "user", displayName: "行銷專員" },
  ];
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: { id: u.id, username: u.username, passwordHash: hash, role: u.role, displayName: u.displayName },
    });
  }
  console.log("Seeded", users.length, "users");
}
seed();
```

在 `package.json` 加：
```json
"seed": "tsx script/seed-default-users.ts"
```

---

## Phase 4：AI Fallback 可見性（重要但簡單）

### 4.1 AI Summary 加來源標記

**檔案**：`server/ai-summary-pipeline.ts`

在回傳的 `CrossAccountSummary` 物件裡加一個欄位：

```typescript
// 在 buildDeterministicSummary 回傳時：
return { ...base, summarySource: "deterministic" as const };

// 在 Gemini 成功回傳時：
return { ...result, summarySource: "ai" as const };
```

### 4.2 前端顯示標記

在首頁的 `HomepageCommandDigest` 或 `HomepageDataTruthSection` 裡：

```typescript
{summarySource === "deterministic" && (
  <Badge variant="outline" className="text-[10px]">
    規則摘要（非 AI）
  </Badge>
)}
```

### 驗收
1. 設定頁不填 Gemini API key → 首頁摘要旁邊要顯示「規則摘要（非 AI）」
2. 填了 API key → 不顯示標記（或顯示「AI 分析」）

---

## Phase 5：Publish Wizard 提前阻擋（重要但簡單）

### 5.1 新增 Guard Check API

**檔案**：`server/modules/publish/publish-routes.ts`

```typescript
publishRouter.get("/guard-check", async (req, res) => {
  const metaWritesAllowed = allowMetaPublishStage1Writes();
  res.json({
    metaWritesAllowed,
    message: metaWritesAllowed ? null : "Meta 寫入功能目前未啟用，草稿可建立但無法送出至 Meta。",
  });
});
```

### 5.2 Wizard 第一步加入檢查

**檔案**：`client/src/pages/publish/widgets/PublishWizardStep1.tsx`

在 Wizard 開啟時 fetch `/api/publish/guard-check`，如果 `metaWritesAllowed` 為 false，在 Step 1 頂部顯示醒目的黃色提示，並將「送往 Meta」按鈕改為 disabled 狀態（仍可建立草稿但不能送出）。

---

## Phase 6：門檻可配置化（應做，不緊急）

### 6.1 Pareto hidden diamond 門檻

**檔案**：`shared/pareto-engine.ts` 第 66 行

目前：
```typescript
.filter((it) => it.spend < 200 && profitLike(it) > 0 && it.revenue / Math.max(it.spend, 1) >= 2.2)
```

改成接受參數：
```typescript
export interface ParetoOptions {
  hiddenDiamondMaxSpend?: number;   // 預設 200
  hiddenDiamondMinRoas?: number;    // 預設 2.2
}

export function computePareto(items: ParetoItem[], options?: ParetoOptions): ParetoResult {
  const maxSpend = options?.hiddenDiamondMaxSpend ?? 200;
  const minRoas = options?.hiddenDiamondMinRoas ?? 2.2;
  // ...
  .filter((it) => it.spend < maxSpend && profitLike(it) > 0 && it.revenue / Math.max(it.spend, 1) >= minRoas)
}
```

### 6.2 Goal Pacing 的 LUCKY_NOISE 門檻

**檔案**：`shared/goal-pacing-engine.ts` 第 131 行

同樣改成可傳入的參數，預設值維持原樣。

---

## 每個 Phase 完成後的自查清單

完成每個 Phase 後，必須回答以下問題：

- [ ] 修改了哪些檔案？
- [ ] 哪些檔案刻意沒動？
- [ ] 是否影響了華麗熊的人格或判斷邏輯？（應為否）
- [ ] 是否影響了首頁 Command Panel v12 的結構？（應為否）
- [ ] 是否影響了 Decision Cards / Goal Pacing / Dormant Gems 的規則？（應為否）
- [ ] 重啟後資料是否還在？（Phase 1 完成後必須為是）
- [ ] 全域搜尋 mock-cdn 和 picsum.photos 是否為零？（Phase 2 完成後必須為是）
- [ ] 系統是否能正常啟動並登入？
- [ ] 首頁是否正常顯示？
- [ ] 審判官是否能正常對話？

---

## 不可以做的事

1. **不可以重寫整個 storage.ts**——要逐步替換，每改一個 store 就測一次
2. **不可以改動 `server/prompts/rich-bear-core.ts`**——人格真源只讀
3. **不可以改動 `server/rich-bear-calibration.ts`**——隱性校準層只讀
4. **不可以改動五層 Prompt 組裝順序**——`server/rich-bear-prompt-assembly.ts` 的組裝順序不動
5. **不可以刪除 `shared/` 裡的任何引擎檔案**——decision-cards-engine / goal-pacing-engine / pareto-engine / visibility-policy / scale-score-engine / tag-aggregation-engine 都不動
6. **不可以改動 Execution Layer 的 handler 結構**——`server/modules/execution/handlers/` 不動
7. **不可以把多個 Phase 混在一起做**——一個 Phase 一個 commit，每個 Phase 完成後跑一次自查清單
8. **不可以順手「優化」看起來不順眼的 UI 或邏輯**——本輪只修地基，不加功能不改外觀

---

## 執行順序總結

| 順序 | Phase | 預估時間 | 優先級 |
|------|-------|---------|--------|
| 1 | Phase 1：MemStorage → DB（分 3 批） | 2~3 天 | 🔴 必做 |
| 2 | Phase 2：清除 Mock 殘留 | 半天 | 🔴 必做 |
| 3 | Phase 3：死碼清理 | 半天 | 🟡 應做 |
| 4 | Phase 4：AI Fallback 可見性 | 2 小時 | 🟡 應做 |
| 5 | Phase 5：Publish Guard 提前阻擋 | 2 小時 | 🟡 應做 |
| 6 | Phase 6：門檻可配置化 | 1 天 | 🟢 可延後 |

**Phase 1 和 Phase 2 完成後，系統就可以進入「受控 demo」階段。**
