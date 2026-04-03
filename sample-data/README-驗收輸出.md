# 驗收輸出

封板收尾時，請在**乾淨本地環境**依序執行：

```bash
npm ci
npx prisma generate
npm run verify:baseline
npm run verify:final
```

並將 **verify:baseline** 的完整 stdout 寫回 `verify-baseline-output.txt`，**verify:final** 的完整 stdout 寫回 `verify-final-output.txt`。

本目錄至少應含：`verify-baseline-output.txt`、`verify-final-output.txt`。
