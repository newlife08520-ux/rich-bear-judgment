/**
 * 階段二整合驗收（不需伺服器）：
 * 1. 建立 job 可拿到 jobId、status 可查、持久化
 * 2. 同 scope 重複建立不會產生第二個 running job
 * 3. 失敗 job 不污染 latest batch
 * 4. 重啟恢復可把殘留 running 改為 failed
 * 執行：npx tsx script/verify-phase2-acceptance.ts
 * 備註：成功後 dashboard 仍走 precomputed、完整 lifecycle 輪詢需伺服器，請另跑 verify-phase2-e2e.ts
 */
import { spawnSync } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scripts = [
  { name: "verify-phase2-refresh-job.ts", desc: "job 建立/持久化、同 scope 去重、重啟恢復" },
  { name: "verify-phase2-failure-no-pollute.ts", desc: "失敗不污染 latest" },
];

function main() {
  const root = path.resolve(__dirname, "..");
  console.log("# 階段二整合驗收（不需伺服器）\n");

  let allOk = true;
  for (const { name, desc } of scripts) {
    console.log("--- " + desc + " (" + name + ") ---");
    const r = spawnSync("npx", ["tsx", "script/" + name], {
      cwd: root,
      stdio: "inherit",
      encoding: "utf-8",
      env: { ...process.env },
      timeout: 60000,
      shell: true,
    });
    if (r.signal) {
      console.log("結果: 中斷 (signal " + r.signal + ")\n");
      allOk = false;
    } else if (r.status != null && r.status !== 0) {
      console.log("結果: 未通過 (exit " + r.status + ")\n");
      allOk = false;
    } else if (r.status === null) {
      console.log("結果: 未通過 (無 exit code)\n");
      allOk = false;
    } else {
      console.log("結果: 通過\n");
    }
  }

  console.log("---");
  if (allOk) {
    console.log("以上驗收皆通過。請在伺服器運行時執行 npx tsx script/verify-phase2-e2e.ts 驗證 lifecycle 輪詢與 dashboard precomputed。");
    process.exit(0);
  } else {
    console.log("至少一項未通過。");
    process.exit(1);
  }
}

main();
