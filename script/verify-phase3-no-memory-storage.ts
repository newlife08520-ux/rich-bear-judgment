/**
 * Phase 3 驗收：repo 中已無 multer.memoryStorage()，上傳皆使用 disk storage。
 * 執行：npx tsx script/verify-phase3-no-memory-storage.ts
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const serverDir = path.join(root, "server");

function searchInFile(filePath: string): { hasMemoryStorage: boolean; hasCreateDiskStorage: boolean } {
  const content = fs.readFileSync(filePath, "utf-8");
  const hasMemoryStorage = /\bmemoryStorage\s*\(\s*\)/.test(content);
  const hasCreateDiskStorage = /createDiskStorage\s*\(/.test(content);
  return { hasMemoryStorage, hasCreateDiskStorage };
}

function main() {
  const tsFiles: string[] = [];
  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== "node_modules") walk(full);
      else if (e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".js"))) tsFiles.push(full);
    }
  }
  walk(serverDir);

  let anyMemoryStorage = false;
  const multerFiles: string[] = [];
  for (const f of tsFiles) {
    const content = fs.readFileSync(f, "utf-8");
    const { hasMemoryStorage, hasCreateDiskStorage } = searchInFile(f);
    if (hasMemoryStorage) anyMemoryStorage = true;
    if (hasCreateDiskStorage || content.includes("multer(")) multerFiles.push(path.relative(root, f));
  }

  if (anyMemoryStorage) {
    console.error("未通過：server 下仍有檔案使用 memoryStorage()");
    process.exit(1);
  }
  if (multerFiles.length === 0) {
    console.error("未通過：預期至少一處使用 multer（且應為 createDiskStorage）");
    process.exit(1);
  }
  const routesContent = fs.readFileSync(path.join(serverDir, "routes.ts"), "utf-8");
  if (!routesContent.includes("createDiskStorage") || !routesContent.includes("cleanupUploadTempFile")) {
    console.error("未通過：routes.ts 應使用 createDiskStorage 並在處理後 cleanup");
    process.exit(1);
  }
  console.log("通過：repo 中已無 memoryStorage，上傳使用 disk + cleanup。");
  process.exit(0);
}

main();
