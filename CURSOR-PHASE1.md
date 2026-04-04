# CURSOR 開工指令 — Phase 1：MemStorage → DB 持久化

> **你是這個專案的主責工程師。請先讀完 AGENTS.md，再讀完本指令，然後嚴格執行。**
> **本輪只做一件事：把 MemStorage 裡的 in-memory Map 逐步遷移到 Prisma SQLite。**
> **不加新功能、不改 UI、不動 AI 人格、不動引擎邏輯。**

---

## 本輪禁止修改的區域

- `server/prompts/` — 人格真源
- `server/rich-bear-calibration.ts` — 隱性校準層
- `server/rich-bear-prompt-assembly.ts` — 五層組裝
- `server/rich-bear-persona.ts` — 模式層
- `shared/decision-cards-engine.ts` — 決策卡引擎
- `shared/goal-pacing-engine.ts` — 節奏引擎
- `shared/pareto-engine.ts` — 80/20 引擎
- `shared/visibility-policy.ts` — 沉睡寶石引擎
- `shared/scale-score-engine.ts` — 擴量引擎
- `client/src/pages/dashboard.tsx` — 首頁結構
- `client/src/pages/judgment.tsx` — 審判官頁面結構
- `server/modules/execution/` — 執行層

---

## Step 1：在 prisma/schema.prisma 新增 User model

```prisma
model User {
  id           String   @id
  username     String   @unique
  passwordHash String
  role         String   @default("user")
  displayName  String   @default("")
  createdAt    DateTime @default(now())
}
```

跑 migration：
```bash
npx prisma migrate dev --name add_user_model
```

驗收：確認 migration 成功，`npx prisma studio` 可以看到空的 User table。

---

## Step 2：建立 seed script

建立 `script/seed-default-users.ts`：

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function seed() {
  const users = [
    { id: "1", username: "admin", password: "admin123", role: "admin", displayName: "系統管理員" },
    { id: "2", username: "manager", password: "manager123", role: "manager", displayName: "行銷總監" },
    { id: "3", username: "user", password: "user123", role: "user", displayName: "行銷專員" },
  ];
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        username: u.username,
        passwordHash: hash,
        role: u.role,
        displayName: u.displayName,
      },
    });
    console.log(`Seeded user: ${u.username}`);
  }
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

在 `package.json` scripts 加入：
```json
"seed": "tsx script/seed-default-users.ts"
```

跑一次 `npm run seed`，確認三個使用者已寫入 DB。

---

## Step 3：修改 storage.ts 的 User 相關方法

打開 `server/storage.ts`，找到 `class MemStorage` 裡的以下方法，逐一修改：

### 3a. getUser / getUserByUsername

目前是從 `this.users` Map 讀取。改成從 Prisma 讀取：

```typescript
import { prisma } from "./db";

// 在 MemStorage class 裡改掉這些方法：

async getUser(id: string): Promise<User | undefined> {
  const row = await prisma.user.findUnique({ where: { id } });
  if (!row) return undefined;
  return {
    id: row.id,
    username: row.username,
    password: "",
    passwordHash: row.passwordHash,
    role: row.role as any,
    displayName: row.displayName,
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
    role: row.role as any,
    displayName: row.displayName,
  };
}
```

**注意**：如果 IStorage interface 裡的 getUser 不是 async，需要改成 async。檢查所有 call site 是否已經用 await。

### 3b. createUser

```typescript
async createUser(user: InsertUser): Promise<User> {
  const hash = user.passwordHash ?? (user.password ? await bcrypt.hash(user.password, 12) : "");
  const created = await prisma.user.create({
    data: {
      id: user.id ?? randomUUID(),
      username: user.username,
      passwordHash: hash,
      role: user.role ?? "user",
      displayName: user.displayName ?? "",
    },
  });
  return {
    id: created.id,
    username: created.username,
    password: "",
    passwordHash: created.passwordHash,
    role: created.role as any,
    displayName: created.displayName,
  };
}
```

### 3c. 移除 constructor 裡的 mockUsers

刪除 `constructor()` 裡的 `mockUsers` 陣列和 `mockUsers.forEach(...)`。
用戶現在由 `npm run seed` 建立，不再寫死。

---

## Step 4：驗收 User 持久化

1. `npm run seed`（確保 DB 有使用者）
2. `npm run dev`
3. 瀏覽器打開系統，用 admin / admin123 登入
4. 確認登入成功
5. 停止伺服器（Ctrl+C）
6. 重新 `npm run dev`
7. 再登入一次，確認不需要重新 seed

---

## Step 5：Settings 持久化

### 5a. 新增 Prisma Model

```prisma
model UserSettingsRecord {
  id                     String   @id @default(uuid())
  userId                 String   @unique
  settingsJson           String   @default("{}")  // 整包 UserSettings 存成 JSON
  updatedAt              DateTime @updatedAt
}
```

跑 migration：
```bash
npx prisma migrate dev --name add_user_settings_record
```

### 5b. 修改 storage.ts 的 settings 方法

把 `getUserSettings` 和 `saveUserSettings` 改成讀寫 Prisma：

```typescript
async getUserSettings(userId: string): Promise<UserSettings | undefined> {
  const row = await prisma.userSettingsRecord.findUnique({ where: { userId } });
  if (!row) return undefined;
  try {
    return JSON.parse(row.settingsJson);
  } catch {
    return undefined;
  }
}

async saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
  await prisma.userSettingsRecord.upsert({
    where: { userId },
    update: { settingsJson: JSON.stringify(settings) },
    create: { userId, settingsJson: JSON.stringify(settings) },
  });
}
```

### 5c. 驗收

1. 去設定頁填入 Meta Access Token
2. 按儲存
3. 重啟伺服器
4. 回到設定頁，確認 Token 還在

---

## Step 6：ReviewSessions 持久化

### 6a. 新增 Prisma Model

```prisma
model ReviewSessionRecord {
  id           String   @id
  userId       String
  sessionJson  String   @default("{}")  // 整個 ReviewSession 存 JSON
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId, createdAt])
}
```

跑 migration。

### 6b. 修改 storage.ts 的 reviewSessions 相關方法

所有 `this.reviewSessionsStore` 的 get/set/delete 改成 Prisma 讀寫。

### 6c. 驗收

1. 打開審判官頁面，開始一輪對話
2. 重啟伺服器
3. 回到審判官，左側歷史紀錄裡的對話還在

---

## Step 7：Batch / RefreshJob / SyncedAccount 持久化

這三個 store 比較複雜，各自新增 Prisma model，然後逐一修改 storage.ts。

**Batch（分析批次）**：存整包 JSON
**RefreshJob（同步任務）**：存狀態欄位
**SyncedAccount（已連結帳戶）**：存帳戶資訊

對每個 store：
1. 新增 Prisma model
2. 跑 migration
3. 修改 storage.ts 的方法
4. 驗收：重啟後資料還在

---

## 完成回報格式

完成後必須回報：

1. 改了哪些檔案
2. 新增了哪些 Prisma model
3. 跑了幾次 migration
4. 是否動到禁止修改的區域（應為否）
5. 重啟後的驗收結果
6. 目前還有哪些 Map 尚未遷移
7. 已知風險
