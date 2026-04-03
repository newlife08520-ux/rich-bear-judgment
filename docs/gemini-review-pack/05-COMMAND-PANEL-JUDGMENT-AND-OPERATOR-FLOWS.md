# 05 — COMMAND PANEL, JUDGMENT, AND OPERATOR FLOWS

## 首頁 command panel 主流程（v12）

1. **Top 3 今日動作**（`CommandBand` + `TodayActionsSection`）— 戰略上「先打哪三槍」。  
2. **Partial 醒目帶**（若 `partialHomepage`）— **大字級／邊框強調**，避免「只有一行小字」。  
3. **Truth band**（Trusted／Reference／Partial 語意）— 與 `HomepageCommandPanelV12Chrome` 內 tier 網格一致。  
4. **Digest**— 次級敘事，不搶主指揮。  
5. **Scale／Rescue spotlights**— 漏錢／加碼焦點。  
6. **Dormant strip**— 與 action-center 同批候選。  
7. **次級營運摺疊**— Pareto、利潤、雷達、素材、健康等 **預設不與主指揮同權重**。

## Judgment：Focus vs Operator

| 模式 | 給誰 | 內容 |
|------|------|------|
| **Focus** | 「總監決策一瞥」 | 主結論、下一步、信任／風險一行、**單條證據**（無再摺疊長文）；其餘請去 Operator |
| **Operator** | 「工作台深度」 | 決策卡全量、goal pacing 段落、執行閘門與對話流 |

**審查質疑點**：Focus 是否仍偷偷塞了「只有 Operator 才該出現」的密度？

## Dormant gems 主工作流

- **首頁**：主帶直接列出候選與復活語意。  
- **Products**：排序鍵 `dormant_priority`／`revival_priority`、卡片 badge 與內嵌復活提示。  
- **FB Ads**：`fb-dormant-operational-v7` 區塊 + ribbon + surface section；tabs 旁有 **hint** 提醒與主帶同序。  
- **CI**：`ci-dormant-operational-v7` 為沉睡 **TabsContent** 預設首 tab，列表依 `revivalPriorityScore` 排序。

## 從「看到問題」到「採取行動」

典型路徑：**首頁判斷 truth → 點今日動作或 dormant → 導向 tasks／fb-ads／judgment**；Meta 變更則經 **ExecutionGateDialog** 預覽與確認。

## 操作體驗強項（誠實優點）

- **同一套 action-center 語言**跨三個主營運面（首頁／商品／FB）對齊 dormant。  
- **Partial 不阻斷五區** 的產品決策清楚寫在 UI 與文件中。  
- **Judgment 雙模式** 降低「一頁想做完所有事」的混亂。

## 仍容易困惑或「感覺亂」的點（必寫）

1. **多版本截圖／panel v7–v12** 並存於 repo，**審查者若只看舊圖**會誤判現況。  
2. **FB tabs 多、訊息多**，新使用者仍可能不知「先從哪一 tab 下手」。  
3. **Publish placeholder** 與側欄「發佈」期待可能不一致。  
4. **GA4 與 Meta 敘事** 在部分畫面仍須使用者自行「腦內縫合」。  
5. **Settings 子路徑多**，非技術使用者可能找不到 token／閾值對首頁的影響鏈。

## 為何首頁還不算「最終」war-room

- **次級摺疊內仍龐大**（人類仍可能展開後迷失）。  
- **診斷帶**（StrategicDiagnostics）與主帶的優先級仍在演進。  
- **真實帳戶驗證**（非 seed）不足時，無法證明「15 秒必勝」。
