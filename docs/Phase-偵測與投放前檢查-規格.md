# 本輪規格：素材偵測可信度 + 分組穩定度 + 投放前檢查

## 本輪做什麼
1. 素材上傳後自動偵測：圖片讀 width/height 算 aspectRatio；影片讀 metadata（width/height/duration）；結果存入 detected*、detectStatus、detectSource。
2. 主素材組：系統先建議（依檔名/偵測）、使用者再確認；未分組明確標「未歸組，不建議直接批次建組」。
3. 投放中心新增投放前檢查區塊：廣告帳號、CTA、版本、類型比例、fallback 組、單一尺寸警告、粉專/IG、landingPageUrl。
4. CTA 規則收斂：一律下拉、預設來去逛逛、素材包 CTA 空或不在選項內則 fallback 來去逛逛。
5. 廣告帳號/粉專/IG：確認 Meta API 取得、UI 可搜尋下拉、若未依帳號過濾則明確標示。

## 本輪不做
- Meta 真發送、左側主架構、分析區、新大頁面、無關美化、無驗證價值的欄位。

## 預計修改檔案
- shared/schema.ts（AssetVersion 新增 detected*、detectStatus、detectSource）
- server/modules/asset/asset-version.schema.ts、asset-version-service.ts、asset-version-repository（寫入偵測欄位）
- server/modules/asset/upload-storage 或 asset-package-routes（上傳後呼叫偵測、回傳 detection）
- 新增 server/modules/asset/detect-media.ts（圖片用 image-size、影片用 ffprobe）
- client/src/pages/assets.tsx（使用上傳回傳的 detection、建議主素材組、未歸組標示）
- client/src/pages/publish-placeholder.tsx（投放前檢查、CTA 收斂、粉專/IG 標示）
- package.json（新增 image-size；影片 ffprobe 用 child_process 不新增依賴）

## 驗收標準
見完成回報。

## 風險
- 影片偵測依賴 ffprobe 是否安裝；未安裝時 detectStatus=failed，需手動選比例。
- 舊版本無 detected* 欄位，顯示與 preflight 需容忍缺失。
