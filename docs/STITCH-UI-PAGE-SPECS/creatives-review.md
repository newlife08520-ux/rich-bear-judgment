# 素材審判

## 1. 頁面用途

- 以卡片格呈現每筆有花費素材的「七件事」：商品歸屬、幫拖、黑馬、疲乏、延伸、給投手一句、給設計一句；附 spend／ROAS／Edge 與 evidenceLevel badge。
- 主要給投手、設計、營運。

## 2. 進入方式

- route：`/creatives`。
- 側欄主導航「素材審判」。

## 3. 首屏必須看到的內容

1. SidebarTrigger、標題「素材審判」與 Zap 圖示。
2. 說明段落（每張卡回答七件事）。
3. 第一排卡片網格（最多 50 筆有花費素材）。

## 4. 區塊排列順序

- Header → 說明 → grid 卡片 → 空狀態卡「尚無有花費的素材資料…」。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- 本頁無單一全域主按鈕；主價值在閱讀卡片。導流至同步資料為營運動作（待確認是否加按鈕）。

### B. 次按鈕（Secondary）

- 無。

### C. 危險按鈕（Danger）

- 無。

### D. 輔助按鈕（Utility）

- SidebarTrigger。

## 6. 篩選 / 控制元件

- 無頁級 tab；資料依 employee assignedProducts／Accounts 帶 query（見 creatives.tsx）。

## 7. 狀態資訊 / badge / warning

- Badge：廣告層推測、規則缺失、樣本不足、尚未投遞（EVIDENCE_LABELS）。
- 卡片邊框色：黑馬琥珀、拖紅系、預設 border。

## 8. 可收合但不能消失的區塊

- 七件事欄位標題與內文不可縮成單句而失去可稽核性；evidence badge 不可刪。

## 9. 此頁最不能被 AI 誤改的地方

- 七段結構順序；ROAS 閾值邏輯展示（幫拖判斷）；空狀態引導同步。

## 10. Stitch 用摘要

素材審判是全卡片頁，首屏標題下要有方法說明再進入格狀卡片。每卡固定七個問題區塊與底部 spend／ROAS／Edge，並保留證據層級 badge。沒有全域主按鈕，設計重點是可掃讀與風險色編碼，勿把七件事折成摘要句而無法對照營運邏輯。

（約 170 字）
