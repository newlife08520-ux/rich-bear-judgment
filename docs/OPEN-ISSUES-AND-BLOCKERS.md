# OPEN-ISSUES-AND-BLOCKERS

- **Tier C／D 擷取**：staging／prod-sanitized 仍多為契約與 placeholder；審查時以 Tier 標籤為準，勿將 Tier B 當真實環境。  
- **歷史 ZIP**：若 `REVIEW-PACK-MANIFEST.json` 之 `completionReports` 與現有磁碟不一致，請重跑 `npm run create-review-zip`（或 `create-review-zip:verified`）再生 manifest。
